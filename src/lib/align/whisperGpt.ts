"use client";

import OpenAI from "openai";
import { ulid } from "ulid";
import { type WhisperVerboseResponse } from "@/lib/stt/normalize";
import type { LyricLine, Word } from "@/lib/types";

const ALIGN_MODEL = "gpt-5.4-mini-2026-03-17";

export type AlignStage = "transcribing" | "aligning";

export type AlignInput = {
  audio: Blob;
  lyrics: string;
  language: "auto" | "ko" | "en" | "ja";
  apiKey: string;
  signal?: AbortSignal;
  onProgress?: (stage: AlignStage) => void;
};

const LANG_MAP = { ko: "ko", en: "en", ja: "ja" } as const;

type AlignedWord = {
  text: string;
  startMs: number;
  endMs: number;
};
type AlignedLine = {
  text: string;
  startMs: number;
  endMs: number;
  words: AlignedWord[];
};

const ALIGN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          startMs: { type: "integer" },
          endMs: { type: "integer" },
          words: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                startMs: { type: "integer" },
                endMs: { type: "integer" },
              },
              required: ["text", "startMs", "endMs"],
            },
          },
        },
        required: ["text", "startMs", "endMs", "words"],
      },
    },
  },
  required: ["lines"],
} as const;

const SYSTEM_PROMPT = `You align USER LYRICS (accurate, line-by-line) with WHISPER WORD timestamps (chronological audio words; text may be inaccurate due to ASR errors on music vocals).

CRITICAL: Whisper's segmentation (sentence/segment boundaries) is based on silences and breaths in the audio, which DO NOT correspond to the user's intended lyric line breaks. Ignore any segment information — match purely on word-level chronology.

Output exactly N lines where N = number of non-empty user lines, in input order. Use the user's text VERBATIM (never Whisper's text — Whisper may mishear Korean/Japanese/English vocals).

For each output line:
- Split the user's line into tokens (whitespace-separated for English/Korean spaces; for Japanese, treat each character cluster as a token if no spaces).
- Assign every token a startMs/endMs derived from WHISPER WORDS by SEQUENCE POSITION (not by text similarity — Whisper's text may be wrong).
- The user may have K tokens for a line while Whisper has more/fewer overlapping audio words; distribute timings proportionally or by best monotonic mapping.
- line.startMs = words[0].startMs, line.endMs = words[last].endMs.

Constraints:
- Lines must be chronological and non-overlapping: line[i].endMs <= line[i+1].startMs.
- Words within a line must be chronological and non-overlapping.
- Whisper word ordering is the source of truth for timing — preserve it.
- For instrumental gaps with no matching audio words, interpolate timing between neighboring lines.
- All times are integer milliseconds.`;

export async function alignLyricsWithWhisperGpt({
  audio,
  lyrics,
  language,
  apiKey,
  signal,
  onProgress,
}: AlignInput): Promise<LyricLine[]> {
  const userLines = lyrics
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (userLines.length === 0) {
    throw new Error("가사가 비어있습니다");
  }

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  // ── Step 1: Whisper STT (word-level only — segment 무관) ──
  onProgress?.("transcribing");
  const file =
    audio instanceof File
      ? audio
      : new File([audio], "audio.mp3", { type: "audio/mpeg" });

  const whisperResp = await client.audio.transcriptions.create(
    {
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      language: language === "auto" ? undefined : LANG_MAP[language],
    },
    { signal },
  );

  const whisperData = whisperResp as unknown as WhisperVerboseResponse;
  const words = whisperData.words ?? [];
  if (words.length === 0) {
    throw new Error("Whisper 가 word timestamps 를 반환하지 않았습니다");
  }

  // 토큰 절약: 짧은 키 + ms 정수
  const wordTable = words.map((w) => ({
    w: w.word,
    s: Math.round(w.start * 1000),
    e: Math.round(w.end * 1000),
  }));

  // ── Step 2: GPT-5.4-mini word-level 매칭 ──
  onProgress?.("aligning");

  const userPrompt = `USER LYRICS (${userLines.length} lines, accurate text — output exactly ${userLines.length} lines in same order):
${userLines.map((l, i) => `${i + 1}. ${l}`).join("\n")}

WHISPER WORDS (${wordTable.length} chronological audio words; w=word text from ASR (may be wrong), s=startMs, e=endMs):
${JSON.stringify(wordTable)}

Return JSON: { "lines": [{ "text", "startMs", "endMs", "words": [{ "text", "startMs", "endMs" }] }] }`;

  const completion = await client.chat.completions.create(
    {
      model: ALIGN_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_completion_tokens: 8000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "aligned_lines",
          strict: true,
          schema: ALIGN_SCHEMA,
        },
      },
    },
    { signal },
  );

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 응답이 비어있습니다");
  }

  const parsed = JSON.parse(content) as { lines: AlignedLine[] };
  if (!parsed.lines || parsed.lines.length === 0) {
    throw new Error("정렬 결과가 비어있습니다");
  }

  return parsed.lines.map((l): LyricLine => {
    const wordTokens: Word[] = (l.words ?? []).map((w) => ({
      text: w.text,
      startMs: w.startMs,
      endMs: w.endMs,
      timestampMs: null,
      confidence: null,
    }));
    return {
      id: ulid(),
      text: l.text,
      startMs: l.startMs,
      endMs: l.endMs,
      words: wordTokens,
      language: null,
    };
  });
}
