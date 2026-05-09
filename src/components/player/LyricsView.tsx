"use client";

import { useEffect, useRef } from "react";
import type { LyricLine } from "@/lib/types";

export function LyricsView({
  lines,
  activeIndex,
  onSeekTo,
}: {
  lines: LyricLine[];
  activeIndex: number;
  onSeekTo?: (ms: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // 직접 컨테이너 scrollBy — scrollIntoView 는 조상 (페이지) 까지 끌고감
  useEffect(() => {
    const container = containerRef.current;
    const target = activeRef.current;
    if (!container || !target || activeIndex < 0) return;
    const cr = container.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    const delta = tr.top - cr.top - cr.height / 2 + tr.height / 2;
    container.scrollBy({ top: delta, behavior: "smooth" });
  }, [activeIndex]);

  if (lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        가사가 없습니다
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="no-scrollbar flex h-full flex-col items-center gap-3 overflow-y-auto px-4 py-[35vh]"
    >
      {lines.map((line, i) => {
        const active = i === activeIndex;
        const passed = activeIndex >= 0 && i < activeIndex;
        return (
          <button
            type="button"
            key={line.id}
            ref={active ? activeRef : null}
            onClick={() => onSeekTo?.(line.startMs)}
            style={{
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDuration: "1100ms",
              transitionProperty:
                "opacity, transform, color, font-size, font-weight",
            }}
            className={`rounded-lg px-4 py-1 text-center will-change-[opacity,transform] ${
              active
                ? "scale-110 text-2xl font-bold text-foreground opacity-100"
                : passed
                  ? "scale-95 text-lg font-normal text-muted-foreground opacity-25"
                  : "scale-95 text-lg font-normal text-muted-foreground opacity-55"
            }`}
          >
            {line.text || <span className="opacity-30">♪</span>}
          </button>
        );
      })}
    </div>
  );
}
