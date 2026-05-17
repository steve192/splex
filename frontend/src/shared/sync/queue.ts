import AsyncStorage from "@react-native-async-storage/async-storage";

import { ApiClient } from "../api/client";

export type PendingMutation = {
  id: string;
  type: "create_expense";
  payload: unknown;
  createdAt: string;
  status: "pending" | "syncing" | "failed";
  lastError?: string;
};

const STORAGE_KEY = "splex.pendingMutations";

async function read(): Promise<PendingMutation[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as PendingMutation[]) : [];
}

async function write(mutations: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mutations));
}

export const syncPendingMutations = {
  async list(): Promise<PendingMutation[]> {
    return read();
  },
  async get(id: string): Promise<PendingMutation | null> {
    const mutations = await read();
    return mutations.find((mutation) => mutation.id === id) ?? null;
  },
  async enqueue(mutation: PendingMutation): Promise<void> {
    const existing = await read();
    await write([...existing.filter((item) => item.id !== mutation.id), mutation]);
  },
  async remove(id: string): Promise<void> {
    const existing = await read();
    await write(existing.filter((item) => item.id !== id));
  },
  async flush(api: ApiClient): Promise<void> {
    const mutations = await read();
    const remaining: PendingMutation[] = [];
    for (const mutation of mutations) {
      try {
        await api.post("/api/sync/mutations/", {
          clientMutationId: mutation.id,
          type: mutation.type,
          payload: mutation.payload
        });
      } catch (error) {
        remaining.push({ ...mutation, status: "failed", lastError: String(error) });
      }
    }
    await write(remaining);
  }
};
