/**
 * Receipt upload + download helpers.
 *
 * Picking a file:
 *   `pickReceipt()` opens the system file picker (limited to JPEG/PNG/WebP/PDF).
 *
 * Uploading:
 *   `uploadReceipt(api, asset, ctx)` posts the multipart form to the backend.
 *   ctx supplies the context (group_id, friendship_id, expense_id, client_id).
 *
 * Opening a receipt:
 *   `openReceipt(api, receipt)` fetches the file with the auth token and either
 *     - opens an object URL in a new browser tab (web), or
 *     - downloads to the device cache and triggers the system "open with"
 *       sheet via `expo-sharing` (native).
 */

import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";

import type { ApiClient } from "../api/client";
import type { Receipt } from "../types/models";

export const RECEIPT_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export type PickedReceipt = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Web only — the underlying File object for direct FormData append. */
  file?: File;
};

export type UploadContext = {
  expenseId?: number;
  groupId?: number;
  friendshipId?: number;
  clientId?: string;
};

export async function pickReceipt(): Promise<PickedReceipt | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: RECEIPT_ALLOWED_MIME_TYPES,
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (result.canceled || !result.assets?.length) {
    return null;
  }
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || "receipt",
    mimeType: asset.mimeType || "application/octet-stream",
    sizeBytes: asset.size ?? 0,
    file: asset.file,
  };
}

export async function uploadReceipt(
  api: ApiClient,
  asset: PickedReceipt,
  ctx: UploadContext
): Promise<Receipt> {
  const form = new FormData();
  if (Platform.OS === "web" && asset.file) {
    form.append("file", asset.file, asset.name);
  } else {
    // React Native FormData accepts {uri, name, type} for file fields.
    form.append("file", {
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType,
    } as unknown as Blob);
  }
  if (ctx.expenseId) form.append("expense_id", String(ctx.expenseId));
  if (ctx.groupId) form.append("group_id", String(ctx.groupId));
  if (ctx.friendshipId) form.append("friendship_id", String(ctx.friendshipId));
  if (ctx.clientId) form.append("client_id", ctx.clientId);
  return api.upload<Receipt>("/api/receipts/", form);
}

export function deleteReceipt(api: ApiClient, receiptId: number): Promise<void> {
  return api.delete(`/api/receipts/${receiptId}/`);
}

/**
 * Open a receipt for the user.
 *   - Web: fetch as Blob → object URL → window.open in a new tab.
 *   - Native: stream to a cache file → `expo-sharing` raises the OS "open with"
 *     dialog so the user can pick a viewer.
 */
export async function openReceipt(api: ApiClient, receipt: Receipt): Promise<void> {
  if (Platform.OS === "web") {
    const response = await api.fetchBinary(`/api/receipts/${receipt.id}/download/`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    // Revoke after a delay so the new tab has time to read it.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // Native: pull the file down with auth headers, save to cache, then share.
  // Using the legacy expo-file-system API since downloadAsync supports
  // request headers out of the box, which the new File class does not yet.
  const FileSystem = await import("expo-file-system/legacy");
  const Sharing = await import("expo-sharing");
  const baseUrl = await api.getBaseUrl();
  const accessToken = api.getAccessToken();
  if (!FileSystem.cacheDirectory) {
    throw new Error("Cache directory unavailable on this platform.");
  }
  const safeName = receipt.original_filename.replace(/[^\w.\-]+/g, "_") || `receipt-${receipt.id}`;
  const targetUri = `${FileSystem.cacheDirectory}${receipt.id}-${safeName}`;
  const download = await FileSystem.downloadAsync(
    `${baseUrl}/api/receipts/${receipt.id}/download/`,
    targetUri,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    }
  );
  if (download.status >= 400) {
    throw new Error(`Failed to download receipt (HTTP ${download.status}).`);
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(download.uri, {
      mimeType: receipt.content_type,
      dialogTitle: receipt.original_filename,
    });
  }
}
