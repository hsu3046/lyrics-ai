"use client";

import { temporal } from "zundo";
import { useStore } from "zustand";
import { create } from "zustand";
import { saveProject } from "@/lib/persistence/projects";
import type { Lyrics, LyricLine, Project, Song } from "@/lib/types";
import {
  deleteLine as opDelete,
  insertAfter as opInsert,
  insertAtStart as opInsertAtStart,
  mergeWithNext as opMerge,
  retime as opRetime,
  splitLine as opSplit,
  updateText as opUpdateText,
} from "./operations";

type State = {
  project: Project | null;
};

type Actions = {
  /** 외부 sync 용 — autosave 의 lastSavedKey 도 함께 갱신 (불필요한 재저장 회피). */
  setProject: (p: Project | null) => void;

  /** Song metadata (title/artist/cover 등) 업데이트 — autosave trigger. */
  setSong: (song: Song) => void;

  /** 가사 라인 통째 교체 (STT / SRT import 등). */
  replaceLyrics: (
    lines: LyricLine[],
    meta?: Partial<Pick<Lyrics, "source" | "sttModel" | "language">>,
  ) => void;

  // 라인 단위 편집
  updateText: (id: string, text: string) => void;
  retime: (id: string, startMs: number, endMs: number) => void;
  splitLine: (id: string, charIndex: number) => void;
  mergeWithNext: (id: string) => void;
  insertAfter: (id: string | null) => void;
  insertAtStart: () => void;
  deleteLine: (id: string) => void;
};

/** Project 의 song.updatedAt 을 자동 갱신하면서 lyrics.lines 만 변경. */
function withLines(p: Project, lines: LyricLine[]): Project {
  return {
    ...p,
    song: { ...p.song, updatedAt: Date.now() },
    lyrics: { ...p.lyrics, lines },
  };
}

export const useEditorStore = create<State & Actions>()(
  temporal(
    (set) => ({
      project: null,
      setProject: (p) => {
        // 외부에서 받은 project — autosave trigger 회피
        if (p) lastSavedKey = `${p.id}:${p.song.updatedAt}`;
        set({ project: p });
      },
      setSong: (song) =>
        set((s) =>
          s.project
            ? {
                project: {
                  ...s.project,
                  song: { ...song, updatedAt: Date.now() },
                },
              }
            : s,
        ),
      replaceLyrics: (lines, meta) =>
        set((s) =>
          s.project
            ? {
                project: {
                  ...s.project,
                  song: { ...s.project.song, updatedAt: Date.now() },
                  lyrics: { ...s.project.lyrics, lines, ...(meta ?? {}) },
                },
              }
            : s,
        ),
      updateText: (id, text) =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opUpdateText(s.project.lyrics.lines, id, text),
                ),
              }
            : s,
        ),
      retime: (id, startMs, endMs) =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opRetime(s.project.lyrics.lines, id, startMs, endMs),
                ),
              }
            : s,
        ),
      splitLine: (id, charIndex) =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opSplit(s.project.lyrics.lines, id, charIndex),
                ),
              }
            : s,
        ),
      mergeWithNext: (id) =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opMerge(s.project.lyrics.lines, id),
                ),
              }
            : s,
        ),
      insertAfter: (id) =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opInsert(s.project.lyrics.lines, id),
                ),
              }
            : s,
        ),
      insertAtStart: () =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opInsertAtStart(s.project.lyrics.lines),
                ),
              }
            : s,
        ),
      deleteLine: (id) =>
        set((s) =>
          s.project
            ? {
                project: withLines(
                  s.project,
                  opDelete(s.project.lyrics.lines, id),
                ),
              }
            : s,
        ),
    }),
    {
      partialize: (state) => ({ project: state.project }),
      limit: 100,
    },
  ),
);

// ─── Auto-save (500ms debounce) ───
//
// id+updatedAt 기반 비교 — reference 비교는 외부에서 새 객체 받으면 false-positive.
// setProject 호출 시 lastSavedKey 미리 갱신해 ping-pong 차단.
type SaveListener = (p: Project) => void;
type ErrorListener = (error: unknown) => void;
const saveListeners = new Set<SaveListener>();
const errorListeners = new Set<ErrorListener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedKey: string | null = null;

useEditorStore.subscribe((state) => {
  const p = state.project;
  if (!p) return;
  const key = `${p.id}:${p.song.updatedAt}`;
  if (key === lastSavedKey) return;
  lastSavedKey = key;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveProject(p);
      for (const l of saveListeners) l(p);
    } catch (e) {
      console.error("[editor autosave] failed:", e);
      for (const l of errorListeners) l(e);
    }
  }, 500);
});

export function subscribeProjectSaves(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

export function subscribeAutosaveErrors(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

// ── Temporal (undo/redo) hook ──
import type { TemporalState } from "zundo";
import type { StoreApi } from "zustand";
type TemporalApi = TemporalState<State>;

export function useUndoRedo<T>(selector: (s: TemporalApi) => T): T {
  const api = useEditorStore.temporal as unknown as StoreApi<TemporalApi>;
  return useStore(api, selector);
}
