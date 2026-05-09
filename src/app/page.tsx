"use client";

import { AudioLines, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApplePlayer } from "@/components/player/ApplePlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AudioDropZone } from "@/components/upload/AudioDropZone";
import { deleteProject, listProjects } from "@/lib/persistence/projects";
import type { Project } from "@/lib/types";
import { formatMmSs } from "@/lib/utils/time";

type SortBy = "updatedAt" | "createdAt" | "title" | "duration";
const SORT_STORAGE_KEY = "lyrics-ai:listSortBy";

const SORT_LABELS: Record<SortBy, string> = {
  updatedAt: "최근 수정",
  createdAt: "최근 추가",
  title: "제목",
  duration: "길이",
};

function getInitialSort(): SortBy {
  if (typeof window === "undefined") return "updatedAt";
  const saved = localStorage.getItem(SORT_STORAGE_KEY);
  if (
    saved === "updatedAt" ||
    saved === "createdAt" ||
    saved === "title" ||
    saved === "duration"
  )
    return saved;
  return "updatedAt";
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [active, setActive] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>(getInitialSort);

  const reload = async () => {
    setProjects(await listProjects());
  };

  useEffect(() => {
    reload();
  }, []);

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? projects.filter(
          (p) =>
            p.song.title.toLowerCase().includes(q) ||
            (p.song.artist?.toLowerCase().includes(q) ?? false),
        )
      : projects;
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "updatedAt":
          return b.song.updatedAt - a.song.updatedAt;
        case "createdAt":
          return b.song.createdAt - a.song.createdAt;
        case "title":
          return a.song.title.localeCompare(b.song.title);
        case "duration":
          return b.song.durationMs - a.song.durationMs;
      }
    });
    return sorted;
  }, [projects, search, sortBy]);

  if (active) {
    return (
      <ApplePlayer
        project={active}
        onClose={() => {
          setActive(null);
          reload();
        }}
        onUpdate={(updated) => setActive(updated)}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <AudioLines className="size-10 text-muted-foreground" />
        <h1 className="text-3xl font-semibold tracking-tight">Lyrics AI</h1>
      </header>

      <AudioDropZone
        onCreated={async (p) => {
          await reload();
          setActive(p);
        }}
      />

      {projects.length > 0 && (
        <section className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              최근 노래{" "}
              <span className="text-xs">
                ({visibleProjects.length}
                {search && `/${projects.length}`})
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-32 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="제목 / 아티스트"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-base"
              />
            </div>
            <Select
              value={sortBy}
              onValueChange={(v) => {
                const next = v as SortBy;
                setSortBy(next);
                localStorage.setItem(SORT_STORAGE_KEY, next);
              }}
            >
              <SelectTrigger className="w-[140px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortBy[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              검색 결과 없음
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleProjects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50"
                >
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-3 text-left"
                    onClick={() => setActive(p)}
                  >
                    <CoverThumb project={p} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {p.song.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {p.song.artist ?? "Unknown"} ·{" "}
                        {formatMmSs(p.song.durationMs)}
                      </span>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${p.song.title} 삭제`}
                    onClick={async () => {
                      if (!confirm(`"${p.song.title}" 삭제할까요?`)) return;
                      await deleteProject(p.id);
                      reload();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function CoverThumb({ project }: { project: Project }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!project.song.coverImageBlob) return;
    const u = URL.createObjectURL(project.song.coverImageBlob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [project.song.coverImageBlob]);

  if (!url) {
    return <div className="size-12 shrink-0 rounded-md bg-muted" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={url}
      alt=""
      className="size-12 shrink-0 rounded-md object-cover"
    />
  );
}
