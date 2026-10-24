import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteUpload, listUploads, saveUpload } from "@/lib/media";
import { mediaInUse } from "@/lib/theme-server";

/*
 * Galleria delle immagini caricate. Route handler e non server action perché le action hanno un
 * limite di 1 MB sul corpo della richiesta, troppo poco per un banner.
 */
async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

export async function GET() {
  if (!(await isAdmin())) return forbidden();
  return NextResponse.json(await listUploads());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return forbidden();
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  const r = await saveUpload(file);
  return r.ok ? NextResponse.json(r.upload) : NextResponse.json({ error: r.error }, { status: 400 });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return forbidden();
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (await mediaInUse(`/media/${name}`)) return NextResponse.json({ error: "IN_USE" }, { status: 409 });
  return (await deleteUpload(name)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
