"use client";

import { FileUp } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveProject } from "@/lib/persistence/projects";
import { parseSrtToLines } from "@/lib/srt/parse";
import type { Project } from "@/lib/types";

export function SrtImportButton({
  project,
  onImported,
}: {
  project: Project;
  onImported: (p: Project) => void;
}) {
  const handle = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const lines = parseSrtToLines(text);
        if (lines.length === 0) {
          toast.error("SRT 파싱 실패 또는 빈 파일");
          return;
        }
        const existingCount = project.lyrics.lines.length;
        if (existingCount > 0) {
          const ok = window.confirm(
            `기존 가사 ${existingCount} 줄이 import 한 ${lines.length} 줄로 교체됩니다. 계속하시겠습니까?`,
          );
          if (!ok) return;
        }
        const lastEnd = lines[lines.length - 1].endMs;
        const audioMs = project.song.durationMs;
        if (audioMs && Math.abs(audioMs - lastEnd) > 5000) {
          toast.warning(
            `SRT 길이(${(lastEnd / 1000).toFixed(1)}s)와 오디오(${(audioMs / 1000).toFixed(1)}s) 차이 5초 이상`,
          );
        }
        const updated: Project = {
          ...project,
          lyrics: { ...project.lyrics, lines, source: "srt-import" },
        };
        await saveProject(updated);
        toast.success(`SRT import — ${lines.length} 줄`);
        onImported(updated);
      } catch (e) {
        console.error(e);
        toast.error("SRT import 실패", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [project, onImported],
  );

  return (
    <Button asChild variant="ghost" size="sm">
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".srt,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handle(file);
            e.target.value = "";
          }}
        />
        <FileUp className="size-4" />
        가사 업로드
      </label>
    </Button>
  );
}
