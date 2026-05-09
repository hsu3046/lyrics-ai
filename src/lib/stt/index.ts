import { openaiWhisperAdapter } from "./openai";
import { registerAdapter } from "./registry";

registerAdapter(openaiWhisperAdapter);

export { getAdapter, listAdapters } from "./registry";
export type { SttAdapter, SttResult, TranscribeInput, TranscribeLanguage } from "./types";
