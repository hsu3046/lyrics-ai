"use client";

import { parseBlob } from "music-metadata-browser";

export type ExtractedMeta = {
  title?: string;
  artist?: string;
  album?: string;
  durationMs: number;
  coverImageBlob?: Blob;
};

export async function extractMetadata(file: File): Promise<ExtractedMeta> {
  const meta = await parseBlob(file);
  const { title, artist, album, picture } = meta.common;
  const durationMs = meta.format.duration
    ? Math.round(meta.format.duration * 1000)
    : 0;

  let coverImageBlob: Blob | undefined;
  const cover = picture?.[0];
  // SVG 는 임의 script 실행 가능 — raster 만 허용 (untrusted ID3 attachment)
  if (cover && /^image\/(jpeg|png|gif|webp|bmp)$/i.test(cover.format)) {
    const arr = new Uint8Array(cover.data);
    coverImageBlob = new Blob([arr], { type: cover.format });
  }

  return { title, artist, album, durationMs, coverImageBlob };
}
