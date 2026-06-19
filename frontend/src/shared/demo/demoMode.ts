import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEMO_MODE_STORAGE_KEY = "splex.demoMode";

export class DemoWriteBlockedError extends Error {
  constructor() {
    super("Demo mode is read-only.");
    this.name = "DemoWriteBlockedError";
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function onDemoWriteBlocked(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDemoWriteBlocked(): void {
  for (const listener of listeners) listener();
}

export async function enableDemoMode(): Promise<void> {
  await AsyncStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
}

export async function disableDemoMode(): Promise<void> {
  await AsyncStorage.removeItem(DEMO_MODE_STORAGE_KEY);
}

export async function loadPersistedDemoMode(): Promise<boolean> {
  const value = await AsyncStorage.getItem(DEMO_MODE_STORAGE_KEY);
  return value === "1";
}
