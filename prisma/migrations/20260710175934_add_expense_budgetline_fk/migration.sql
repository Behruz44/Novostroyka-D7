/*
  Warnings:

  - Added the required column `budgetLineId` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "budgetLineId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Expense_budgetLineId_idx" ON "Expense"("budgetLineId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
