"use client";

import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lyricsToSrt } from "@/lib/srt/serialize";
import type { Project } from "@/lib/types";

function safeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "lyrics";
}

function buildFilename(project: Project): string {
  const title = safeFilename(project.song.title);
  if (project.song.artist) {
    return `${safeFilename(project.song.artist)} - ${title}.srt`;
  }
  return `${title}.srt`;
}

export function SrtExportButton({ project }: { project: Project }) {
  const lineCount = project.lyrics.lines.length;
  const disabled = lineCount === 0;

  const handleClick = () => {
    if (disabled) return;
    try {
      const srt = lyricsToSrt(project.lyrics.lines);
      if (!srt.trim()) {
        toast.error("내보낼 가사가 없습니다");
        return;
      }
      const blob = new Blob([srt], { type: "text/srt;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const filename = buildFilename(project);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`다운로드 — ${filename}`);
    } catch (e) {
      console.error("[srt-export]", e);
      toast.error("내보내기 실패", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={disabled}
    >
      <FileDown className="size-4" />
      <span className="hidden sm:inline">가사 </span>다운로드
    </Button>
  );
}
