import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE() {
  const tempUser = await prisma.user.findUnique({
    where: { phone: "+998501234599" },
  });

  if (!tempUser) {
    return NextResponse.json({ message: "temp owner not found" });
  }

  await prisma.projectMember.deleteMany({
    where: { userId: tempUser.id },
  });
  await prisma.user.delete({
    where: { id: tempUser.id },
  });

  return NextResponse.json({ deleted: tempUser.id });
}
