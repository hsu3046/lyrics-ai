"use client";

import { Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ExportProgress,
  exportLyricsVideo,
} from "@/lib/export/pipeline";
import {
  exportLyricsVideoFast,
  type FastExportProgress,
  isFastExportSupported,
} from "@/lib/export/pipelineFast";
import type { Project } from "@/lib/types";

type Resolution = "1080x1920" | "720x1280" | "1920x1080" | "1280x720";

const RESOLUTION_LABELS: Record<Resolution, string> = {
  "1080x1920": "세로 1080×1920 (FHD)",
  "720x1280": "세로 720×1280 (HD)",
  "1920x1080": "가로 1920×1080 (FHD)",
  "1280x720": "가로 1280×720 (HD)",
};

function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "lyrics-video";
}

function buildFilename(project: Project, ext: string): string {
  const title = safeFilename(project.song.title);
  if (project.song.artist) {
    return `${safeFilename(project.song.artist)} - ${title}.${ext}`;
  }
  return `${title}.${ext}`;
}

type CombinedProgress = {
  stage: string;
  pct: number;
};

const STAGE_LABEL: Record<string, string> = {
  preparing: "준비 중",
  analyzing: "오디오 분석",
  recording: "생성 중",
  rendering: "생성 중",
  "encoding-audio": "오디오 인코딩",
  finalizing: "마무리 중",
};

export function VideoExportButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CombinedProgress>({
    stage: "preparing",
    pct: 0,
  });
  const [resolution, setResolution] = useState<Resolution>("1080x1920");
  const [fastMode, setFastMode] = useState<boolean>(() =>
    isFastExportSupported(),
  );
  const abortRef = useRef<AbortController | null>(null);

  const fastSupported = isFastExportSupported();
  const lineCount = project.lyrics.lines.length;
  const disabled = lineCount === 0;

  const run = async () => {
    if (busy) return;
    const [width, height] = resolution.split("x").map(Number);

    setBusy(true);
    setProgress({ stage: "preparing", pct: 0 });
    abortRef.current = new AbortController();

    try {
      const useFast = fastMode && fastSupported;
      const { blob, extension } = useFast
        ? await exportLyricsVideoFast({
            project,
            width,
            height,
            fps: 30,
            onProgress: (p: FastExportProgress) =>
              setProgress({ stage: p.stage, pct: p.pct }),
            signal: abortRef.current.signal,
          })
        : await exportLyricsVideo({
            project,
            width,
            height,
            fps: 30,
            onProgress: (p: ExportProgress) =>
              setProgress({ stage: p.stage, pct: p.pct }),
            signal: abortRef.current.signal,
          });

      const url = URL.createObjectURL(blob);
      const filename = buildFilename(project, extension);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`다운로드 — ${filename}`, { id: "video-export" });
      setOpen(false);
    } catch (e) {
      console.error("[video-export]", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "aborted") {
        toast.info("취소됨", { id: "video-export" });
      } else {
        toast.error("영상 export 실패", {
          id: "video-export",
          description: msg,
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // 생성 중 dots 애니메이션 (`.` → `..` → `...` → 반복)
  const [animDots, setAnimDots] = useState("");
  useEffect(() => {
    if (!busy) {
      setAnimDots("");
      return;
    }
    const id = setInterval(() => {
      setAnimDots((d) => (d.length >= 3 ? "" : `${d}.`));
    }, 400);
    return () => clearInterval(id);
  }, [busy]);

  const stageLabelText = STAGE_LABEL[progress.stage] ?? "처리 중";

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    // 닫기 시도 — busy 면 confirm
    if (busy) {
      const ok = window.confirm(
        "영상 생성 중입니다. 정말 취소하시겠습니까?",
      );
      if (!ok) return;
      abortRef.current?.abort();
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <Video className="size-4" />
          영상<span className="hidden sm:inline"> 생성</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>영상 생성</DialogTitle>
        </DialogHeader>

        {!busy ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="res-select">해상도</Label>
              <Select
                value={resolution}
                onValueChange={(v) => setResolution(v as Resolution)}
              >
                <SelectTrigger id="res-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RESOLUTION_LABELS) as Resolution[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RESOLUTION_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fastSupported ? (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
                <input
                  type="checkbox"
                  checked={fastMode}
                  onChange={(e) => setFastMode(e.target.checked)}
                  className="mt-0.5 size-4 cursor-pointer"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    고속 모드 (5-10× 빠름)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    WebCodecs 직접 인코딩 — 3분 곡 ≈ 30-60초. mp4 출력.
                  </span>
                </div>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                ⚠ 이 브라우저는 고속 모드 미지원. realtime 캡처 (3분 곡 ≈ 3분).
              </p>
            )}
            {fastSupported && !fastMode && (
              <p className="text-xs text-muted-foreground">
                ⚠ realtime 모드 — 곡 전체 길이만큼 시간 소요. 탭 활성 유지.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <Progress value={progress.pct * 100} />
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>
                {stageLabelText}
                <span aria-hidden className="ml-0.5 inline-block">
                  <span className={animDots.length >= 1 ? "" : "opacity-0"}>
                    .
                  </span>
                  <span className={animDots.length >= 2 ? "" : "opacity-0"}>
                    .
                  </span>
                  <span className={animDots.length >= 3 ? "" : "opacity-0"}>
                    .
                  </span>
                </span>
              </span>
              <span className="font-mono tabular-nums">
                {(progress.pct * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          {!busy && (
            <Button onClick={run} disabled={disabled}>
              시작
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
