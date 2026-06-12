/*
  Warnings:

  - Added the required column `updated_at` to the `expense_vouchers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "expense_vouchers" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "expense_vouchers_status_idx" ON "expense_vouchers"("status");

-- CreateIndex
CREATE INDEX "expense_vouchers_expense_type_idx" ON "expense_vouchers"("expense_type");

-- CreateIndex
CREATE INDEX "expense_vouchers_expense_date_idx" ON "expense_vouchers"("expense_date");

-- CreateIndex
CREATE INDEX "expense_vouchers_actioned_at_idx" ON "expense_vouchers"("actioned_at");
