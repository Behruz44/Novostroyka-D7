-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contractor_projectId_idx" ON "Contractor"("projectId");

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Stage
ALTER TABLE "Stage" ADD COLUMN "contractorId" TEXT;

-- CreateIndex
CREATE INDEX "Stage_contractorId_idx" ON "Stage"("contractorId");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Expense
ALTER TABLE "Expense" ADD COLUMN "contractorId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_contractorId_idx" ON "Expense"("contractorId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
