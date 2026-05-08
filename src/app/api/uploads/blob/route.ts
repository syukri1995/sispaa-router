import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error: "blob_token_missing",
        message: "Missing BLOB_READ_WRITE_TOKEN. Set it in .env (local) or Vercel Environment Variables.",
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    request,
    body,
    token,
    onBeforeGenerateToken: async () => {
      const validUntil = Math.floor(Date.now() / 1000) + 10 * 60;
      return {
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        validUntil,
        tokenPayload: JSON.stringify({ scope: "complaint_evidence" }),
      };
    },
    onUploadCompleted: async () => {
      // No-op: the client will store returned URL in complaint create call.
    },
  });

  return NextResponse.json(jsonResponse);
}

