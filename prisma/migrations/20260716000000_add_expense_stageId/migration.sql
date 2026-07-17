-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "stageId" TEXT;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_stageId_fkey"
  FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Expense_stageId_idx" ON "Expense"("stageId");
