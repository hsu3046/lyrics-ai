"use client";

import { Video } from "lucide-react";
import { useRef, useState } from "react";
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

export function VideoExportButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress>({
    stage: "preparing",
    pct: 0,
  });
  const [resolution, setResolution] = useState<Resolution>("1080x1920");
  const abortRef = useRef<AbortController | null>(null);

  const lineCount = project.lyrics.lines.length;
  const disabled = lineCount === 0;

  const run = async () => {
    if (busy) return;
    const [width, height] = resolution.split("x").map(Number);

    setBusy(true);
    setProgress({ stage: "preparing", pct: 0 });
    abortRef.current = new AbortController();
    toast.loading("영상 생성 중...", { id: "video-export" });

    try {
      const { blob, extension } = await exportLyricsVideo({
        project,
        width,
        height,
        fps: 30,
        onProgress: setProgress,
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

  const stageLabel: Record<ExportProgress["stage"], string> = {
    preparing: "준비 중...",
    recording: "생성 중",
    finalizing: "마무리 중...",
  };

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
          영상 다운로드
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>영상 다운로드</DialogTitle>
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
            <p className="text-xs text-muted-foreground">
              ⚠ 곡 전체 길이만큼 시간 소요 (3분 곡 ≈ 3분).
              <br />
              브라우저 탭 활성 상태 유지하세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <Progress value={progress.pct * 100} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{stageLabel[progress.stage]}</span>
              <span>{(progress.pct * 100).toFixed(1)}%</span>
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
