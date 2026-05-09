"use client";

import { Plus, Redo2, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { LineEditRow } from "@/components/editor/LineEditRow";
import { Button } from "@/components/ui/button";
import { useEditorStore, useUndoRedo } from "@/lib/editor/store";
import type { LyricLine } from "@/lib/types";

export function EditableLyricsView({
  lines,
  activeIndex,
  onSeekTo,
  onPlayRange,
}: {
  lines: LyricLine[];
  activeIndex: number;
  onSeekTo?: (ms: number) => void;
  onPlayRange?: (startMs: number, endMs: number) => void;
}) {
  const insertAfter = useEditorStore((s) => s.insertAfter);
  const insertAtStart = useEditorStore((s) => s.insertAtStart);
  const undo = useUndoRedo((t) => t.undo);
  const redo = useUndoRedo((t) => t.redo);
  const pastStates = useUndoRedo((t) => t.pastStates);
  const futureStates = useUndoRedo((t) => t.futureStates);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (inField) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-center gap-1 border-b border-border/50 pb-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => undo()}
          disabled={pastStates.length === 0}
          aria-label="실행 취소"
          title="실행 취소 (Cmd+Z)"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => redo()}
          disabled={futureStates.length === 0}
          aria-label="다시 실행"
          title="다시 실행 (Cmd+Shift+Z)"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>

      {lines.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => insertAtStart()}
        >
          <Plus className="size-4" />첫 줄 위에 추가
        </Button>
      )}

      {lines.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          가사가 없습니다 — 아래 + 버튼으로 추가
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <LineEditRow
              key={line.id}
              line={line}
              active={i === activeIndex}
              onSeekTo={onSeekTo}
              onPlayRange={onPlayRange}
            />
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => insertAfter(null)}
      >
        <Plus className="size-4" />
        {lines.length === 0 ? "줄 추가" : "마지막에 줄 추가"}
      </Button>
    </div>
  );
}
