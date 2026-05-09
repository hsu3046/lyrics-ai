"use client";

import { Wand2 } from "lucide-react";
import { useState } from "react";
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
import {
  alignLyricsWithWhisperGpt,
} from "@/lib/align/whisperGpt";
import { getApiKey, setApiKey } from "@/lib/persistence/apiKeys";
import { saveProject } from "@/lib/persistence/projects";
import type { Project } from "@/lib/types";

const MAX_FILE_MB = 25;

export function AlignButton({
  project,
  onUpdated,
}: {
  project: Project;
  onUpdated: (p: Project) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lyrics, setLyrics] = useState(
    project.lyrics.lines.map((l) => l.text).join("\n"),
  );
  const [busy, setBusy] = useState(false);

  const sizeMb = project.song.audioBlob.size / (1024 * 1024);
  const tooLarge = sizeMb > MAX_FILE_MB;

  const run = async () => {
    if (busy) return;
    if (!lyrics.trim()) {
      toast.error("가사 입력 필요");
      return;
    }
    if (tooLarge) {
      toast.error(
        `파일이 너무 큽니다 (${sizeMb.toFixed(1)}MB > ${MAX_FILE_MB}MB)`,
      );
      return;
    }

    let apiKey = getApiKey("openai");
    if (!apiKey) {
      const input = window.prompt(
        "OpenAI API 키를 입력하세요 (sk-...). localStorage 에만 저장됩니다.",
      );
      if (!input) return;
      apiKey = input.trim();
      setApiKey("openai", apiKey);
    }

    setBusy(true);
    const t0 = performance.now();
    toast.loading("Whisper 음성 인식 중...", { id: "align" });

    try {
      const lines = await alignLyricsWithWhisperGpt({
        audio: project.song.audioBlob,
        lyrics,
        language: "auto",
        apiKey,
        onProgress: (stage) => {
          if (stage === "aligning") {
            toast.loading("가사 정렬 중 (gpt-5.4-mini)...", { id: "align" });
          }
        },
      });

      const updated: Project = {
        ...project,
        lyrics: {
          ...project.lyrics,
          lines,
          source: "stt",
          sttModel: "openai-whisper-1",
        },
      };
      await saveProject(updated);

      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      toast.success(`${lines.length} 줄 정렬 (${elapsed}s)`, { id: "align" });

      setOpen(false);
      onUpdated(updated);
    } catch (e) {
      console.error("[align]", e);
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      if (
        lower.includes("401") ||
        lower.includes("incorrect") ||
        lower.includes("invalid")
      ) {
        setApiKey("openai", "");
        toast.error("인증 실패 — API 키 재입력 필요", { id: "align" });
      } else {
        toast.error("정렬 실패", { id: "align", description: msg });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={tooLarge}>
          <Wand2 className="size-4" />
          정밀 싱크
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>정밀 싱크 — 가사 입력</DialogTitle>
          <DialogDescription>
            정확한 가사를 줄 단위로 입력하세요. Whisper 가 word timing 을 추출하고 gpt-5.4-mini 가 매핑합니다 (~30원/3분 곡).
          </DialogDescription>
        </DialogHeader>
        <textarea
          className="min-h-[280px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          placeholder="가사를 한 줄씩 붙여넣으세요"
          value={lyrics}
          onChange={(e) => setLyrics(e.target.value)}
          disabled={busy}
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            취소
          </Button>
          <Button onClick={run} disabled={busy || !lyrics.trim()}>
            {busy ? "처리 중..." : "정렬 시작"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
