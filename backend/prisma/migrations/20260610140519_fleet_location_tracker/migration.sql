-- AlterTable
ALTER TABLE "vessels" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "vessels_type_idx" ON "vessels"("type");

-- CreateIndex
CREATE INDEX "vessels_status_idx" ON "vessels"("status");

-- CreateIndex
CREATE INDEX "vessels_updated_at_idx" ON "vessels"("updated_at");
