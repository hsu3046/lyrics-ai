"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

export type PlaybackState = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  toggle: () => void;
  seek: (ms: number) => void;
  /** Play from startMs and auto-pause when reaching endMs. */
  playRange: (startMs: number, endMs: number) => void;
};

export function useAudioPlayback(): PlaybackState {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const rangeEndMsRef = useRef<number | null>(null);

  const cancelRaf = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      if (!audioRef.current) return;
      const ms = Math.round(audioRef.current.currentTime * 1000);
      setCurrentTimeMs(ms);
      // 구간 재생 종료 감지
      if (rangeEndMsRef.current !== null && ms >= rangeEndMsRef.current) {
        rangeEndMsRef.current = null;
        audioRef.current.pause();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const onPlay = () => {
      setIsPlaying(true);
      cancelRaf();
      rafRef.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setIsPlaying(false);
      cancelRaf();
    };
    const onEnded = () => {
      setIsPlaying(false);
      cancelRaf();
    };
    const onLoadedMetadata = () => {
      setDurationMs(Math.round(audio.duration * 1000));
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    if (audio.readyState >= 1 && audio.duration) {
      setDurationMs(Math.round(audio.duration * 1000));
    }

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      cancelRaf();
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      console.error("[useAudioPlayback] audioRef is null");
      return;
    }
    rangeEndMsRef.current = null; // manual toggle 시 구간 재생 해제
    if (audio.paused) {
      audio.play().catch((err) => {
        console.error("[useAudioPlayback] play() failed:", err, {
          src: audio.src,
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error,
        });
      });
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    rangeEndMsRef.current = null; // manual seek 시 구간 재생 해제
    audio.currentTime = ms / 1000;
    setCurrentTimeMs(ms);
  }, []);

  const playRange = useCallback((startMs: number, endMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    rangeEndMsRef.current = endMs;
    audio.currentTime = startMs / 1000;
    setCurrentTimeMs(startMs);
    audio.play().catch((err) => {
      console.error("[useAudioPlayback] playRange() failed:", err);
      rangeEndMsRef.current = null;
    });
  }, []);

  return {
    audioRef,
    isPlaying,
    currentTimeMs,
    durationMs,
    toggle,
    seek,
    playRange,
  };
}
