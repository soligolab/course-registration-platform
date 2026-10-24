import { NextResponse } from "next/server";
import { readUpload } from "@/lib/media";

/** Immagini caricate dagli admin. I nomi sono unici, quindi la cache può essere permanente. */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const file = await readUpload((await params).name);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
