"use client";

import { useMemo } from "react";
import { findActiveLineIndex } from "@/lib/player/syncEngine";
import type { LyricLine } from "@/lib/types";

export function useActiveLineIndex(
  lines: LyricLine[],
  currentTimeMs: number,
): number {
  return useMemo(
    () => findActiveLineIndex(lines, currentTimeMs),
    [lines, currentTimeMs],
  );
}
