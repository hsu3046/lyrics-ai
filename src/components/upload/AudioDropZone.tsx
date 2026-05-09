"use client";

import { Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { extractMetadata, type ExtractedMeta } from "@/lib/audio/metadata";
import {
  createBlankProject,
  createSong,
  saveProject,
} from "@/lib/persistence/projects";
import type { Project } from "@/lib/types";

const ACCEPT = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
].join(",");

export function AudioDropZone({
  onCreated,
}: {
  onCreated: (p: Project) => void | Promise<void>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = useCallback(
    async (file: File) => {
      if (busy) return;
      setBusy(true);
      try {
        const meta: ExtractedMeta = await extractMetadata(file).catch(() => ({
          durationMs: 0,
        }));
        const song = createSong({
          audioBlob: file,
          audioMime: file.type || "audio/mpeg",
          durationMs: meta.durationMs,
          title: meta.title ?? file.name.replace(/\.[^.]+$/, ""),
          artist: meta.artist,
          album: meta.album,
          coverImageBlob: meta.coverImageBlob,
        });
        const project = createBlankProject(song);
        await saveProject(project);
        toast.success(`업로드 완료 — ${song.title}`);
        await onCreated(project);
      } catch (e) {
        console.error(e);
        toast.error("업로드 실패", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, onCreated],
  );

  return (
    <label
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50"
      } ${busy ? "pointer-events-none opacity-50" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handle(file);
      }}
    >
      <input
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handle(file);
          e.target.value = "";
        }}
      />
      <Upload className="size-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-base font-medium">
          {busy ? "처리 중..." : "음악 파일 드래그 또는 클릭"}
        </p>
        <p className="text-sm text-muted-foreground">
          mp3, wav, flac, m4a, aac, ogg · 최대 25MB
        </p>
      </div>
    </label>
  );
}
