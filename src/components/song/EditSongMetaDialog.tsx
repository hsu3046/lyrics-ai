"use client";

import { ImageUp, X } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditorStore } from "@/lib/editor/store";
import type { Project } from "@/lib/types";

export function EditSongMetaDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState(project.song.title);
  const [artist, setArtist] = useState(project.song.artist ?? "");
  const [coverBlob, setCoverBlob] = useState<Blob | undefined>(
    project.song.coverImageBlob,
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
    // SVG 는 script 실행 가능 — raster 만 허용
    if (!/^image\/(jpeg|png|gif|webp|bmp)$/i.test(file.type)) {
      toast.error("JPEG/PNG/GIF/WebP/BMP 만 가능합니다");
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
      useEditorStore.getState().setSong({
        ...project.song,
        title: title.trim(),
        artist: trimmedArtist || undefined,
        coverImageBlob: coverBlob,
      });
      toast.success("노래 정보가 저장되었습니다");
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
          <DialogDescription className="sr-only">
            제목, 아티스트, 앨범 커버 이미지를 수정합니다
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFile(f);
                }}
                className={`relative size-32 overflow-hidden rounded-lg bg-muted transition-all hover:opacity-80 ${
                  dragOver ? "ring-2 ring-ring ring-offset-2" : ""
                }`}
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
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">
              클릭 또는 드래그&드롭 (최대 10MB)
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
