"use client";

import FFT from "fft.js";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { LyricsCanvasRenderer } from "@/lib/export/canvasRenderer";
import type { Project } from "@/lib/types";

const FFT_SIZE = 512;
const FREQ_BINS = 256; // FFT_SIZE / 2
const FFT_SMOOTHING = 0.85; // AnalyserNode.smoothingTimeConstant 와 동등
const HANNING = (() => {
  const w = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }
  return w;
})();

/** Audio buffer 의 frame 별 frequency data (Uint8Array length=256) 사전 계산. */
async function precomputeFreqData(
  audioBuffer: AudioBuffer,
  fps: number,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array[]> {
  const sampleRate = audioBuffer.sampleRate;
  const totalSamples = audioBuffer.length;
  const totalFrames = Math.ceil(audioBuffer.duration * fps);

  // mid signal (stereo → mono mix)
  const ch0 = audioBuffer.getChannelData(0);
  const ch1 =
    audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
  const mid = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    mid[i] = (ch0[i] + ch1[i]) * 0.5;
  }

  const fft = new FFT(FFT_SIZE);
  const out = fft.createComplexArray();
  const input = new Float32Array(FFT_SIZE);
  const result: Uint8Array[] = new Array(totalFrames);
  const prev = new Uint8Array(FREQ_BINS);

  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    const startSample = Math.floor(t * sampleRate);

    // Hanning window 적용
    for (let j = 0; j < FFT_SIZE; j++) {
      const idx = startSample + j;
      input[j] = idx < totalSamples ? mid[idx] * HANNING[j] : 0;
    }

    fft.realTransform(out, input);
    // out 의 0..FFT_SIZE/2 만 unique. complex 는 [re, im, re, im, ...] 로 저장.

    const freqData = new Uint8Array(FREQ_BINS);
    for (let k = 0; k < FREQ_BINS; k++) {
      const re = out[k * 2];
      const im = out[k * 2 + 1];
      const mag = Math.sqrt(re * re + im * im);
      // log scale + scaling — AnalyserNode 출력값에 가깝도록
      const scaled = Math.log10(mag + 1) * 70;
      const norm = Math.max(0, Math.min(255, Math.round(scaled)));
      // smoothing
      freqData[k] = Math.round(
        FFT_SMOOTHING * prev[k] + (1 - FFT_SMOOTHING) * norm,
      );
    }
    prev.set(freqData);
    result[f] = freqData;

    // 매 60 frame 마다 progress + UI yield + abort check
    if (f % 60 === 0) {
      onProgress?.(f / totalFrames);
      if (signal?.aborted) throw new Error("aborted");
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return result;
}

export type FastExportProgress = {
  stage:
    | "preparing"
    | "analyzing"
    | "rendering"
    | "encoding-audio"
    | "finalizing";
  pct: number;
};

export type FastExportInput = {
  project: Project;
  width: number;
  height: number;
  fps: number;
  onProgress?: (p: FastExportProgress) => void;
  signal?: AbortSignal;
};

export function isFastExportSupported(): boolean {
  return (
    typeof globalThis.VideoEncoder !== "undefined" &&
    typeof globalThis.AudioEncoder !== "undefined" &&
    typeof globalThis.VideoFrame !== "undefined" &&
    typeof globalThis.AudioData !== "undefined"
  );
}

/** WebCodecs 기반 fast export — Chrome 110+. realtime 5-10배 빠름. */
export async function exportLyricsVideoFast(
  input: FastExportInput,
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  if (!isFastExportSupported()) {
    throw new Error("WebCodecs API 미지원 — 고속 모드 사용 불가");
  }

  const { project, width, height, fps, onProgress, signal } = input;

  // ── 1. Canvas 렌더러 + cover ──
  onProgress?.({ stage: "preparing", pct: 0 });
  const renderer = new LyricsCanvasRenderer({ width, height });
  if (project.song.coverImageBlob) {
    await renderer.loadCover(project.song.coverImageBlob);
  }

  // ── 2. Audio decode ──
  const decodeCtx = new AudioContext();
  let audioBuffer = await decodeCtx.decodeAudioData(
    await project.song.audioBlob.arrayBuffer(),
  );
  await decodeCtx.close();

  // AAC encoder 는 44100 / 48000 만 지원 — 다른 rate 면 OfflineAudioContext 로 resample
  const AAC_SUPPORTED = new Set([44100, 48000]);
  if (!AAC_SUPPORTED.has(audioBuffer.sampleRate)) {
    const targetRate = 48000;
    const targetLength = Math.ceil(
      (audioBuffer.length * targetRate) / audioBuffer.sampleRate,
    );
    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      targetLength,
      targetRate,
    );
    const src = offlineCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(offlineCtx.destination);
    src.start(0);
    audioBuffer = await offlineCtx.startRendering();
  }

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const totalDurationSec = audioBuffer.duration;
  const totalFrames = Math.ceil(totalDurationSec * fps);

  // ── 2.5. FFT 사전 계산 — 각 frame 의 frequency data ──
  onProgress?.({ stage: "analyzing", pct: 0 });
  const frameFreqDatas = await precomputeFreqData(
    audioBuffer,
    fps,
    (p) => onProgress?.({ stage: "analyzing", pct: p }),
    signal,
  );

  // ── 3. Muxer ──
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width,
      height,
      frameRate: fps,
    },
    audio: {
      codec: "aac",
      sampleRate,
      numberOfChannels,
    },
    fastStart: "in-memory",
  });

  // ── 4. Video Encoder ──
  // H.264 codec — 해상도에 맞는 level 동적 선택.
  // 1080p 는 level 4.0 (0x28), 720p 는 level 3.1 (0x1F) 도 가능.
  // 안전하게 Baseline → Main → High 순으로 시도.
  const baseConfig = {
    width,
    height,
    bitrate: 5_000_000,
    framerate: fps,
  };
  const codecCandidates = [
    "avc1.42E028", // Baseline L4.0 — 1080p 커버
    "avc1.4D0028", // Main L4.0
    "avc1.640028", // High L4.0
    "avc1.42E032", // Baseline L5.0 — 4K fallback
  ];
  let chosenCodec: string | null = null;
  for (const codec of codecCandidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        ...baseConfig,
      });
      if (support.supported) {
        chosenCodec = support.config?.codec ?? codec;
        break;
      }
    } catch {
      // try next
    }
  }
  if (!chosenCodec) {
    throw new Error(
      `${width}×${height} 해상도를 지원하는 H.264 codec 없음`,
    );
  }

  let videoEncoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) =>
      muxer.addVideoChunk(chunk, meta as EncodedVideoChunkMetadata | undefined),
    error: (e) => {
      videoEncoderError = e;
      // abort 후 close() 가 trigger 한 에러는 무시
      if (!signal?.aborted) {
        console.error("[fast-export] video encoder error:", e);
      }
    },
  });
  videoEncoder.configure({ codec: chosenCodec, ...baseConfig });

  // ── 5. Audio Encoder ──
  let audioEncoderError: Error | null = null;
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) =>
      muxer.addAudioChunk(chunk, meta as EncodedAudioChunkMetadata | undefined),
    error: (e) => {
      audioEncoderError = e;
      if (!signal?.aborted) {
        console.error("[fast-export] audio encoder error:", e);
      }
    },
  });
  audioEncoder.configure({
    codec: "mp4a.40.2", // AAC LC
    sampleRate,
    numberOfChannels,
    bitrate: 128_000,
  });

  // encoders/renderer cleanup — finally 에서 항상 실행 (abort/error 방어)
  let finalized = false;
  const closeEncoders = () => {
    try {
      videoEncoder.close();
    } catch {}
    try {
      audioEncoder.close();
    } catch {}
  };

  try {
    if (signal?.aborted) throw new Error("aborted");

    // ── 6. Video frames 인코딩 ──
    onProgress?.({ stage: "rendering", pct: 0 });
    const frameDurationUs = Math.round(1_000_000 / fps);
    const lines = project.lyrics.lines;
    const song = { title: project.song.title, artist: project.song.artist };

    // 첫 프레임 미리
    renderer.drawFrame({
      lines,
      currentMs: 0,
      song,
      frequencyData: frameFreqDatas[0],
    });

    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) throw new Error("aborted");
      if (videoEncoderError) throw videoEncoderError;

      const currentMs = (i / fps) * 1000;
      renderer.drawFrame({
        lines,
        currentMs,
        song,
        frequencyData: frameFreqDatas[i],
      });

      const frame = new VideoFrame(renderer.canvas, {
        timestamp: i * frameDurationUs,
        duration: frameDurationUs,
      });

      // 매 2초마다 keyframe (자유 시킹 가능)
      videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();

      // backpressure — queue 너무 크면 yield
      if (videoEncoder.encodeQueueSize > 30) {
        await new Promise((r) => setTimeout(r, 0));
      }

      if (i % 10 === 0) {
        onProgress?.({ stage: "rendering", pct: i / totalFrames });
      }
    }

    // ── 7. Audio 인코딩 — 1초씩 chunk ──
    onProgress?.({ stage: "encoding-audio", pct: 0 });

    // f32-planar layout: [ch0_samples..., ch1_samples..., ...]
    const CHUNK_SAMPLES = sampleRate; // 1초
    for (let pos = 0; pos < totalSamples; pos += CHUNK_SAMPLES) {
      if (signal?.aborted) throw new Error("aborted");
      if (audioEncoderError) throw audioEncoderError;

      const len = Math.min(CHUNK_SAMPLES, totalSamples - pos);
      const data = new Float32Array(len * numberOfChannels);
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        // f32-planar: 각 채널이 연속 배치
        data.set(channelData.subarray(pos, pos + len), ch * len);
      }

      const audioData = new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: len,
        numberOfChannels,
        timestamp: Math.round((pos / sampleRate) * 1_000_000),
        data,
      });
      audioEncoder.encode(audioData);
      audioData.close();

      onProgress?.({ stage: "encoding-audio", pct: pos / totalSamples });
    }

    // ── 8. Flush + finalize ──
    onProgress?.({ stage: "finalizing", pct: 1 });

    await videoEncoder.flush();
    await audioEncoder.flush();
    closeEncoders();

    if (videoEncoderError) throw videoEncoderError;
    if (audioEncoderError) throw audioEncoderError;

    muxer.finalize();
    finalized = true;
    const target = muxer.target as ArrayBufferTarget;
    const blob = new Blob([target.buffer], { type: "video/mp4" });

    return { blob, mimeType: "video/mp4", extension: "mp4" };
  } finally {
    if (!finalized) closeEncoders();
  }
}
