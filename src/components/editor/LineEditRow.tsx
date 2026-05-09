"use client";

import { Combine, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/editor/store";
import type { LyricLine } from "@/lib/types";
import { formatTimecode, parseTimecode } from "@/lib/utils/time";

export function LineEditRow({
  line,
  active,
  onSeekTo,
  onPlayRange,
}: {
  line: LyricLine;
  active: boolean;
  onSeekTo?: (ms: number) => void;
  onPlayRange?: (startMs: number, endMs: number) => void;
}) {
  const updateText = useEditorStore((s) => s.updateText);
  const retime = useEditorStore((s) => s.retime);
  const splitLine = useEditorStore((s) => s.splitLine);
  const mergeWithNext = useEditorStore((s) => s.mergeWithNext);
  const insertAfter = useEditorStore((s) => s.insertAfter);
  const deleteLine = useEditorStore((s) => s.deleteLine);

  // 시간 input 의 편집 중 임시 값. null 이면 line 의 실제 값 표시.
  const [startEdit, setStartEdit] = useState<string | null>(null);
  const [endEdit, setEndEdit] = useState<string | null>(null);

  const commitStart = (text: string) => {
    setStartEdit(null);
    const ms = parseTimecode(text);
    if (ms === null || ms < 0) {
      toast.error("시간 형식 오류 (MM:SS.mmm)");
      return;
    }
    const dur = useEditorStore.getState().project?.song.durationMs ?? Infinity;
    if (ms > dur) {
      toast.error("시간이 노래 길이를 초과합니다");
      return;
    }
    if (ms >= line.endMs) {
      toast.error("시작 시간은 끝 시간보다 작아야 합니다");
      return;
    }
    if (ms !== line.startMs) retime(line.id, ms, line.endMs);
  };

  const commitEnd = (text: string) => {
    setEndEdit(null);
    const ms = parseTimecode(text);
    if (ms === null || ms < 0) {
      toast.error("시간 형식 오류 (MM:SS.mmm)");
      return;
    }
    const dur = useEditorStore.getState().project?.song.durationMs ?? Infinity;
    if (ms > dur) {
      toast.error("시간이 노래 길이를 초과합니다");
      return;
    }
    if (ms <= line.startMs) {
      toast.error("끝 시간은 시작 시간보다 커야 합니다");
      return;
    }
    if (ms !== line.endMs) retime(line.id, line.startMs, ms);
  };

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const composing = e.nativeEvent.isComposing || e.keyCode === 229;
    if (composing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const at = e.currentTarget.selectionStart ?? line.text.length;
      splitLine(line.id, at);
    } else if (
      e.key === "Backspace" &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0 &&
      line.text.length === 0
    ) {
      e.preventDefault();
      deleteLine(line.id);
    }
  };

  const timeInputKeyDown =
    (commit: (text: string) => void, reset: () => void) =>
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // IME 조합중 Enter — 마지막 글자 잔존 함정 (한/일/중)
      const composing = e.nativeEvent.isComposing || e.keyCode === 229;
      if (composing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commit(e.currentTarget.value);
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        reset();
        e.currentTarget.blur();
      }
    };

  return (
    <div
      className={`group flex flex-wrap items-start gap-2 rounded-md px-2 py-1.5 transition-colors ${
        active ? "bg-primary/10" : "hover:bg-muted/50"
      }`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        aria-label="이 줄만 재생"
        title="이 줄만 재생"
        onClick={() => onPlayRange?.(line.startMs, line.endMs)}
      >
        <Play className="size-3.5" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        value={startEdit ?? formatTimecode(line.startMs)}
        onChange={(e) => setStartEdit(e.target.value)}
        onFocus={(e) => {
          setStartEdit(formatTimecode(line.startMs));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={(e) => commitStart(e.currentTarget.value)}
        onKeyDown={timeInputKeyDown(commitStart, () => setStartEdit(null))}
        className="w-[78px] shrink-0 rounded-sm bg-transparent px-1 py-1 text-center font-mono text-xs tabular-nums text-muted-foreground outline-none hover:text-foreground focus:bg-background focus:ring-1 focus:ring-ring"
        title="시작 시간 (편집 가능)"
        aria-label="시작 시간"
      />
      <span className="shrink-0 select-none pt-1.5 text-xs text-muted-foreground">
        →
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={endEdit ?? formatTimecode(line.endMs)}
        onChange={(e) => setEndEdit(e.target.value)}
        onFocus={(e) => {
          setEndEdit(formatTimecode(line.endMs));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={(e) => commitEnd(e.currentTarget.value)}
        onKeyDown={timeInputKeyDown(commitEnd, () => setEndEdit(null))}
        className="w-[78px] shrink-0 rounded-sm bg-transparent px-1 py-1 text-center font-mono text-xs tabular-nums text-muted-foreground outline-none hover:text-foreground focus:bg-background focus:ring-1 focus:ring-ring"
        title="끝 시간"
        aria-label="끝 시간"
      />
      <input
        type="text"
        value={line.text}
        onChange={(e) => updateText(line.id, e.target.value)}
        onKeyDown={handleTextKeyDown}
        className="min-w-32 flex-1 rounded-sm bg-transparent px-2 py-1 text-base outline-none focus:bg-background focus:ring-1 focus:ring-ring"
        placeholder="(빈 줄)"
      />
      <div className="flex items-center gap-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="다음 줄과 합치기"
          onClick={() => mergeWithNext(line.id)}
          title="다음 줄과 합치기"
        >
          <Combine className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="아래에 줄 추가"
          onClick={() => insertAfter(line.id)}
          title="아래에 줄 추가"
        >
          <Plus className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="줄 삭제"
          onClick={() => deleteLine(line.id)}
          title="줄 삭제"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
