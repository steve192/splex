import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { handleDemoRequest } from "../demo/demoBackend";
import {
  disableDemoMode as persistDisabledDemoMode,
  enableDemoMode as persistEnabledDemoMode
} from "../demo/demoMode";

export type Tokens = {
  access: string;
  refresh: string;
};

type ErrorParams = Record<string, string | number>;

// Web always uses relative URLs - the PWA is served from the same host as the backend.
// Native uses a configurable URL stored in AsyncStorage; EXPO_PUBLIC_DEFAULT_API_BASE_URL
// is the pre-filled default shown on the login screen, baked in at build time.
export const NATIVE_DEFAULT_BASE_URL =
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

function formatResponseError(url: string, status: number, body: string): string {
  if (status >= 500) return `Request failed with status ${status}.`;
  const summary = summarizeResponseBody(body);
  return `${summary} (${status}) at ${url}`;
}

const API_DEBUG_ENABLED =
  (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_DEBUG === "1" ||
  (typeof __DEV__ !== "undefined" && __DEV__);

export const API_REQUEST_TIMEOUT_MS = 8000;

function apiDebug(message: string, details?: unknown) {
  if (!API_DEBUG_ENABLED) return;
  if (globalThis.window !== undefined) {
    console.info(`[splex:api] ${message}`, details ?? "");
  }
}

function shouldLogPath(path: string): boolean {
  return path.includes("/invitations/") || path.includes("/auth/magic");
}

function isFormDataBody(body: RequestInit["body"]): boolean {
  if (!body || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  return typeof (body as { getParts?: unknown }).getParts === "function";
}

function getHeaderValue(headers: Record<string, string>, name: string): string {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return "";
}

function parseJsonBody<T>(body: string): T {
  return JSON.parse(body) as T;
}

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type NativeFileUpload = {
  uri: string;
  fieldName: string;
  mimeType?: string;
  parameters?: Record<string, string>;
};

export class ApiError extends Error {
  status?: number;
  offline: boolean;
  data?: Record<string, unknown>;
  code?: string;
  params?: ErrorParams;

  constructor(
    message: string,
    options: {
      status?: number;
      offline?: boolean;
      data?: Record<string, unknown>;
      code?: string;
      params?: ErrorParams;
    } = {}
  ) {
    super(message);
    this.status = options.status;
    this.offline = options.offline ?? false;
    this.data = options.data;
    this.code = options.code;
    this.params = options.params;
  }
}

async function fetchWithTimeout(
  url: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = API_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve("timeout");
    }, timeoutMs);
  });
  const response = fetch(url, { ...options, signal: controller.signal });
  response.catch(() => undefined);
  try {
    const result = await Promise.race([response, timeout]);
    if (result === "timeout") {
      throw new ApiError("Network timeout", { offline: true });
    }
    return result;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

function demoMethod(options: RequestInit): ApiMethod {
  return (options.method ?? "GET").toUpperCase() as ApiMethod;
}

function buildRequestHeaders(options: RequestInit, tokens: Tokens | null): Headers {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  // For multipart uploads, fetch() needs to set the Content-Type itself so
  // the boundary parameter is included. Skip our default JSON header then.
  if (!isFormDataBody(options.body)) {
    headers.set("Content-Type", "application/json");
  }
  if (tokens?.access) {
    headers.set("Authorization", `Bearer ${tokens.access}`);
  }
  return headers;
}

function logRequestStarted(path: string, options: RequestInit, tokens: Tokens | null, retried: boolean): void {
  if (!shouldLogPath(path)) return;
  apiDebug("request started", {
    method: options.method ?? "GET",
    path,
    hasAccessToken: Boolean(tokens?.access),
    retried
  });
}

async function fetchApiResponse(
  path: string,
  requestUrl: string,
  options: RequestInit,
  headers: Headers
): Promise<Response> {
  try {
    return await fetchWithTimeout(requestUrl, { ...options, headers });
  } catch (error) {
    if (shouldLogPath(path)) {
      apiDebug("request failed before response", { path, error });
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("Network unavailable", { offline: true });
  }
}

function shouldRefreshAccessToken(response: Response, tokens: Tokens | null, retried: boolean): boolean {
  return response.status === 401 && Boolean(tokens?.refresh) && !retried;
}

function parseErrorData(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function errorParams(value: unknown): ErrorParams | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const params = Object.entries(value).filter(
    (entry): entry is [string, string | number] =>
      typeof entry[1] === "string" || typeof entry[1] === "number"
  );
  return params.length ? Object.fromEntries(params) : undefined;
}

function backendError(data: Record<string, unknown> | undefined): {
  code?: string;
  message?: string;
  params?: ErrorParams;
} {
  if (!data) return {};
  const error = data.error;
  if (error !== null && typeof error === "object" && !Array.isArray(error)) {
    const payload = error as Record<string, unknown>;
    return {
      code: typeof payload.code === "string" ? payload.code : undefined,
      message: typeof payload.message === "string" ? payload.message : undefined,
      params: errorParams(payload.params)
    };
  }
  return {};
}

function responseApiError(requestUrl: string, status: number, body: string): ApiError {
  const data = parseErrorData(body);
  const backend = backendError(data);
  return new ApiError(
    backend.message ?? (data ? `Request failed with status ${status}.` : formatResponseError(requestUrl, status, body)),
    {
      status,
      data,
      code: backend.code,
      params: backend.params
    }
  );
}

async function readApiResponse<T>(path: string, requestUrl: string, response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    if (shouldLogPath(path)) {
      apiDebug("response not ok", { path, status: response.status, body: text });
    }
    throw responseApiError(requestUrl, response.status, text);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text();
    throw new ApiError(formatResponseError(requestUrl, response.status, text), { status: response.status });
  }
  return response.json() as Promise<T>;
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

  async enableDemoMode(): Promise<void> {
    this.demoMode = true;
    await persistEnabledDemoMode();
  }

  async disableDemoMode(): Promise<void> {
    this.demoMode = false;
    await persistDisabledDemoMode();
  }

  async getBaseUrl(): Promise<string> {
    if (Platform.OS === "web") return "";
    if (this.baseUrl !== null) return this.baseUrl;
    this.baseUrlPromise ??= AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY).then((stored) => {
      this.baseUrl = normalizeBaseUrl(stored || NATIVE_DEFAULT_BASE_URL);
      return this.baseUrl;
    });
    return this.baseUrlPromise;
  }

  async setBaseUrl(value: string): Promise<void> {
    if (Platform.OS === "web") return;
    this.baseUrl = normalizeBaseUrl(value || NATIVE_DEFAULT_BASE_URL);
    await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, this.baseUrl);
  }

  async request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
    if (this.demoMode) {
      return handleDemoRequest<T>(demoMethod(options), path);
    }
    const headers = buildRequestHeaders(options, this.tokens);
    logRequestStarted(path, options, this.tokens, retried);
    const requestUrl = `${await this.getBaseUrl()}${path}`;
    const response = await fetchApiResponse(path, requestUrl, options, headers);
    if (shouldLogPath(path)) {
      apiDebug("response received", { path, status: response.status, ok: response.ok });
    }
    if (shouldRefreshAccessToken(response, this.tokens, retried)) {
      apiDebug("response was 401; refreshing access token", { path });
      this.refreshPromise ??= this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
      await this.refreshPromise;
      return this.request<T>(path, options, true);
    }
    return readApiResponse<T>(path, requestUrl, response);
  }

  private async refreshAccessToken(): Promise<void> {
    let response: Response;
    try {
      response = await fetchWithTimeout(`${await this.getBaseUrl()}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: this.tokens?.refresh })
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
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

  async uploadFile<T>(path: string, file: NativeFileUpload, retried = false): Promise<T> {
    if (this.demoMode) {
      throw new ApiError("File uploads are not available in demo mode.", { status: 400 });
    }
    if (Platform.OS === "web") {
      throw new ApiError("Native file uploads are not available on web.", { status: 400 });
    }
    const FileSystem = await import("expo-file-system/legacy");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.tokens?.access) {
      headers.Authorization = `Bearer ${this.tokens.access}`;
    }
    const requestUrl = `${await this.getBaseUrl()}${path}`;
    let result: { status: number; body: string; headers: Record<string, string> };
    try {
      result = await FileSystem.uploadAsync(requestUrl, file.uri, {
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: file.fieldName,
        mimeType: file.mimeType,
        parameters: file.parameters,
        headers,
        httpMethod: "POST"
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError("Upload failed before the server responded.");
    }
    if (result.status === 401 && this.tokens?.refresh && !retried) {
      this.refreshPromise ??= this.refreshAccessToken().finally(() => {
        this.refreshPromise = null;
      });
      await this.refreshPromise;
      return this.uploadFile<T>(path, file, true);
    }
    if (result.status >= 400) {
      throw responseApiError(requestUrl, result.status, result.body);
    }
    if (result.status === 204) {
      return undefined as T;
    }
    const contentType = getHeaderValue(result.headers, "content-type").toLowerCase();
    if (!contentType.includes("application/json")) {
      throw new ApiError(formatResponseError(requestUrl, result.status, result.body), { status: result.status });
    }
    return parseJsonBody<T>(result.body);
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
      response = await fetchWithTimeout(url, { headers });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
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
      try {
        response = await fetchWithTimeout(url, { headers: retryHeaders });
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw new ApiError("Network unavailable", { offline: true });
      }
    }
    if (!response.ok) {
      throw responseApiError(url, response.status, await response.text());
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

// Normalize a user-entered native base URL down to the bare origin.
//
// The web/PWA app is served at <origin>/app, so users see (and may copy)
// "mydomain.com/app" in their browser. The JSON API, however, always lives at
// <origin>/api — never <origin>/app/api. We therefore strip a trailing "/app"
// (and any trailing slashes) so requests like `${baseUrl}/api/...` resolve
// correctly whether the user entered "mydomain.com" or "mydomain.com/app".
// Origins saved before the /app move (no suffix) are unaffected.
function normalizeBaseUrl(value: string): string {
  let normalized = value.trim();
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.toLowerCase().endsWith("/app")) {
    normalized = normalized.slice(0, -"/app".length);
  }
  while (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
