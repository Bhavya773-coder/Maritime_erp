-- AlterTable
ALTER TABLE "vessels" ADD COLUMN     "breadth" DECIMAL(6,2),
ADD COLUMN     "build_year" INTEGER,
ADD COLUMN     "classification" VARCHAR(150),
ADD COLUMN     "depth" DECIMAL(6,2),
ADD COLUMN     "irs_iv" VARCHAR(50),
ADD COLUMN     "length" DECIMAL(6,2),
ADD COLUMN     "remark" TEXT;
