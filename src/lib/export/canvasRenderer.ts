"use client";

import type { LyricLine } from "@/lib/types";

export type RenderOptions = {
  width: number;
  height: number;
};

export type SongLabel = {
  title: string;
  artist?: string;
};

const FALLBACK_FONT_STACK =
  '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, -apple-system, sans-serif';

/** Canvas 렌더러 — blurred cover bg + cover + title/artist + lyrics. */
export class LyricsCanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: RenderOptions;
  private coverImg: HTMLImageElement | null = null;
  private blurredCover: HTMLCanvasElement | null = null;

  constructor(opts: RenderOptions) {
    this.opts = opts;
    this.canvas = document.createElement("canvas");
    this.canvas.width = opts.width;
    this.canvas.height = opts.height;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
  }

  /** Load cover image and pre-render blurred background. */
  async loadCover(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      this.coverImg = img;

      const blur = document.createElement("canvas");
      blur.width = this.opts.width;
      blur.height = this.opts.height;
      const bctx = blur.getContext("2d");
      if (bctx) {
        bctx.fillStyle = "#0a0a0a";
        bctx.fillRect(0, 0, blur.width, blur.height);
        bctx.filter = `blur(${Math.round(this.opts.width * 0.06)}px)`;
        const ratio = Math.max(
          this.opts.width / img.width,
          this.opts.height / img.height,
        ) * 1.1;
        const w = img.width * ratio;
        const h = img.height * ratio;
        bctx.drawImage(img, (this.opts.width - w) / 2, (this.opts.height - h) / 2, w, h);
        this.blurredCover = blur;
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  drawFrame(opts: {
    lines: LyricLine[];
    activeIdx: number;
    song: SongLabel;
  }): void {
    const { ctx } = this;
    const { width, height } = this.opts;

    // 1. 검정 배경
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, width, height);

    // 2. blurred cover 배경 (반투명)
    if (this.blurredCover) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.blurredCover, 0, 0);
      ctx.globalAlpha = 1;
    }

    // 3. 앨범커버 — 화면 위쪽 1/3 영역에 정사각형
    const coverSize = Math.min(width, height) * 0.5;
    const coverX = (width - coverSize) / 2;
    const coverY = height * 0.08;
    if (this.coverImg) {
      ctx.save();
      this.roundedPath(coverX, coverY, coverSize, coverSize, coverSize * 0.04);
      ctx.clip();
      ctx.drawImage(this.coverImg, coverX, coverY, coverSize, coverSize);
      ctx.restore();
    } else {
      ctx.fillStyle = "#262626";
      this.roundedPath(coverX, coverY, coverSize, coverSize, coverSize * 0.04);
      ctx.fill();
    }

    // 4. 제목 / 아티스트
    const baseFontSize = Math.round(width * 0.038);
    const titleY = coverY + coverSize + Math.round(width * 0.06);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${baseFontSize}px ${FALLBACK_FONT_STACK}`;
    ctx.fillText(opts.song.title, width / 2, titleY, width * 0.85);

    if (opts.song.artist) {
      const artistFont = Math.round(width * 0.024);
      ctx.font = `400 ${artistFont}px ${FALLBACK_FONT_STACK}`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(
        opts.song.artist,
        width / 2,
        titleY + Math.round(width * 0.05),
        width * 0.85,
      );
    }

    // 5. 가사 — active ±2 라인
    const lyricCenterY = titleY + Math.round(width * 0.22);
    const activeFontSize = Math.round(width * 0.04);
    const inactiveFontSize = Math.round(width * 0.026);
    const lineGap = activeFontSize * 1.6;

    for (let offset = -2; offset <= 2; offset++) {
      const idx = opts.activeIdx + offset;
      if (idx < 0 || idx >= opts.lines.length) continue;
      const line = opts.lines[idx];
      if (!line.text.trim()) continue;
      const isActive = offset === 0;
      const y = lyricCenterY + offset * lineGap;

      const fontSize = isActive ? activeFontSize : inactiveFontSize;
      const weight = isActive ? 700 : 400;
      const distance = Math.abs(offset);
      const alpha = isActive ? 1 : Math.max(0.15, 0.5 - distance * 0.15);

      ctx.font = `${weight} ${fontSize}px ${FALLBACK_FONT_STACK}`;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(line.text, width / 2, y, width * 0.9);
    }
  }

  private roundedPath(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
