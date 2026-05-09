export function formatMmSs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parse "MM:SS.mmm" / "M:SS.mmm" / "MM:SS" / raw ms integer → milliseconds.
 * Returns null on invalid input.
 */
export function parseTimecode(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // "MM:SS.mmm"
  const full = trimmed.match(/^(\d+):(\d+)\.(\d{1,3})$/);
  if (full) {
    const m = Number.parseInt(full[1], 10);
    const s = Number.parseInt(full[2], 10);
    const ms = Number.parseInt(full[3].padEnd(3, "0").slice(0, 3), 10);
    if (s >= 60) return null;
    return m * 60000 + s * 1000 + ms;
  }

  // "MM:SS"
  const partial = trimmed.match(/^(\d+):(\d+)$/);
  if (partial) {
    const m = Number.parseInt(partial[1], 10);
    const s = Number.parseInt(partial[2], 10);
    if (s >= 60) return null;
    return m * 60000 + s * 1000;
  }

  // raw ms integer
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return null;
}

/**
 * SRT-aligned timecode: MM:SS.mmm (3-digit milliseconds).
 * Use for player progress bar, lyric line timestamps.
 * SRT export converts the dot separator to a comma automatically.
 */
export function formatTimecode(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
}
