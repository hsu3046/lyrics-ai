"use client";

import { FileUp } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/editor/store";
import { parseSrtToLines } from "@/lib/srt/parse";
import type { Project } from "@/lib/types";

export function SrtImportButton({ project }: { project: Project }) {
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
        // SRT 가 오디오보다 길면 다른 파일 의심 (반대로 짧은 건 outro/묵음 — 정상)
        if (audioMs && lastEnd > audioMs + 1000) {
          toast.warning(
            `SRT 끝(${(lastEnd / 1000).toFixed(1)}s)이 오디오(${(audioMs / 1000).toFixed(1)}s)보다 깁니다 — 다른 파일일 수 있습니다`,
          );
        }
        useEditorStore
          .getState()
          .replaceLyrics(lines, { source: "srt-import" });
        toast.success(`SRT import — ${lines.length} 줄`);
      } catch (e) {
        console.error(e);
        toast.error("SRT import 실패", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [project],
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
        <span className="hidden sm:inline">가사 </span>업로드
      </label>
    </Button>
  );
}
