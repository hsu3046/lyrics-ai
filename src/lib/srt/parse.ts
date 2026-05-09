import { parseSrt } from "@remotion/captions";
import { ulid } from "ulid";
import type { LyricLine } from "@/lib/types";

/** Parse SRT text into LyricLine[]. Each SRT entry becomes one line; words are empty (segment-level only). */
export function parseSrtToLines(srtText: string): LyricLine[] {
  const { captions } = parseSrt({ input: srtText });
  return captions.map((c) => ({
    id: ulid(),
    text: c.text,
    startMs: c.startMs,
    endMs: c.endMs,
    words: [],
    language: null,
  }));
}
