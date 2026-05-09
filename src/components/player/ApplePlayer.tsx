"use client";

import {
  List,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  SquarePen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EditableLyricsView } from "@/components/editor/EditableLyricsView";
import { SrtExportButton } from "@/components/export/SrtExportButton";
import { VideoExportButton } from "@/components/export/VideoExportButton";
import { LyricsView } from "@/components/player/LyricsView";
import { EditSongMetaDialog } from "@/components/song/EditSongMetaDialog";
import { TranscribeButton } from "@/components/transcribe/TranscribeButton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SrtImportButton } from "@/components/upload/SrtImportButton";
import { useActiveLineIndex } from "@/hooks/useActiveLineIndex";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import {
  subscribeAutosaveErrors,
  subscribeProjectSaves,
  useEditorStore,
} from "@/lib/editor/store";
import type { LyricLine, Project } from "@/lib/types";
import { formatTimecode } from "@/lib/utils/time";

export function ApplePlayer({
  project,
  onClose,
  onUpdate,
}: {
  project: Project;
  onClose?: () => void;
  onUpdate?: (p: Project) => void;
}) {
  const {
    audioRef,
    isPlaying,
    currentTimeMs,
    durationMs,
    toggle,
    seek,
    playRange,
  } = useAudioPlayback();

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);

  useEffect(() => {
    useEditorStore.getState().setProject(project);
  }, [project]);

  useEffect(() => {
    if (!onUpdate) return;
    return subscribeProjectSaves((p) => {
      if (p.id === project.id) onUpdate(p);
    });
  }, [onUpdate, project.id]);

  useEffect(() => {
    return subscribeAutosaveErrors((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota =
        err instanceof DOMException &&
        (err.name === "QuotaExceededError" ||
          err.name === "NS_ERROR_DOM_QUOTA_REACHED");
      toast.error(isQuota ? "저장 공간 부족" : "자동 저장 실패", {
        id: "autosave-err",
        description: isQuota
          ? "브라우저 저장 공간이 가득 찼습니다. 다른 프로젝트를 정리하세요."
          : msg,
      });
    });
  }, []);

  const storeLines = useEditorStore((s) => s.project?.lyrics.lines);
  const lines: LyricLine[] = storeLines ?? project.lyrics.lines;

  useEffect(() => {
    const url = URL.createObjectURL(project.song.audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [project.song.audioBlob]);

  useEffect(() => {
    if (!project.song.coverImageBlob) {
      setCoverUrl(null);
      return;
    }
    const url = URL.createObjectURL(project.song.coverImageBlob);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [project.song.coverImageBlob]);

  const hasLyrics = lines.length > 0;
  const activeIdx = useActiveLineIndex(lines, currentTimeMs);
  const total = durationMs || project.song.durationMs;
  const skipMs = (delta: number) =>
    seek(Math.max(0, Math.min(total, currentTimeMs + delta)));

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      {/* 배경 */}
      {coverUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 scale-110 bg-cover bg-center opacity-50 blur-xl"
          style={{ backgroundImage: `url(${coverUrl})` }}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-900 to-black"
        />
      )}

      {/* biome-ignore lint/a11y/useMediaCaption: 가사는 LyricsView 로 표시 */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="auto"
        className="hidden"
      />

      {/* ─── 상단: 메뉴 (항상 고정) ─── */}
      <header className="shrink-0 px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <List className="size-4" />
                목록으로
              </Button>
            )}
            {hasLyrics && (
              <button
                type="button"
                onClick={() => setMetaDialogOpen(true)}
                className="flex min-w-0 items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50"
                title="노래 정보 수정"
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt=""
                    className="size-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="size-10 rounded-md bg-zinc-800" />
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight">
                    {project.song.title}
                  </span>
                  {project.song.artist && (
                    <span className="truncate text-xs text-muted-foreground">
                      {project.song.artist}
                    </span>
                  )}
                </div>
              </button>
            )}
          </div>
          {onUpdate && (
            <div className="flex flex-wrap items-center gap-1">
              <TranscribeButton project={project} />
              {hasLyrics && (
                <Button
                  variant={editMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setEditMode((v) => !v)}
                >
                  <SquarePen className="size-4" />
                  {editMode ? (
                    <>
                      <span className="hidden sm:inline">수정 </span>완료
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">가사 </span>수정
                    </>
                  )}
                </Button>
              )}
              <SrtImportButton project={project} />
              {hasLyrics && (
                <>
                  <SrtExportButton
                    project={{
                      ...project,
                      lyrics: { ...project.lyrics, lines },
                    }}
                  />
                  <VideoExportButton
                    project={{
                      ...project,
                      lyrics: { ...project.lyrics, lines },
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ─── 가운데: 가사 영역 (가변, 내부 스크롤) ─── */}
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {hasLyrics ? (
          editMode ? (
            <EditableLyricsView
              lines={lines}
              activeIndex={activeIdx}
              onSeekTo={seek}
              onPlayRange={playRange}
            />
          ) : (
            <LyricsView
              lines={lines}
              activeIndex={activeIdx}
              onSeekTo={seek}
            />
          )
        ) : (
          <BigCoverContent
            coverUrl={coverUrl}
            title={project.song.title}
            artist={project.song.artist}
            onEditMeta={() => setMetaDialogOpen(true)}
          />
        )}
      </main>

      {/* ─── 하단: 진행바 + 재생 컨트롤 (항상 고정) ─── */}
      <footer className="shrink-0">
        <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-6 pb-6 pt-2">
          <Slider
            value={[currentTimeMs]}
            min={0}
            max={total || 1}
            step={100}
            onValueChange={([v]) => seek(v ?? 0)}
          />
          <div className="flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
            <span>{formatTimecode(currentTimeMs)}</span>
            <span>-{formatTimecode(Math.max(0, total - currentTimeMs))}</span>
          </div>
          <div className="flex items-center justify-center gap-4 pt-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skipMs(-15000)}
              aria-label="15초 뒤로"
            >
              <SkipBack className="size-5" />
            </Button>
            <Button
              size="icon"
              className="size-10 rounded-full"
              onClick={toggle}
              aria-label={isPlaying ? "일시정지" : "재생"}
            >
              {isPlaying ? (
                <Pause className="size-5" />
              ) : (
                <Play className="ml-0.5 size-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => skipMs(15000)}
              aria-label="15초 앞으로"
            >
              <SkipForward className="size-5" />
            </Button>
          </div>
        </div>
      </footer>

      {onUpdate && (
        <EditSongMetaDialog
          project={project}
          open={metaDialogOpen}
          onOpenChange={setMetaDialogOpen}
        />
      )}
    </div>
  );
}

function BigCoverContent({
  coverUrl,
  title,
  artist,
  onEditMeta,
}: {
  coverUrl: string | null;
  title: string;
  artist?: string;
  onEditMeta?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-6">
      <button
        type="button"
        onClick={onEditMeta}
        className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-zinc-800 shadow-2xl transition-opacity hover:opacity-90"
        title="노래 정보 수정"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-zinc-500">
            No cover
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onEditMeta}
        className="flex flex-col items-center gap-1 rounded-md px-3 py-1 text-center transition-colors hover:bg-muted/30"
        title="노래 정보 수정"
      >
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {artist && <p className="text-base text-muted-foreground">{artist}</p>}
      </button>
    </div>
  );
}
