/*
  Warnings:

  - Added the required column `updated_at` to the `certifications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "certifications" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "asset_type" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "certifications_cert_type_idx" ON "certifications"("cert_type");

-- CreateIndex
CREATE INDEX "certifications_status_idx" ON "certifications"("status");

-- CreateIndex
CREATE INDEX "certifications_expiry_date_idx" ON "certifications"("expiry_date");
