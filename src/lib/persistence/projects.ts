"use client";

import { del, get, keys, set } from "idb-keyval";
import { ulid } from "ulid";
import type { Project, Song } from "@/lib/types";

const PROJECT_PREFIX = "lyrics-ai:project:";

export async function listProjects(): Promise<Project[]> {
  const all = await keys();
  const projectKeys = all.filter(
    (k): k is string => typeof k === "string" && k.startsWith(PROJECT_PREFIX),
  );
  const projects = await Promise.all(projectKeys.map((k) => get<Project>(k)));
  return projects
    .filter((p): p is Project => Boolean(p))
    .sort((a, b) => b.song.updatedAt - a.song.updatedAt);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return get<Project>(PROJECT_PREFIX + id);
}

export async function saveProject(project: Project): Promise<void> {
  project.song.updatedAt = Date.now();
  await set(PROJECT_PREFIX + project.id, project);
}

export async function deleteProject(id: string): Promise<void> {
  await del(PROJECT_PREFIX + id);
}

export function createSong(input: {
  audioBlob: Blob;
  audioMime: string;
  durationMs: number;
  title?: string;
  artist?: string;
  album?: string;
  coverImageBlob?: Blob;
}): Song {
  const now = Date.now();
  return {
    id: ulid(),
    title: input.title ?? "Untitled",
    artist: input.artist,
    album: input.album,
    coverImageBlob: input.coverImageBlob,
    audioBlob: input.audioBlob,
    audioMime: input.audioMime,
    durationMs: input.durationMs,
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankProject(song: Song): Project {
  return {
    id: song.id,
    song,
    lyrics: { lines: [], language: "auto", source: "manual" },
    display: { backgroundStyle: "blurred-cover" },
  };
}
