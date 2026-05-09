import type { LyricLine, SttModelId } from "@/lib/types";

export type TranscribeLanguage = "auto" | "ko" | "en" | "ja";

export type TranscribeInput = {
  audio: Blob;
  language: TranscribeLanguage;
  apiKey: string;
  signal?: AbortSignal;
};

export type SttResult = {
  lines: LyricLine[];
  detectedLanguage?: string;
};

export interface SttAdapter {
  id: SttModelId;
  displayName: string;
  supportsWordTimestamps: boolean;
  /** Provider-side max upload size in megabytes. 0 means no documented limit. */
  maxFileSizeMb: number;
  transcribe(input: TranscribeInput): Promise<SttResult>;
}
