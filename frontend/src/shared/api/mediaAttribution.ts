import { ApiClient } from "./client";

const MEDIA_TOKEN_PATTERN = /\/api\/media\/([^/?#]+)\//;

/**
 * Fetch the attribution string stored for a backend media URL. Returns an
 * empty string when the URL isn't ours (data: / blob: / external) or when no
 * attribution is stored.
 *
 * Backed by `/api/media/<token>/attribution/`, which looks up the owning User
 * or Group by the file path encoded in the signed media token.
 */
export async function fetchMediaAttribution(api: ApiClient, imageUrl: string | undefined): Promise<string> {
  if (!imageUrl) return "";
  const match = MEDIA_TOKEN_PATTERN.exec(imageUrl);
  if (!match) return "";
  const token = match[1];
  try {
    const response = await api.get<{ attribution: string }>(`/api/media/${token}/attribution/`);
    return response.attribution ?? "";
  } catch {
    return "";
  }
}
