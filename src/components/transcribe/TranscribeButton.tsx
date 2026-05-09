"use client";

import { WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/lib/editor/store";
import { getApiKey, setApiKey } from "@/lib/persistence/apiKeys";
import { getAdapter } from "@/lib/stt";
import type { Project } from "@/lib/types";

const MODEL_ID = "openai-whisper-1";

export function TranscribeButton({ project }: { project: Project }) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;

    const adapter = getAdapter(MODEL_ID);
    if (!adapter) {
      toast.error("Whisper 어댑터 미등록");
      return;
    }

    const sizeMb = project.song.audioBlob.size / (1024 * 1024);
    if (sizeMb > adapter.maxFileSizeMb) {
      toast.error(
        `파일이 너무 큽니다 (${sizeMb.toFixed(1)}MB > ${adapter.maxFileSizeMb}MB)`,
      );
      return;
    }

    const existingCount = project.lyrics.lines.length;
    if (existingCount > 0) {
      const ok = window.confirm(
        `기존 가사 ${existingCount} 줄이 새 결과로 교체됩니다. 계속하시겠습니까?`,
      );
      if (!ok) return;
    }

    let apiKey = getApiKey("openai");
    if (!apiKey) {
      const input = window.prompt(
        "OpenAI API 키를 입력하세요 (sk-...). localStorage 에 저장됩니다.",
      );
      if (!input) return;
      apiKey = input.trim();
      setApiKey("openai", apiKey);
    }

    setBusy(true);
    const t0 = performance.now();
    toast.loading("가사 생성 중...", { id: "transcribe" });

    try {
      const result = await adapter.transcribe({
        audio: project.song.audioBlob,
        language: "auto",
        apiKey,
      });
      useEditorStore.getState().replaceLyrics(result.lines, {
        source: "stt",
        sttModel: MODEL_ID,
        language: "auto",
      });
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      toast.success(`${result.lines.length} 줄 생성 (${elapsed}s)`, {
        id: "transcribe",
      });
    } catch (e) {
      console.error("[transcribe]", e);
      const msg = e instanceof Error ? e.message : String(e);
      const lower = msg.toLowerCase();
      if (
        lower.includes("401") ||
        lower.includes("incorrect") ||
        lower.includes("invalid")
      ) {
        setApiKey("openai", "");
        toast.error("인증 실패 — API 키 재입력 필요", { id: "transcribe" });
      } else {
        toast.error("가사 생성 실패", { id: "transcribe", description: msg });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={run} disabled={busy}>
      <WandSparkles className="size-4" />
      {busy ? (
        "인식 중..."
      ) : (
        <>
          <span className="hidden sm:inline">가사 </span>인식
        </>
      )}
    </Button>
  );
}
