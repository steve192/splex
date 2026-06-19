import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "web" as string }));
const downloadAsync = vi.hoisted(() => vi.fn());
const getContentUriAsync = vi.hoisted(() => vi.fn());
const startActivityAsync = vi.hoisted(() => vi.fn());
const isSharingAvailableAsync = vi.hoisted(() => vi.fn());
const shareAsync = vi.hoisted(() => vi.fn());

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn()
}));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  downloadAsync,
  getContentUriAsync
}));
vi.mock("expo-intent-launcher", () => ({ startActivityAsync }));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: isSharingAvailableAsync,
  shareAsync
}));

import { openReceipt, uploadReceipt, type PickedReceipt } from "./receiptService";
import type { Receipt } from "../types/models";

const pickedReceipt: PickedReceipt = {
  uri: "file:///cache/receipt.pdf",
  name: "Dinner receipt.pdf",
  mimeType: "application/pdf",
  sizeBytes: 120
};

beforeEach(() => {
  platform.OS = "web";
  downloadAsync.mockReset();
  getContentUriAsync.mockReset();
  startActivityAsync.mockReset();
  isSharingAvailableAsync.mockReset();
  shareAsync.mockReset();
});

describe("uploadReceipt", () => {
  it("uses FormData upload on web and preserves the browser File", async () => {
    const file = new File(["%PDF-1.4"], "Dinner receipt.pdf", { type: "application/pdf" });
    const api = {
      upload: vi.fn(async () => ({ id: 1 })),
      uploadFile: vi.fn()
    };

    await uploadReceipt(api as never, { ...pickedReceipt, file }, { groupId: 3, clientId: "draft-1" });

    expect(api.uploadFile).not.toHaveBeenCalled();
    expect(api.upload).toHaveBeenCalledTimes(1);
    const [path, form] = api.upload.mock.calls[0] as unknown as [string, FormData];
    expect(path).toBe("/api/receipts/");
    expect(form.get("file")).toMatchObject({
      name: "Dinner receipt.pdf",
      type: "application/pdf"
    });
    expect(form.get("original_filename")).toBe("Dinner receipt.pdf");
    expect(form.get("group_id")).toBe("3");
    expect(form.get("client_id")).toBe("draft-1");
  });

  it("uses native file upload on Android with structured form parameters", async () => {
    platform.OS = "android";
    const api = {
      upload: vi.fn(),
      uploadFile: vi.fn(async () => ({ id: 1 }))
    };

    await uploadReceipt(api as never, pickedReceipt, { friendshipId: 7, clientId: "draft-2" });

    expect(api.upload).not.toHaveBeenCalled();
    expect(api.uploadFile).toHaveBeenCalledWith("/api/receipts/", {
      uri: "file:///cache/receipt.pdf",
      fieldName: "file",
      mimeType: "application/pdf",
      parameters: {
        original_filename: "Dinner receipt.pdf",
        friendship_id: "7",
        client_id: "draft-2"
      }
    });
  });
});

const receipt: Receipt = {
  id: 42,
  expense_id: 1,
  original_filename: "Dinner receipt.pdf",
  content_type: "application/pdf",
  size_bytes: 120,
  uploaded_by_id: 3
};

describe("openReceipt", () => {
  it("opens downloaded Android receipts with a viewer intent instead of the share sheet", async () => {
    platform.OS = "android";
    downloadAsync.mockResolvedValueOnce({ status: 200, uri: "file:///cache/42-Dinner_receipt.pdf" });
    getContentUriAsync.mockResolvedValueOnce("content://splex/receipt/42");
    startActivityAsync.mockResolvedValueOnce({ resultCode: -1 });
    const api = {
      getBaseUrl: vi.fn(async () => "https://host.example.com"),
      getAccessToken: vi.fn(() => "access-token")
    };

    await openReceipt(api as never, receipt);

    expect(downloadAsync).toHaveBeenCalledWith(
      "https://host.example.com/api/receipts/42/download/",
      "file:///cache/42-Dinner_receipt.pdf",
      { headers: { Authorization: "Bearer access-token" } }
    );
    expect(getContentUriAsync).toHaveBeenCalledWith("file:///cache/42-Dinner_receipt.pdf");
    expect(startActivityAsync).toHaveBeenCalledWith("android.intent.action.VIEW", {
      data: "content://splex/receipt/42",
      type: "application/pdf",
      flags: 1
    });
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it("keeps the sharing fallback for non-Android native platforms", async () => {
    platform.OS = "ios";
    downloadAsync.mockResolvedValueOnce({ status: 200, uri: "file:///cache/42-Dinner_receipt.pdf" });
    isSharingAvailableAsync.mockResolvedValueOnce(true);
    const api = {
      getBaseUrl: vi.fn(async () => "https://host.example.com"),
      getAccessToken: vi.fn(() => null)
    };

    await openReceipt(api as never, receipt);

    expect(startActivityAsync).not.toHaveBeenCalled();
    expect(shareAsync).toHaveBeenCalledWith("file:///cache/42-Dinner_receipt.pdf", {
      mimeType: "application/pdf",
      dialogTitle: "Dinner receipt.pdf"
    });
  });
});
