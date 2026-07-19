import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, phone: true, name: true, role: true } });
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const members = await prisma.projectMember.findMany({ select: { projectId: true, userId: true, role: true } });
  const stages = await prisma.stage.findMany({ select: { id: true, projectId: true, name: true, floor: true, status: true, plannedStart: true, plannedEnd: true, contractorId: true }, orderBy: [{ projectId: "asc" }, { floor: "asc" }] });
  const budgetLines = await prisma.budgetLine.findMany({ select: { id: true, projectId: true, category: true } });
  const contractors = await prisma.contractor.findMany();
  console.log("USERS:", JSON.stringify(users, null, 2));
  console.log("PROJECTS:", JSON.stringify(projects, null, 2));
  console.log("MEMBERS:", JSON.stringify(members, null, 2));
  console.log("STAGES:", JSON.stringify(stages, null, 2));
  console.log("BUDGET_LINES:", JSON.stringify(budgetLines, null, 2));
  console.log("CONTRACTORS:", JSON.stringify(contractors, null, 2));
}

main().finally(() => prisma.$disconnect());
