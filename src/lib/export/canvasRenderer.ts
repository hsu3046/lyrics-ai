"use client";

import type { LyricLine } from "@/lib/types";

export type RenderOptions = {
  width: number;
  height: number;
};

export type RGB = { r: number; g: number; b: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 이미지의 vibrant 한 dominant 색 추출 (단순 평균 + saturation 보정). */
function extractDominantColor(img: HTMLImageElement): RGB {
  const SAMPLE = 60;
  const c = document.createElement("canvas");
  c.width = SAMPLE;
  c.height = SAMPLE;
  const cx = c.getContext("2d");
  if (!cx) return { r: 250, g: 250, b: 250 };
  cx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const data = cx.getImageData(0, 0, SAMPLE, SAMPLE).data;

  // 채도 가중 평균 (회색 픽셀은 가중치 ↓)
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let weightSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lightness = (max + min) / 2 / 255;
    // 너무 어둡거나 너무 밝은 픽셀 + 회색 픽셀 가중치 ↓
    if (lightness < 0.1 || lightness > 0.95) continue;
    const weight = 0.2 + sat * 0.8;
    rSum += r * weight;
    gSum += g * weight;
    bSum += b * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return { r: 250, g: 250, b: 250 };

  let r = Math.round(rSum / weightSum);
  let g = Math.round(gSum / weightSum);
  let b = Math.round(bSum / weightSum);

  // 너무 어두우면 lighten
  const max = Math.max(r, g, b);
  if (max < 140) {
    const k = 140 / max;
    r = Math.min(255, Math.round(r * k));
    g = Math.min(255, Math.round(g * k));
    b = Math.min(255, Math.round(b * k));
  }
  return { r, g, b };
}

export type SongLabel = {
  title: string;
  artist?: string;
};

const FALLBACK_FONT_STACK =
  '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", system-ui, -apple-system, sans-serif';

/** Canvas 렌더러 — blurred cover bg + cover + title/artist + lyrics. */
export class LyricsCanvasRenderer {
  /** 가사 active 기준 위쪽으로 그릴 라인 수 (Apple Music 처럼 위는 적게) */
  private static readonly LYRIC_RANGE_TOP = 2.0;
  /** 아래쪽으로 그릴 라인 수 (다음 가사를 더 미리 보임) */
  private static readonly LYRIC_RANGE_BOTTOM = 3.5;

  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly opts: RenderOptions;
  private coverImg: HTMLImageElement | null = null;
  private blurredCover: HTMLCanvasElement | null = null;
  private dominantColor: RGB = { r: 250, g: 250, b: 250 };

  constructor(opts: RenderOptions) {
    this.opts = opts;
    this.canvas = document.createElement("canvas");
    this.canvas.width = opts.width;
    this.canvas.height = opts.height;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
  }

  /** Load cover image and pre-render blurred background + dominant color. */
  async loadCover(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      this.coverImg = img;
      this.dominantColor = extractDominantColor(img);

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
   * - 라인 끝 직후 FADE_MS 동안: smoothstep 으로 i → i+1 보간
   * - FADE_MS 이후 ~ next 시작: i+1 hold (다음 라인 위치 미리)
   * - gap 이 FADE_MS 보다 짧으면 그 gap 동안 보간 (cap)
   * - 첫 라인 시작 전 FADE_MS 동안: -1 → 0 보간
   *
   * 가사 사이 gap 길이와 무관하게 일정한 transition duration.
   */
  private computeEffectiveIdx(lines: LyricLine[], tMs: number): number {
    if (lines.length === 0) return 0;
    const FADE_MS = 600;

    // 1) 현재 라인 안에 있나
    for (let i = 0; i < lines.length; i++) {
      if (tMs >= lines[i].startMs && tMs < lines[i].endMs) return i;
    }

    // 2) 첫 라인 시작 전 — 시작 직전 FADE_MS 동안 fade-in
    if (tMs < lines[0].startMs) {
      const lead = lines[0].startMs - tMs;
      if (lead <= FADE_MS) {
        const p = (FADE_MS - lead) / FADE_MS;
        return -1 + smoothstep(clamp01(p));
      }
      return -1;
    }

    // 3) gap — 직전 라인 i 끝난 직후 FADE_MS 동안 i → i+1 로 transition
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
    // gap 이 FADE_MS 보다 짧으면 next.startMs 로 cap
    const transitionEnd = Math.min(transitionStart + FADE_MS, next.startMs);
    if (tMs <= transitionStart) return baseIdx;
    if (tMs >= transitionEnd) return baseIdx + 1; // FADE_MS 후 ~ next 시작 까지 hold

    const p = (tMs - transitionStart) / (transitionEnd - transitionStart);
    return baseIdx + smoothstep(clamp01(p));
  }

  drawFrame(opts: {
    lines: LyricLine[];
    currentMs: number;
    song: SongLabel;
    /** AnalyserNode.getByteFrequencyData 결과 — undefined 면 EQ 안 그림 */
    frequencyData?: Uint8Array;
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
    frequencyData?: Uint8Array;
  }): void {
    const { width, height } = this.opts;

    const coverSize = Math.min(width, height) * 0.5;
    const coverX = (width - coverSize) / 2;
    const coverY = height * 0.08;

    // 원형 EQ — cover 그리기 전에 (cover 가 EQ 위에 살짝 덮음)
    if (opts.frequencyData) {
      const cx = coverX + coverSize / 2;
      const cy = coverY + coverSize / 2;
      const baseR = coverSize / 2;
      this.drawCircularEQ(cx, cy, baseR, coverSize, opts.frequencyData);
    }

    this.drawCover(coverX, coverY, coverSize);

    const titleSize = Math.round(width * 0.05);
    const artistSize = Math.round(width * 0.032);
    // cover 와 title 사이 여백 — 충분히 떨어뜨림
    const titleY = coverY + coverSize + Math.round(width * 0.12);
    this.drawTitle(opts.song, width / 2, titleY, width * 0.85, width);

    // 가사 영역의 위쪽 limit — title/artist 끝 + 안전 마진. 위쪽 라인이 침범 X.
    const hasArtist = !!opts.song.artist;
    const titleArtistBottom = hasArtist
      ? titleY + titleSize * 1.15 + artistSize / 2
      : titleY + titleSize / 2;

    const activeFont = Math.round(width * 0.04);
    const inactiveFont = Math.round(width * 0.03);
    const lineGap = activeFont * 2.5;
    const safeMargin = Math.round(width * 0.07);
    // 위쪽 RANGE 만큼만 spacer (TOP_RANGE 가 작으니 lyricCenterY 도 위로 이동)
    const minLyricCenterY =
      titleArtistBottom +
      safeMargin +
      LyricsCanvasRenderer.LYRIC_RANGE_TOP * lineGap;
    // active 가 viewport 약 40% 위치 → 첫/마지막 라인 active 도 자연스러움
    const lyricCenterY = Math.max(minLyricCenterY, height * 0.5);

    this.drawLyrics(opts, {
      centerX: width / 2,
      centerY: lyricCenterY,
      maxWidth: width * 0.9,
      activeFont,
      inactiveFont,
      align: "center",
    });
  }

  // ─── 가로: 좌 cover + 우 가사 (2 컬럼) ───
  private drawLandscape(opts: {
    lines: LyricLine[];
    currentMs: number;
    song: SongLabel;
    frequencyData?: Uint8Array;
  }): void {
    const { width, height } = this.opts;

    // 좌측 컬럼: cover + title/artist (가운데 정렬)
    const leftColW = width * 0.45;
    const coverSize = Math.min(leftColW * 0.7, height * 0.6);
    const coverX = (leftColW - coverSize) / 2;
    const coverY = (height - coverSize) / 2 - height * 0.06;

    // 원형 EQ — cover 그리기 전에
    if (opts.frequencyData) {
      const cx = coverX + coverSize / 2;
      const cy = coverY + coverSize / 2;
      const baseR = coverSize / 2;
      this.drawCircularEQ(cx, cy, baseR, coverSize, opts.frequencyData);
    }

    this.drawCover(coverX, coverY, coverSize);

    const titleY = coverY + coverSize + Math.round(height * 0.07);
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
      inactiveFont: Math.round(lyricBaseSize * 0.034),
      align: "center",
    });
  }

  /** 원형 EQ bars — 최대 촘촘 + dramatic impulse. */
  private drawCircularEQ(
    centerX: number,
    centerY: number,
    baseRadius: number,
    coverSize: number,
    freqData: Uint8Array,
  ): void {
    const ctx = this.ctx;
    // 360 — 1도당 1개. perimeter 거의 ring 처럼.
    const BARS = 360;
    const halfBars = BARS / 2;
    const minLen = Math.round(coverSize * 0.012);
    const maxLen = Math.round(coverSize * 0.4);
    const { r, g, b } = this.dominantColor;

    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.5, coverSize * 0.0038); // 조금 두껍게

    // freqData 의 저음~중음 영역
    const usableLen = Math.max(16, Math.floor(freqData.length * 0.6));

    for (let i = 0; i < BARS; i++) {
      // 좌우 대칭
      const symIdx = i < halfBars ? i : BARS - 1 - i;
      // bar 가 frequency 보다 많음 → linear interpolation 으로 부드러운 ring
      const fIdx = (symIdx / halfBars) * (usableLen - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(i0 + 1, usableLen - 1);
      const t = fIdx - i0;
      const vRaw =
        ((freqData[i0] / 255) * (1 - t) + (freqData[i1] / 255) * t);
      // power 0.75 — 더 dramatic peak, idle 은 더 짧게
      const value = vRaw ** 0.75;
      const len = minLen + (maxLen - minLen) * value;

      const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
      const innerR = baseRadius;
      const outerR = baseRadius + len;

      const x1 = centerX + Math.cos(angle) * innerR;
      const y1 = centerY + Math.sin(angle) * innerR;
      const x2 = centerX + Math.cos(angle) * outerR;
      const y2 = centerY + Math.sin(angle) * outerR;

      // base 진하게 — idle 도 잘 보이고 peak 시 fully opaque
      const alpha = 0.75 + value * 0.25;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  /** 원형 커버 — EQ 와 같은 동심원으로 시각적 일관성. */
  private drawCover(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2;

    if (this.coverImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      // cover 가 정사각형이 아니어도 가로/세로 중 짧은 쪽 기준으로 채워서 잘림 방지
      const img = this.coverImg;
      const ratio = Math.max(size / img.width, size / img.height);
      const dw = img.width * ratio;
      const dh = img.height * ratio;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = "#262626";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
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
    ctx.fillStyle = "#fafafa";
    ctx.font = `700 ${titleSize}px ${FALLBACK_FONT_STACK}`;
    ctx.fillText(song.title, cx, y, maxWidth);

    if (song.artist) {
      ctx.font = `400 ${artistSize}px ${FALLBACK_FONT_STACK}`;
      ctx.fillStyle = "rgba(250,250,250,0.6)";
      ctx.fillText(song.artist, cx, y + Math.round(titleSize * 1.15), maxWidth);
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
    const RANGE_TOP = LyricsCanvasRenderer.LYRIC_RANGE_TOP;
    const RANGE_BOTTOM = LyricsCanvasRenderer.LYRIC_RANGE_BOTTOM;

    ctx.textAlign = layout.align;
    ctx.textBaseline = "middle";

    for (let i = 0; i < opts.lines.length; i++) {
      const line = opts.lines[i];
      if (!line.text.trim()) continue;

      const offset = i - effectiveIdx;
      const distance = Math.abs(offset);
      // 위/아래 RANGE 비대칭 — 위는 적게, 아래는 많이
      if (offset < -RANGE_TOP || offset > RANGE_BOTTOM) continue;

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
      ctx.fillStyle = `rgba(250,250,250,${alpha})`;
      ctx.fillText(line.text, layout.centerX, y, layout.maxWidth);
    }
  }
}
