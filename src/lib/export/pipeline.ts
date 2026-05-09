"use client";

import fixWebmDuration from "fix-webm-duration";
import { LyricsCanvasRenderer } from "@/lib/export/canvasRenderer";
import type { Project } from "@/lib/types";

export type ExportProgress = {
  stage: "preparing" | "recording" | "finalizing";
  pct: number;
};

export type ExportInput = {
  project: Project;
  width: number;
  height: number;
  fps: number;
  onProgress?: (p: ExportProgress) => void;
  signal?: AbortSignal;
};

const PREFERRED_MIME_TYPES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4;codecs=avc1,mp4a", // Safari 14.1+
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mt of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mt)) return mt;
  }
  return "";
}

/**
 * Export the project as a video blob (webm by default, mp4 on Safari).
 * Realtime — duration ≈ song duration.
 */
export async function exportLyricsVideo(
  input: ExportInput,
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  const { project, width, height, fps, onProgress, signal } = input;

  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder API 미지원 브라우저");
  }
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new Error("호환되는 video codec 없음");
  }

  onProgress?.({ stage: "preparing", pct: 0 });

  // ── Canvas 렌더러 ──
  const renderer = new LyricsCanvasRenderer({ width, height });
  if (project.song.coverImageBlob) {
    await renderer.loadCover(project.song.coverImageBlob);
  }

  // ── AudioContext + audio buffer ──
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(
    await project.song.audioBlob.arrayBuffer(),
  );
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;

  // AnalyserNode — frequency 시각화용
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.85;
  const freqData = new Uint8Array(analyser.frequencyBinCount); // 256

  const audioDest = audioCtx.createMediaStreamDestination();
  source.connect(analyser);
  analyser.connect(audioDest);

  const durationMs = audioBuffer.duration * 1000;
  const lines = project.lyrics.lines;

  // ── Canvas captureStream + audio combined ──
  const videoStream = renderer.canvas.captureStream(fps);
  const videoTrack = videoStream.getVideoTracks()[0];
  const audioTrack = audioDest.stream.getAudioTracks()[0];
  if (!videoTrack || !audioTrack) {
    throw new Error("video/audio track 생성 실패");
  }
  const combined = new MediaStream([videoTrack, audioTrack]);

  const recorder = new MediaRecorder(combined, {
    mimeType,
    videoBitsPerSecond: 4_500_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  let rafId: number | null = null;
  let aborted = false;

  const cleanup = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    try {
      source.stop();
    } catch {}
    try {
      audioCtx.close();
    } catch {}
    videoTrack.stop();
    audioTrack.stop();
  };

  const abort = () => {
    aborted = true;
    cleanup();
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }
  };

  if (signal) {
    if (signal.aborted) {
      abort();
      throw new Error("aborted");
    }
    signal.addEventListener("abort", abort, { once: true });
  }

  // 첫 프레임 미리 그림 (recorder 시작 전 하나라도 있어야 빈 화면 회피)
  renderer.drawFrame({
    lines,
    currentMs: 0,
    song: { title: project.song.title, artist: project.song.artist },
  });

  // ── 시작 ──
  onProgress?.({ stage: "recording", pct: 0 });
  recorder.start(1000); // 1초마다 dataavailable

  const startCtxTime = audioCtx.currentTime;
  source.start(0);

  await new Promise<void>((resolve) => {
    const tick = () => {
      if (aborted) {
        resolve();
        return;
      }
      const elapsedMs = Math.max(
        0,
        (audioCtx.currentTime - startCtxTime) * 1000,
      );
      analyser.getByteFrequencyData(freqData);
      renderer.drawFrame({
        lines,
        currentMs: elapsedMs,
        song: { title: project.song.title, artist: project.song.artist },
        frequencyData: freqData,
      });
      onProgress?.({
        stage: "recording",
        pct: Math.min(elapsedMs / durationMs, 1),
      });

      if (elapsedMs >= durationMs) {
        // 마지막 프레임 1초 더 hold — 끝부분 잘림 방지
        setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, 250);
        resolve();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  });

  if (aborted) throw new Error("aborted");

  onProgress?.({ stage: "finalizing", pct: 1 });

  // recorder 의 onstop 까지 대기
  await new Promise<void>((resolve) => {
    if (recorder.state === "inactive") {
      resolve();
      return;
    }
    recorder.onstop = () => resolve();
  });

  cleanup();

  const rawBlob = new Blob(chunks, { type: mimeType });
  const isMp4 = mimeType.includes("mp4");

  // webm 의 duration metadata 가 누락되어 Chrome 진행바가 망가지는
  // 알려진 MediaRecorder 버그 (Chromium #642012). 후처리로 주입.
  const blob = isMp4
    ? rawBlob
    : await fixWebmDuration(rawBlob, durationMs).catch((e) => {
        console.warn("[video-export] fix-webm-duration failed:", e);
        return rawBlob;
      });

  return {
    blob,
    mimeType,
    extension: isMp4 ? "mp4" : "webm",
  };
}
