import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Esportazione dei dati di un cliente (diritto di accesso/portabilità, GDPR artt. 15 e 20). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { requests: { include: { package: { select: { nameIt: true, nameEn: true } } } } },
  });
  if (!user) return new NextResponse("Not found", { status: 404 });

  const data = {
    exportedAt: new Date().toISOString(),
    user: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      age: user.age,
      phone: user.phone,
      guardianName: user.guardianName,
      guardianConsentAt: user.guardianConsentAt,
      locale: user.locale,
      emailVerifiedAt: user.emailVerifiedAt,
      privacyAcceptedAt: user.privacyAcceptedAt,
      privacyVersion: user.privacyVersion,
      billing: user.billingJson ? JSON.parse(user.billingJson) : null,
      createdAt: user.createdAt,
    },
    requests: user.requests.map((r) => ({
      package: r.package.nameIt,
      status: r.status,
      slots: JSON.parse(r.slotsJson),
      notes: r.userNotes,
      priceCents: r.priceCents,
      billing: r.billingJson ? JSON.parse(r.billingJson) : null,
      createdAt: r.createdAt,
    })),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dati-${user.email.replace(/[^a-z0-9@._-]/gi, "_")}.json"`,
    },
  });
}
