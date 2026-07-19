-- AlterTable
ALTER TABLE "Stage" ADD COLUMN     "dependsOnStageId" TEXT;

-- CreateIndex
CREATE INDEX "Stage_dependsOnStageId_idx" ON "Stage"("dependsOnStageId");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_dependsOnStageId_fkey" FOREIGN KEY ("dependsOnStageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
