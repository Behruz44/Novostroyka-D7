import { NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export async function POST() {
  const existing = await prisma.user.findUnique({
    where: { phone: "+998501234599" },
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, message: "already exists" });
  }

  const tempOwner = await prisma.user.create({
    data: {
      phone: "+998501234599",
      name: "Временный Заказчик B",
      passwordHash: hashPassword("TempOwner2026!"),
      role: Role.OWNER,
    },
  });

  await prisma.projectMember.create({
    data: {
      projectId: "cmrjjkcj4000wzy8duy1inpw6",
      userId: tempOwner.id,
      role: Role.OWNER,
    },
  });

  return NextResponse.json({
    id: tempOwner.id,
    phone: "+998501234599",
    password: "TempOwner2026!",
    memberOf: "cmrjjkcj4000wzy8duy1inpw6 (Sunrise Residence ONLY)",
  });
}
