/**
 * Domain types — compatible with @remotion/captions Caption shape.
 * All times in milliseconds (integer).
 */

export type Caption = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
};

export type Word = Caption & {
  raw?: string;
};

export type Language = "ko" | "en" | "ja";

export type LyricLine = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  words: Word[];
  speaker?: string | null;
  language?: Language | null;
};

export type SttModelId = "openai-whisper-1";

export type Lyrics = {
  lines: LyricLine[];
  language: Language | "auto";
  source: "stt" | "srt-import" | "manual";
  sttModel?: SttModelId;
};

export type Song = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  coverImageBlob?: Blob;
  audioBlob: Blob;
  audioMime: string;
  durationMs: number;
  createdAt: number;
  updatedAt: number;
};

export type DisplayConfig = {
  fontFamily?: string;
  accentColor?: string;
  backgroundStyle: "blurred-cover" | "solid" | "gradient";
};

export type Project = {
  id: string;
  song: Song;
  lyrics: Lyrics;
  display: DisplayConfig;
};
