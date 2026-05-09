import { type Caption, serializeSrt } from "@remotion/captions";
import type { LyricLine } from "@/lib/types";

/**
 * Convert LyricLine[] → SRT text.
 * - Skips empty-text lines and invalid timing (endMs <= startMs).
 * - One LyricLine = one SRT entry (1-line page).
 * - Output uses standard SRT format: HH:MM:SS,mmm separator.
 */
export function lyricsToSrt(lines: LyricLine[]): string {
  const valid = lines.filter(
    (l) => l.text.trim().length > 0 && l.endMs > l.startMs,
  );
  const pages: Caption[][] = valid.map((l) => [
    {
      text: l.text,
      startMs: l.startMs,
      endMs: l.endMs,
      timestampMs: null,
      confidence: null,
    },
  ]);
  return serializeSrt({ lines: pages });
}
