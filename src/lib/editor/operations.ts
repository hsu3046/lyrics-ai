import { ulid } from "ulid";
import type { LyricLine } from "@/lib/types";

export function blankLine(startMs: number, endMs: number): LyricLine {
  return {
    id: ulid(),
    text: "",
    startMs,
    endMs,
    words: [],
    language: null,
  };
}

export function updateText(
  lines: LyricLine[],
  id: string,
  text: string,
): LyricLine[] {
  return lines.map((l) => (l.id === id ? { ...l, text } : l));
}

export function retime(
  lines: LyricLine[],
  id: string,
  startMs: number,
  endMs: number,
): LyricLine[] {
  return lines.map((l) =>
    l.id === id ? { ...l, startMs, endMs: Math.max(endMs, startMs + 1) } : l,
  );
}

export function deleteLine(lines: LyricLine[], id: string): LyricLine[] {
  return lines.filter((l) => l.id !== id);
}

/** Split a line at character index. Time is split proportionally to char ratio. */
export function splitLine(
  lines: LyricLine[],
  id: string,
  charIndex: number,
): LyricLine[] {
  const idx = lines.findIndex((l) => l.id === id);
  if (idx === -1) return lines;
  const line = lines[idx];
  const total = line.text.length;
  const safeIdx = Math.min(Math.max(charIndex, 0), total);
  const ratio = total > 0 ? safeIdx / total : 0.5;
  const splitMs = Math.round(
    line.startMs + (line.endMs - line.startMs) * ratio,
  );
  const first: LyricLine = {
    ...line,
    text: line.text.slice(0, safeIdx).trimEnd(),
    endMs: Math.max(splitMs, line.startMs + 1),
  };
  const second: LyricLine = {
    id: ulid(),
    text: line.text.slice(safeIdx).trimStart(),
    startMs: Math.max(splitMs, line.startMs + 1),
    endMs: line.endMs,
    words: [],
    language: line.language,
  };
  return [...lines.slice(0, idx), first, second, ...lines.slice(idx + 1)];
}

/** Merge a line with the next one. */
export function mergeWithNext(lines: LyricLine[], id: string): LyricLine[] {
  const idx = lines.findIndex((l) => l.id === id);
  if (idx === -1 || idx === lines.length - 1) return lines;
  const cur = lines[idx];
  const next = lines[idx + 1];
  const sep =
    cur.text.length === 0 || cur.text.endsWith(" ") || next.text.startsWith(" ")
      ? ""
      : " ";
  const merged: LyricLine = {
    ...cur,
    text: cur.text + sep + next.text,
    endMs: next.endMs,
    words: [...cur.words, ...next.words],
  };
  return [...lines.slice(0, idx), merged, ...lines.slice(idx + 2)];
}

/** Insert a blank line at the very start (before the first line). */
export function insertAtStart(
  lines: LyricLine[],
  defaultDurationMs = 3000,
): LyricLine[] {
  const first = lines[0];
  if (!first) return [blankLine(0, defaultDurationMs)];
  const endMs = Math.min(first.startMs, defaultDurationMs);
  return [blankLine(0, Math.max(endMs, 1)), ...lines];
}

/** Insert a blank line after the given id (or append if id is null). */
export function insertAfter(
  lines: LyricLine[],
  id: string | null,
  defaultDurationMs = 3000,
): LyricLine[] {
  if (id === null || lines.length === 0) {
    const last = lines[lines.length - 1];
    const startMs = last ? last.endMs : 0;
    return [...lines, blankLine(startMs, startMs + defaultDurationMs)];
  }
  const idx = lines.findIndex((l) => l.id === id);
  if (idx === -1) return lines;
  const cur = lines[idx];
  const next = lines[idx + 1];
  const startMs = cur.endMs;
  const endMs = next
    ? Math.min(next.startMs, startMs + defaultDurationMs)
    : startMs + defaultDurationMs;
  return [
    ...lines.slice(0, idx + 1),
    blankLine(startMs, Math.max(endMs, startMs + 1)),
    ...lines.slice(idx + 1),
  ];
}
