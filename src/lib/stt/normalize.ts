import { ulid } from "ulid";
import type { LyricLine, Word } from "@/lib/types";
import type { SttResult } from "./types";

// ── gpt-4o-transcribe-diarize: diarized_json 응답 ──
type DiarizedSegment = {
  text: string;
  start: number;
  end: number;
  speaker?: string;
};
export type DiarizedResponse = {
  segments: DiarizedSegment[];
  language?: string;
  duration?: number;
};

/** Convert gpt-4o-transcribe-diarize diarized_json → LyricLine[]. Segment-level only. */
export function normalizeDiarized(resp: DiarizedResponse): SttResult {
  const lines: LyricLine[] = (resp.segments ?? [])
    .filter((s) => s.text && s.text.trim().length > 0)
    .map((s) => ({
      id: ulid(),
      text: s.text.trim(),
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      words: [],
      speaker: s.speaker ?? null,
      language: null,
    }));
  return { lines, detectedLanguage: resp.language };
}

// ── whisper-1: verbose_json 응답 (legacy, kept for fallback) ──

type WhisperWord = { word: string; start: number; end: number };
type WhisperSegment = {
  text: string;
  start: number;
  end: number;
  words?: WhisperWord[];
};
export type WhisperVerboseResponse = {
  text: string;
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
  words?: WhisperWord[];
};

const toMs = (s: number) => Math.round(s * 1000);

function wordToken(w: WhisperWord): Word {
  return {
    text: w.word,
    startMs: toMs(w.start),
    endMs: toMs(w.end),
    timestampMs: null,
    confidence: null,
  };
}

/** Convert OpenAI Whisper verbose_json response → LyricLine[]. */
export function normalizeOpenaiWhisper(resp: WhisperVerboseResponse): SttResult {
  const segments = resp.segments ?? [];
  const allWords = resp.words ?? [];

  // No segments — fall back to single-line whole transcript with word timings.
  if (segments.length === 0) {
    const startMs = toMs(allWords[0]?.start ?? 0);
    const endMs = toMs(allWords[allWords.length - 1]?.end ?? 0);
    return {
      lines: [
        {
          id: ulid(),
          text: resp.text.trim(),
          startMs,
          endMs,
          words: allWords.map(wordToken),
          language: null,
        },
      ],
      detectedLanguage: resp.language,
    };
  }

  const lines: LyricLine[] = segments.map((seg) => {
    // Prefer per-segment words; otherwise filter from global words by time range.
    const segWords =
      seg.words ??
      allWords.filter((w) => w.start >= seg.start && w.end <= seg.end);
    return {
      id: ulid(),
      text: seg.text.trim(),
      startMs: toMs(seg.start),
      endMs: toMs(seg.end),
      words: segWords.map(wordToken),
      language: null,
    };
  });

  return { lines, detectedLanguage: resp.language };
}
