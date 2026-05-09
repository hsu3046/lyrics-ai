"use client";

import type { LyricLine } from "@/lib/types";

export type RenderOptions = {
  width: number;
  height: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

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

  /**
   * 현재 시간 기준 "효과적인 표시 인덱스" — float.
   * - 라인 안: 그 라인의 정수 인덱스
   * - 라인 끝 ~ 다음 라인 시작 사이 (gap): smoothstep 으로 i → i+1 보간
   * - 첫 라인 시작 전: 첫 라인 직전 fadeMs 동안 -1 → 0 보간
   *
   * float 인덱스 → 모든 라인의 시각적 위치/투명도/폰트가 부드러운 transition.
   */
  private computeEffectiveIdx(lines: LyricLine[], tMs: number): number {
    if (lines.length === 0) return 0;
    const FADE_LEAD_MS = 500;

    // 1) 현재 라인 안에 있나
    for (let i = 0; i < lines.length; i++) {
      if (tMs >= lines[i].startMs && tMs < lines[i].endMs) return i;
    }

    // 2) 첫 라인 시작 전
    if (tMs < lines[0].startMs) {
      const lead = lines[0].startMs - tMs;
      if (lead <= FADE_LEAD_MS) {
        const p = (FADE_LEAD_MS - lead) / FADE_LEAD_MS;
        return -1 + smoothstep(Math.max(0, Math.min(1, p)));
      }
      return -1;
    }

    // 3) gap — 직전 라인 i 와 next i+1 사이 보간
    let baseIdx = lines.length - 1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].endMs <= tMs) {
        baseIdx = i;
        break;
      }
    }
    const next = lines[baseIdx + 1];
    if (!next) return baseIdx;

    const transitionStart = lines[baseIdx].endMs;
    const transitionEnd = next.startMs;
    if (tMs <= transitionStart) return baseIdx;
    if (tMs >= transitionEnd) return baseIdx + 1;

    const p = (tMs - transitionStart) / (transitionEnd - transitionStart);
    return baseIdx + smoothstep(Math.max(0, Math.min(1, p)));
  }

  drawFrame(opts: {
    lines: LyricLine[];
    currentMs: number;
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

    const isLandscape = width > height;
    if (isLandscape) {
      this.drawLandscape(opts);
    } else {
      this.drawPortrait(opts);
    }
  }

  // ─── 세로: 위 cover + 아래 가사 ───
  private drawPortrait(opts: {
    lines: LyricLine[];
    currentMs: number;
    song: SongLabel;
  }): void {
    const { ctx } = this;
    const { width, height } = this.opts;

    const coverSize = Math.min(width, height) * 0.5;
    const coverX = (width - coverSize) / 2;
    const coverY = height * 0.08;
    this.drawCover(coverX, coverY, coverSize);

    const titleY = coverY + coverSize + Math.round(width * 0.06);
    this.drawTitle(opts.song, width / 2, titleY, width * 0.85, width);

    const lyricCenterY = titleY + Math.round(width * 0.22);
    this.drawLyrics(opts, {
      centerX: width / 2,
      centerY: lyricCenterY,
      maxWidth: width * 0.9,
      activeFont: Math.round(width * 0.04),
      inactiveFont: Math.round(width * 0.026),
      align: "center",
    });
  }

  // ─── 가로: 좌 cover + 우 가사 (2 컬럼) ───
  private drawLandscape(opts: {
    lines: LyricLine[];
    currentMs: number;
    song: SongLabel;
  }): void {
    const { width, height } = this.opts;

    // 좌측 컬럼: cover + title/artist (가운데 정렬)
    const leftColW = width * 0.45;
    const coverSize = Math.min(leftColW * 0.7, height * 0.6);
    const coverX = (leftColW - coverSize) / 2;
    const coverY = (height - coverSize) / 2 - height * 0.06;
    this.drawCover(coverX, coverY, coverSize);

    const titleY = coverY + coverSize + Math.round(height * 0.05);
    this.drawTitle(
      opts.song,
      leftColW / 2,
      titleY,
      leftColW * 0.85,
      Math.min(leftColW, height),
    );

    // 우측 컬럼: 가사 (좌측 정렬, 세로 가운데)
    const rightX = leftColW;
    const rightW = width - leftColW;
    const lyricCenterY = height / 2;
    const lyricBaseSize = Math.min(rightW, height);

    this.drawLyrics(opts, {
      centerX: rightX + rightW / 2,
      centerY: lyricCenterY,
      maxWidth: rightW * 0.85,
      activeFont: Math.round(lyricBaseSize * 0.045),
      inactiveFont: Math.round(lyricBaseSize * 0.028),
      align: "center",
    });
  }

  private drawCover(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    if (this.coverImg) {
      ctx.save();
      this.roundedPath(x, y, size, size, size * 0.04);
      ctx.clip();
      ctx.drawImage(this.coverImg, x, y, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = "#262626";
      this.roundedPath(x, y, size, size, size * 0.04);
      ctx.fill();
    }
  }

  private drawTitle(
    song: SongLabel,
    cx: number,
    y: number,
    maxWidth: number,
    sizingDim: number,
  ): void {
    const ctx = this.ctx;
    const titleSize = Math.round(sizingDim * 0.05);
    const artistSize = Math.round(sizingDim * 0.032);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${titleSize}px ${FALLBACK_FONT_STACK}`;
    ctx.fillText(song.title, cx, y, maxWidth);

    if (song.artist) {
      ctx.font = `400 ${artistSize}px ${FALLBACK_FONT_STACK}`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(song.artist, cx, y + Math.round(titleSize * 1.4), maxWidth);
    }
  }

  private drawLyrics(
    opts: {
      lines: LyricLine[];
      currentMs: number;
    },
    layout: {
      centerX: number;
      centerY: number;
      maxWidth: number;
      activeFont: number;
      inactiveFont: number;
      align: CanvasTextAlign;
    },
  ): void {
    const ctx = this.ctx;
    const effectiveIdx = this.computeEffectiveIdx(opts.lines, opts.currentMs);
    const lineGap = layout.activeFont * 1.6;
    const RANGE = 3.5;

    ctx.textAlign = layout.align;
    ctx.textBaseline = "middle";

    for (let i = 0; i < opts.lines.length; i++) {
      const line = opts.lines[i];
      if (!line.text.trim()) continue;

      const offset = i - effectiveIdx;
      const distance = Math.abs(offset);
      if (distance > RANGE) continue; // 화면 밖

      // activity: 0 (inactive 멀리) → 1 (정중앙 active). 부드러운 보간.
      const activity = clamp01(1 - distance);

      // y 위치 — float offset 으로 부드러운 vertical scroll
      const y = layout.centerY + offset * lineGap;

      // font size 보간
      const fontSize = lerp(layout.inactiveFont, layout.activeFont, activity);

      // weight — 50% 임계로 bold/regular (canvas 는 정수 weight 만)
      const weight = activity > 0.5 ? 700 : 400;

      // alpha — distance 0~1 = 0.4~1.0, distance 1~3.5 = 0.4~0.05 점진 fade
      let alpha: number;
      if (distance <= 1) {
        alpha = lerp(0.4, 1, activity); // distance 0→1, distance 1→0.4
      } else {
        const farT = clamp01((distance - 1) / 2.5);
        alpha = lerp(0.4, 0.05, farT);
      }

      ctx.font = `${weight} ${fontSize}px ${FALLBACK_FONT_STACK}`;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(line.text, layout.centerX, y, layout.maxWidth);
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
