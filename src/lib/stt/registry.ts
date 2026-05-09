import type { SttModelId } from "@/lib/types";
import type { SttAdapter } from "./types";

const adapters = new Map<SttModelId, SttAdapter>();

export function registerAdapter(a: SttAdapter): void {
  adapters.set(a.id, a);
}

export function getAdapter(id: SttModelId): SttAdapter | undefined {
  return adapters.get(id);
}

export function listAdapters(): SttAdapter[] {
  return Array.from(adapters.values());
}
