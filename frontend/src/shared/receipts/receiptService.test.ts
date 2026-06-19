import { beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ OS: "web" as string }));

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn()
}));

import { uploadReceipt, type PickedReceipt } from "./receiptService";

const pickedReceipt: PickedReceipt = {
  uri: "file:///cache/receipt.pdf",
  name: "Dinner receipt.pdf",
  mimeType: "application/pdf",
  sizeBytes: 120
};

beforeEach(() => {
  platform.OS = "web";
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
