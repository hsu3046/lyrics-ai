"use client";

import { ImageUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProject } from "@/lib/persistence/projects";
import type { Project } from "@/lib/types";

export function EditSongMetaDialog({
  project,
  open,
  onOpenChange,
  onUpdated,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (p: Project) => void;
}) {
  const [title, setTitle] = useState(project.song.title);
  const [artist, setArtist] = useState(project.song.artist ?? "");
  const [coverBlob, setCoverBlob] = useState<Blob | undefined>(
    project.song.coverImageBlob,
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // dialog open 시 기존 값으로 reset
  useEffect(() => {
    if (!open) return;
    setTitle(project.song.title);
    setArtist(project.song.artist ?? "");
    setCoverBlob(project.song.coverImageBlob);
  }, [open, project]);

  // coverBlob → preview URL
  useEffect(() => {
    if (!coverBlob) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverBlob);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverBlob]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 가능합니다");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지가 너무 큽니다 (10MB 초과)");
      return;
    }
    setCoverBlob(file);
  };

  const save = async () => {
    if (busy) return;
    if (!title.trim()) {
      toast.error("제목은 필수입니다");
      return;
    }
    setBusy(true);
    try {
      const trimmedArtist = artist.trim();
      const updated: Project = {
        ...project,
        song: {
          ...project.song,
          title: title.trim(),
          artist: trimmedArtist || undefined,
          coverImageBlob: coverBlob,
        },
      };
      await saveProject(updated);
      toast.success("노래 정보가 저장되었습니다");
      onUpdated(updated);
      onOpenChange(false);
    } catch (e) {
      console.error("[meta-edit]", e);
      toast.error("저장 실패", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>노래 정보 수정</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative size-32 overflow-hidden rounded-lg bg-muted transition-opacity hover:opacity-80"
                aria-label="커버 이미지 변경"
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ImageUp className="size-8 text-muted-foreground" />
                  </div>
                )}
              </button>
              {coverBlob && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute -right-2 -top-2 size-7 rounded-full shadow"
                  onClick={() => setCoverBlob(undefined)}
                  aria-label="커버 제거"
                  title="커버 제거"
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              이미지 클릭으로 변경 (최대 10MB)
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="meta-title">제목</Label>
            <Input
              id="meta-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
              className="text-base"
              placeholder="노래 제목"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="meta-artist">아티스트</Label>
            <Input
              id="meta-artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              disabled={busy}
              className="text-base"
              placeholder="아티스트명 (선택)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            취소
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
