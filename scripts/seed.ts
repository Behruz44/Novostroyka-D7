import { PrismaClient, Role, StageStatus, MarkStatus } from "@prisma/client";
import { scryptSync, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  const foremanPassword = process.env.SEED_FOREMAN_PASSWORD;

  if (!adminPassword || !ownerPassword || !foremanPassword) {
    throw new Error(
      "Missing SEED_ADMIN_PASSWORD, SEED_OWNER_PASSWORD, or SEED_FOREMAN_PASSWORD in environment",
    );
  }

  // --- Users ---
  const admin = await prisma.user.create({
    data: {
      phone: "+998501234561",
      name: "Администратор",
      passwordHash: hashPassword(adminPassword),
      role: Role.ADMIN,
    },
  });

  const owner = await prisma.user.create({
    data: {
      phone: "+998501234567",
      name: "Заказчик",
      passwordHash: hashPassword(ownerPassword),
      role: Role.OWNER,
    },
  });

  const foreman = await prisma.user.create({
    data: {
      phone: "+998501234563",
      name: "Прораб",
      passwordHash: hashPassword(foremanPassword),
      role: Role.FOREMAN,
    },
  });

  // --- Budget lines ---
  // TODO: replace with real customer data
  const budgetLinesData = [
    { category: "Фундаментные работы", plannedMinor: 2_000_000_000n },
    { category: "Каркас и перекрытия", plannedMinor: 4_000_000_000n },
    { category: "Электрика и освещение", plannedMinor: 1_500_000_000n },
    { category: "Покрытие и разметка", plannedMinor: 1_000_000_000n },
    { category: "Рампа и съезды", plannedMinor: 800_000_000n },
    { category: "Инженерные системы", plannedMinor: 700_000_000n },
  ];

  const totalBudgetMinor = budgetLinesData.reduce(
    (sum, bl) => sum + bl.plannedMinor,
    0n,
  );

  // --- Project ---
  const project = await prisma.project.create({
    data: {
      name: "Паркинг 8 этажей",
      address: "г. Ташкент, ул. Примерная, 1",
      totalBudgetMinor,
    },
  });

  // --- Project members ---
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: owner.id, role: Role.OWNER },
      { projectId: project.id, userId: foreman.id, role: Role.FOREMAN },
    ],
  });

  // --- Budget lines ---
  await prisma.budgetLine.createMany({
    data: budgetLinesData.map((bl) => ({
      ...bl,
      projectId: project.id,
    })),
  });

  // --- Stages ---
  // 4 common stages (floor=0) + 16 floor stages (8 floors x 2) = 20 total
  // weightBp = 500 each => sum = 10000 basis points
  const commonStages = [
    { name: "Фундамент", floor: 0, order: 1 },
    { name: "Рампа/съезды", floor: 0, order: 2 },
    { name: "Электрика и освещение", floor: 0, order: 3 },
    { name: "Покрытие и разметка", floor: 0, order: 4 },
  ];

  const floorStages: { name: string; floor: number; order: number }[] = [];
  let order = 5;
  for (let floor = 1; floor <= 8; floor++) {
    floorStages.push({ name: "Каркас", floor, order: order++ });
    floorStages.push({ name: "Перекрытие", floor, order: order++ });
  }

  const allStages = [...commonStages, ...floorStages];
  const weightBp = 500; // 10000 / 20

  await prisma.stage.createMany({
    data: allStages.map((s) => ({
      ...s,
      projectId: project.id,
      weightBp,
      status: StageStatus.WAIT,
    })),
  });

  console.log("Seed completed:");
  console.log(`  Users: 3 (admin, owner, foreman)`);
  console.log(`  Project 1: ${project.name}`);
  console.log(`  BudgetLines: ${budgetLinesData.length}, totalBudgetMinor: ${totalBudgetMinor}`);
  console.log(`  Stages: ${allStages.length}, weightBp each: ${weightBp}, sum: ${allStages.length * weightBp}`);
  console.log(`  ProjectMembers: 2 (owner, foreman)`);

  // --- Project 2: Sunrise Residence ---
  // TODO: replace with real customer data
  const budgetLinesData2 = [
    { category: "Фундаментные работы", plannedMinor: 500_000_000n },
    { category: "Каркас и перекрытия", plannedMinor: 800_000_000n },
    { category: "Отделка", plannedMinor: 400_000_000n },
    { category: "Инженерные системы", plannedMinor: 200_000_000n },
    { category: "Благоустройство", plannedMinor: 100_000_000n },
  ];

  const totalBudgetMinor2 = budgetLinesData2.reduce(
    (sum, bl) => sum + bl.plannedMinor,
    0n,
  );

  const project2 = await prisma.project.create({
    data: {
      name: "Sunrise Residence",
      address: "Анталья",
      totalBudgetMinor: totalBudgetMinor2,
    },
  });

  // Owner is member of BOTH projects; foreman is NOT
  await prisma.projectMember.create({
    data: { projectId: project2.id, userId: owner.id, role: Role.OWNER },
  });

  await prisma.budgetLine.createMany({
    data: budgetLinesData2.map((bl) => ({
      ...bl,
      projectId: project2.id,
    })),
  });

  // 4 common stages (floor=0) + 3 floors × 2 stages = 10 total
  // weightBp = 1000 each => sum = 10000 basis points
  const commonStages2 = [
    { name: "Фундамент", floor: 0, order: 1 },
    { name: "Инженерные сети", floor: 0, order: 2 },
    { name: "Благоустройство", floor: 0, order: 3 },
    { name: "Фасад", floor: 0, order: 4 },
  ];

  const floorStages2: { name: string; floor: number; order: number }[] = [];
  let order2 = 5;
  for (let floor = 1; floor <= 3; floor++) {
    floorStages2.push({ name: "Каркас", floor, order: order2++ });
    floorStages2.push({ name: "Отделка", floor, order: order2++ });
  }

  const allStages2 = [...commonStages2, ...floorStages2];
  const weightBp2 = 1000; // 10000 / 10

  await prisma.stage.createMany({
    data: allStages2.map((s) => ({
      ...s,
      projectId: project2.id,
      weightBp: weightBp2,
      status: StageStatus.WAIT,
    })),
  });

  // Demo: 1 expense on first budget line
  const bl2First = await prisma.budgetLine.findFirst({
    where: { projectId: project2.id },
    orderBy: { category: "asc" },
  });

  if (bl2First) {
    const expense2 = await prisma.expense.create({
      data: {
        projectId: project2.id,
        budgetLineId: bl2First.id,
        amountMinor: 150_000_000n,
        description: "Аванс за фундаментные работы",
        expenseDate: new Date(),
        createdBy: owner.id,
        clientRequestId: "seed-expense-sunrise-001",
      },
    });

    await prisma.eventLog.create({
      data: {
        projectId: project2.id,
        userId: owner.id,
        action: "EXPENSE_CREATED",
        entity: "Expense",
        entityId: expense2.id,
        clientRequestId: "seed-expense-sunrise-001",
      },
    });
  }

  // Demo: 1 StageMark in REVIEW (owner as creator since foreman is not a member)
  const stage2First = await prisma.stage.findFirst({
    where: { projectId: project2.id, floor: 0 },
    orderBy: { order: "asc" },
  });

  if (stage2First) {
    const mark2 = await prisma.stageMark.create({
      data: {
        stageId: stage2First.id,
        status: MarkStatus.REVIEW,
        photoKeys: ["sunrise-demo/foundation-photo.jpg"],
        comment: "Фундамент залит, фото приложено",
        createdBy: owner.id,
        clientRequestId: "seed-mark-sunrise-001",
      },
    });

    await prisma.eventLog.create({
      data: {
        projectId: project2.id,
        userId: owner.id,
        action: "MARK_CREATED",
        entity: "StageMark",
        entityId: mark2.id,
        clientRequestId: "seed-mark-sunrise-001",
      },
    });
  }

  console.log(`  Project 2: ${project2.name}`);
  console.log(`  BudgetLines: ${budgetLinesData2.length}, totalBudgetMinor: ${totalBudgetMinor2}`);
  console.log(`  Stages: ${allStages2.length}, weightBp each: ${weightBp2}, sum: ${allStages2.length * weightBp2}`);
  console.log(`  ProjectMembers: 1 (owner only, foreman excluded for isolation test)`);
  console.log(`  Demo data: 1 expense, 1 StageMark (REVIEW), 2 EventLog entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
