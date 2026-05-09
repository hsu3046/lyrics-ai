"use client";

const STORAGE_PREFIX = "lyrics-ai:apikey:";

export type ApiKeyId = "openai" | "elevenlabs" | "gemini";

const ENV_KEYS: Record<ApiKeyId, string | undefined> = {
  openai: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  elevenlabs: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
  gemini: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
};

export function getApiKey(id: ApiKeyId): string {
  // 1) .env.local — dev 본인 환경
  const fromEnv = ENV_KEYS[id];
  if (fromEnv) return fromEnv;
  // 2) localStorage — BYO production 흐름
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_PREFIX + id) ?? "";
}

export function setApiKey(id: ApiKeyId, value: string): void {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(STORAGE_PREFIX + id, value);
  else localStorage.removeItem(STORAGE_PREFIX + id);
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return key.replace(/.(?=.{4})/g, "*");
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
