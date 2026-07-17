import { PrismaClient, Role } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  // Project A (Паркинг): cmrjjkcfw0003zy8d2kykh0wc
  // Project B (Sunrise): cmrjjkcj4000wzy8duy1inpw6

  const tempOwner = await prisma.user.create({
    data: {
      phone: "+998501234599",
      name: "Временный Заказчик B",
      passwordHash: hashPassword("TempOwner2026!"),
      role: Role.OWNER,
    },
  });

  // Member ONLY of project B (Sunrise Residence)
  await prisma.projectMember.create({
    data: {
      projectId: "cmrjjkcj4000wzy8duy1inpw6",
      userId: tempOwner.id,
      role: Role.OWNER,
    },
  });

  console.log("Temp owner created:", tempOwner.id);
  console.log("Phone: +998501234599");
  console.log("Password: TempOwner2026!");
  console.log("Member of: Sunrise Residence ONLY");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
