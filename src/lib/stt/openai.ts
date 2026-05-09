import OpenAI from "openai";
import {
  normalizeOpenaiWhisper,
  type WhisperVerboseResponse,
} from "./normalize";
import type { SttAdapter } from "./types";

const LANG_MAP = { ko: "ko", en: "en", ja: "ja" } as const;

export const openaiWhisperAdapter: SttAdapter = {
  id: "openai-whisper-1",
  displayName: "OpenAI Whisper",
  supportsWordTimestamps: true,
  maxFileSizeMb: 25,

  async transcribe({ audio, language, apiKey, signal }) {
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const file =
      audio instanceof File
        ? audio
        : new File([audio], "audio.mp3", { type: "audio/mpeg" });

    const response = await client.audio.transcriptions.create(
      {
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word", "segment"],
        language: language === "auto" ? undefined : LANG_MAP[language],
      },
      { signal },
    );

    return normalizeOpenaiWhisper(response as unknown as WhisperVerboseResponse);
  },
};
