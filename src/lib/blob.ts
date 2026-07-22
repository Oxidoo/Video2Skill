import { put, type PutBlobResult } from "@vercel/blob";

/**
 * Upload a generated artifact (skill.md, report.json, timeline.json, ...) to
 * blob storage under a deterministic path so re-runs overwrite cleanly.
 * Reads BLOB_READ_WRITE_TOKEN from the environment (required in the worker;
 * automatic inside Vercel functions).
 */
export async function putArtifact(
  pathname: string,
  content: string | Buffer,
  contentType: string
): Promise<PutBlobResult> {
  return put(pathname, content, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}
