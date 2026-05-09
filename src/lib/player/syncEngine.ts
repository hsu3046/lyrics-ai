import type { LyricLine } from "@/lib/types";

/**
 * Find index of the line currently playing at tMs, or -1 if in a gap.
 * Lines must be sorted by startMs (ascending) and non-overlapping.
 * O(log n) binary search — safe to call every frame.
 */
export function findActiveLineIndex(
  lines: LyricLine[],
  tMs: number,
): number {
  if (lines.length === 0) return -1;

  let lo = 0;
  let hi = lines.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const line = lines[mid];
    if (tMs < line.startMs) hi = mid - 1;
    else if (tMs >= line.endMs) lo = mid + 1;
    else return mid;
  }
  return -1;
}
