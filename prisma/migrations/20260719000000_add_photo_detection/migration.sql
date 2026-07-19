-- CreateTable
CREATE TABLE "PhotoDetection" (
    "id" TEXT NOT NULL,
    "photoKey" TEXT NOT NULL,
    "detections" JSONB NOT NULL,
    "modelId" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoDetection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoDetection_photoKey_key" ON "PhotoDetection"("photoKey");
