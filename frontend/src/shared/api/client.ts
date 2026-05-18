import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type Tokens = {
  access: string;
  refresh: string;
};

const runtimeEnv = process.env as Record<string, string | undefined>;
const WEB_API_BASE_URL = runtimeEnv.EXPO_PUBLIC_API_BASE_URL || runtimeEnv.REACT_APP_API_BASE_URL || "";
const DEFAULT_NATIVE_API_BASE_URL = runtimeEnv.EXPO_PUBLIC_DEFAULT_API_BASE_URL || "https://splex.example.com";
const API_BASE_URL_STORAGE_KEY = "splex.apiBaseUrl";

function apiDebug(message: string, details?: unknown) {
  if (typeof window !== "undefined") {
    console.info(`[splex:api] ${message}`, details ?? "");
  }
}

export class ApiError extends Error {
  status?: number;
  offline: boolean;

  constructor(message: string, options: { status?: number; offline?: boolean } = {}) {
    super(message);
    this.status = options.status;
    this.offline = options.offline ?? false;
  }
}

export class ApiClient {
  private tokens: Tokens | null = null;
  private refreshPromise: Promise<void> | null = null;
  private tokenChangeHandler: ((tokens: Tokens | null) => void) | null = null;
  private baseUrl: string | null = Platform.OS === "web" ? WEB_API_BASE_URL : null;
  private baseUrlPromise: Promise<string> | null = null;

  setTokens(tokens: Tokens | null) {
    this.tokens = tokens;
    this.tokenChangeHandler?.(tokens);
  }

  setTokenChangeHandler(handler: (tokens: Tokens | null) => void) {
    this.tokenChangeHandler = handler;
  }

  async getBaseUrl(): Promise<string> {
    if (Platform.OS === "web") return WEB_API_BASE_URL;
    if (this.baseUrl !== null) return this.baseUrl;
    if (!this.baseUrlPromise) {
      this.baseUrlPromise = AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY).then((stored) => {
        this.baseUrl = normalizeBaseUrl(stored || DEFAULT_NATIVE_API_BASE_URL);
        return this.baseUrl;
      });
    }
    return this.baseUrlPromise;
  }

  async setBaseUrl(value: string): Promise<void> {
    if (Platform.OS === "web") return;
    this.baseUrl = normalizeBaseUrl(value || DEFAULT_NATIVE_API_BASE_URL);
    await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, this.baseUrl);
  }

  async request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (this.tokens?.access) {
      headers.set("Authorization", `Bearer ${this.tokens.access}`);
    }
    if (path.includes("/invitations/") || path.includes("/auth/magic")) {
      apiDebug("request started", {
        method: options.method ?? "GET",
        path,
        hasAccessToken: Boolean(this.tokens?.access),
        retried
      });
    }
    let response: Response;
    try {
      response = await fetch(`${await this.getBaseUrl()}${path}`, { ...options, headers });
    } catch (error) {
      if (path.includes("/invitations/") || path.includes("/auth/magic")) {
        apiDebug("request failed before response", { path, error });
      }
      throw new ApiError("Network unavailable", { offline: true });
    }
    if (path.includes("/invitations/") || path.includes("/auth/magic")) {
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
      if (path.includes("/invitations/") || path.includes("/auth/magic")) {
        apiDebug("response not ok", { path, status: response.status, body: text });
      }
      throw new ApiError(text || response.statusText, { status: response.status });
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  private async refreshAccessToken(): Promise<void> {
    const response = await fetch(`${await this.getBaseUrl()}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: this.tokens?.refresh })
    });
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
