import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { handleDemoRequest } from "../demo/demoBackend";
import { persistDemoMode } from "../demo/demoMode";

export type Tokens = {
  access: string;
  refresh: string;
};

// Web always uses relative URLs - the PWA is served from the same host as the backend.
// Native uses a configurable URL stored in AsyncStorage; EXPO_PUBLIC_DEFAULT_API_BASE_URL
// is the pre-filled default shown on the login screen, baked in at build time.
const NATIVE_DEFAULT_BASE_URL =
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_DEFAULT_API_BASE_URL ??
  "https://splex.sterul.com";
const API_BASE_URL_STORAGE_KEY = "splex.apiBaseUrl";

function summarizeResponseBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (!normalized) return "Empty response body";
  if (/^<!doctype html>|^<html/i.test(normalized)) {
    return "Unexpected HTML response";
  }
  return normalized.slice(0, 220);
}

function formatResponseError(url: string, response: Response, body: string): string {
  const summary = summarizeResponseBody(body);
  return `${summary} (${response.status}) at ${url}`;
}

const API_DEBUG_ENABLED =
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_DEBUG === "1" ||
  (typeof __DEV__ !== "undefined" && __DEV__);

function apiDebug(message: string, details?: unknown) {
  if (!API_DEBUG_ENABLED) return;
  if (typeof window !== "undefined") {
    console.info(`[splex:api] ${message}`, details ?? "");
  }
}

function shouldLogPath(path: string): boolean {
  return path.includes("/invitations/") || path.includes("/auth/magic");
}

export class ApiError extends Error {
  status?: number;
  offline: boolean;
  data?: Record<string, unknown>;

  constructor(message: string, options: { status?: number; offline?: boolean; data?: Record<string, unknown> } = {}) {
    super(message);
    this.status = options.status;
    this.offline = options.offline ?? false;
    this.data = options.data;
  }
}

export class ApiClient {
  private tokens: Tokens | null = null;
  private refreshPromise: Promise<void> | null = null;
  private tokenChangeHandler: ((tokens: Tokens | null) => void) | null = null;
  private baseUrl: string | null = Platform.OS === "web" ? "" : null;
  private baseUrlPromise: Promise<string> | null = null;
  private demoMode = false;

  setTokens(tokens: Tokens | null) {
    this.tokens = tokens;
    this.tokenChangeHandler?.(tokens);
  }

  /** Returns the current access token, or null if not authenticated. */
  getAccessToken(): string | null {
    return this.tokens?.access ?? null;
  }

  setTokenChangeHandler(handler: (tokens: Tokens | null) => void) {
    this.tokenChangeHandler = handler;
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  async setDemoMode(enabled: boolean): Promise<void> {
    this.demoMode = enabled;
    await persistDemoMode(enabled);
  }

  async getBaseUrl(): Promise<string> {
    if (Platform.OS === "web") return "";
    if (this.baseUrl !== null) return this.baseUrl;
    if (!this.baseUrlPromise) {
      this.baseUrlPromise = AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY).then((stored) => {
        this.baseUrl = normalizeBaseUrl(stored || NATIVE_DEFAULT_BASE_URL);
        return this.baseUrl;
      });
    }
    return this.baseUrlPromise;
  }

  async setBaseUrl(value: string): Promise<void> {
    if (Platform.OS === "web") return;
    this.baseUrl = normalizeBaseUrl(value || NATIVE_DEFAULT_BASE_URL);
    await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, this.baseUrl);
  }

  async request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
    if (this.demoMode) {
      const method = (options.method ?? "GET").toUpperCase() as
        | "GET"
        | "POST"
        | "PATCH"
        | "DELETE";
      return handleDemoRequest<T>(method, path);
    }
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    // For multipart uploads, fetch() needs to set the Content-Type itself so
    // the boundary parameter is included.  Skip our default JSON header then.
    if (!(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (this.tokens?.access) {
      headers.set("Authorization", `Bearer ${this.tokens.access}`);
    }
    if (shouldLogPath(path)) {
      apiDebug("request started", {
        method: options.method ?? "GET",
        path,
        hasAccessToken: Boolean(this.tokens?.access),
        retried
      });
    }
    let response: Response;
    const requestUrl = `${await this.getBaseUrl()}${path}`;
    try {
      response = await fetch(requestUrl, { ...options, headers });
    } catch (error) {
      if (shouldLogPath(path)) {
        apiDebug("request failed before response", { path, error });
      }
      throw new ApiError("Network unavailable", { offline: true });
    }
    if (shouldLogPath(path)) {
      apiDebug("response received", { path, status: response.status, ok: response.ok });
    }
    if (response.status === 401 && this.tokens?.refresh && !retried) {
      apiDebug("response was 401; refreshing access token", { path });
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshAccessToken().finally(() => {
          this.refreshPromise = null;
        });
      }
      await this.refreshPromise;
      return this.request<T>(path, options, true);
    }
    if (!response.ok) {
      const text = await response.text();
      if (shouldLogPath(path)) {
        apiDebug("response not ok", { path, status: response.status, body: text });
      }
      let errorData: Record<string, unknown> | undefined;
      try {
        errorData = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // Text might not be JSON, that's ok
      }
      throw new ApiError(formatResponseError(requestUrl, response, text), { status: response.status, data: errorData });
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      const text = await response.text();
      throw new ApiError(formatResponseError(requestUrl, response, text), { status: response.status });
    }
    return response.json() as Promise<T>;
  }

  private async refreshAccessToken(): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${await this.getBaseUrl()}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: this.tokens?.refresh })
      });
    } catch {
      throw new ApiError("Network unavailable", { offline: true });
    }
    if (!response.ok) {
      this.setTokens(null);
      await tokenStorage.set(null);
      throw new ApiError("Authentication expired", { status: response.status });
    }
    const data = (await response.json()) as { access: string; refresh?: string };
    const tokens = {
      access: data.access,
      refresh: data.refresh ?? this.tokens?.refresh ?? ""
    };
    this.setTokens(tokens);
    await tokenStorage.set(tokens);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }

  upload<T>(path: string, formData: FormData): Promise<T> {
    return this.request<T>(path, { method: "POST", body: formData });
  }

  /**
   * Fetch a file (e.g. receipt) and return the raw Response so the caller can
   * stream it to disk, a Blob URL, or `expo-sharing`.  Reuses the same auth +
   * refresh flow as `request<T>` but does not parse the body as JSON.
   */
  async fetchBinary(path: string): Promise<Response> {
    if (this.demoMode) {
      throw new ApiError("Receipts are not available in demo mode.", { status: 400 });
    }
    const headers = new Headers();
    if (this.tokens?.access) {
      headers.set("Authorization", `Bearer ${this.tokens.access}`);
    }
    const url = `${await this.getBaseUrl()}${path}`;
    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch {
      throw new ApiError("Network unavailable", { offline: true });
    }
    if (response.status === 401 && this.tokens?.refresh) {
      this.refreshPromise ??= this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
      await this.refreshPromise;
      const retryHeaders = new Headers();
      if (this.tokens?.access) {
        retryHeaders.set("Authorization", `Bearer ${this.tokens.access}`);
      }
      response = await fetch(url, { headers: retryHeaders });
    }
    if (!response.ok) {
      throw new ApiError(`Failed to fetch (${response.status})`, { status: response.status });
    }
    return response;
  }
}

export const tokenStorage = {
  async get(): Promise<Tokens | null> {
    const raw = await AsyncStorage.getItem("splex.tokens");
    return raw ? (JSON.parse(raw) as Tokens) : null;
  },
  async set(tokens: Tokens | null): Promise<void> {
    if (tokens) {
      await AsyncStorage.setItem("splex.tokens", JSON.stringify(tokens));
    } else {
      await AsyncStorage.removeItem("splex.tokens");
    }
  }
};

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
