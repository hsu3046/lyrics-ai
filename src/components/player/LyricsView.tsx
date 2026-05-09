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
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeIndex < 0) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeIndex]);

  if (lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        가사가 없습니다
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-[35vh]">
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
                  ? "scale-95 text-base font-normal text-muted-foreground opacity-25"
                  : "scale-95 text-base font-normal text-muted-foreground opacity-55"
            }`}
          >
            {line.text || <span className="opacity-30">♪</span>}
          </button>
        );
      })}
    </div>
  );
}
