import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 2048) * 1024 * 1024;

// Issues short-lived client tokens so the browser uploads the video straight to
// blob storage (multipart), bypassing the 4.5 MB serverless request-body limit.
export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const userId = await currentUserId();
        if (!userId) throw new Error("Unauthorized");
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-matroska",
            "video/x-msvideo",
            "video/mpeg",
            "video/ogg",
            "application/octet-stream",
          ],
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      // The job is created from the client once upload() resolves, so there is
      // nothing to persist here. (This callback also does not fire on localhost.)
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    );
  }
}
