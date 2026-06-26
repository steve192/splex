import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));

import { ApiError } from "../../shared/api/client";
import { receiptUploadErrorMessage } from "./useReceiptUploadHelpers";

const translations: Record<string, string> = {
  "common.error": "generic-error",
  "write.offline": "offline-write",
  "receipts.uploadFailed": "upload-failed",
  "receipts.typeInvalid": "unsupported-file-type"
};
const t = (key: string) => translations[key] ?? key;

describe("receiptUploadErrorMessage", () => {
  it("uses the receipt upload fallback for native failures before an HTTP response", () => {
    expect(receiptUploadErrorMessage(new ApiError("Upload failed before the server responded."), t)).toBe(
      "upload-failed"
    );
  });

  it("keeps the offline write message for actual offline upload failures", () => {
    expect(receiptUploadErrorMessage(new ApiError("Network unavailable", { offline: true }), t)).toBe(
      "offline-write"
    );
  });

  it("uses the translated receipt message for a typed backend upload error", () => {
    expect(
      receiptUploadErrorMessage(
        new ApiError("Unsupported file type.", {
          status: 400,
          code: "receipt_type_invalid"
        }),
        t
      )
    ).toBe("unsupported-file-type");
  });

  it("preserves backend validation messages", () => {
    expect(receiptUploadErrorMessage(new ApiError("File type not recognized.", { status: 400 }), t)).toBe(
      "File type not recognized."
    );
  });
});
