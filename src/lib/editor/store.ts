"use client";

import { temporal } from "zundo";
import { useStore } from "zustand";
import { create } from "zustand";
import { saveProject } from "@/lib/persistence/projects";
import type { LyricLine, Project } from "@/lib/types";
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
  setProject: (p: Project | null) => void;
  updateText: (id: string, text: string) => void;
  retime: (id: string, startMs: number, endMs: number) => void;
  splitLine: (id: string, charIndex: number) => void;
  mergeWithNext: (id: string) => void;
  insertAfter: (id: string | null) => void;
  insertAtStart: () => void;
  deleteLine: (id: string) => void;
};

function withLines(p: Project, lines: LyricLine[]): Project {
  return { ...p, lyrics: { ...p.lyrics, lines } };
}

export const useEditorStore = create<State & Actions>()(
  temporal(
    (set) => ({
      project: null,
      setProject: (p) => set({ project: p }),
      updateText: (id, text) =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opUpdateText(s.project.lyrics.lines, id, text)) }
            : s,
        ),
      retime: (id, startMs, endMs) =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opRetime(s.project.lyrics.lines, id, startMs, endMs)) }
            : s,
        ),
      splitLine: (id, charIndex) =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opSplit(s.project.lyrics.lines, id, charIndex)) }
            : s,
        ),
      mergeWithNext: (id) =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opMerge(s.project.lyrics.lines, id)) }
            : s,
        ),
      insertAfter: (id) =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opInsert(s.project.lyrics.lines, id)) }
            : s,
        ),
      insertAtStart: () =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opInsertAtStart(s.project.lyrics.lines)) }
            : s,
        ),
      deleteLine: (id) =>
        set((s) =>
          s.project
            ? { project: withLines(s.project, opDelete(s.project.lyrics.lines, id)) }
            : s,
        ),
    }),
    {
      // setProject 는 history 에서 제외 — 외부 sync 용 (다른 프로젝트로 전환).
      // 편집 ops 만 undo/redo 대상.
      partialize: (state) => ({ project: state.project }),
      limit: 100,
    },
  ),
);

// ── Auto-save: 500ms debounce 로 IndexedDB 저장 + 외부 listener 통보 ──
type SaveListener = (p: Project) => void;
const listeners = new Set<SaveListener>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedProject: Project | null = null;

useEditorStore.subscribe((state) => {
  const p = state.project;
  if (!p || p === lastSavedProject) return;
  lastSavedProject = p;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveProject(p);
      for (const l of listeners) l(p);
    } catch (e) {
      console.error("[editor autosave] failed:", e);
    }
  }, 500);
});

export function subscribeProjectSaves(listener: SaveListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Temporal (undo/redo) hook ──
import type { TemporalState } from "zundo";
import type { StoreApi } from "zustand";
type TemporalApi = TemporalState<State>;

export function useUndoRedo<T>(selector: (s: TemporalApi) => T): T {
  const api = useEditorStore.temporal as unknown as StoreApi<TemporalApi>;
  return useStore(api, selector);
}
