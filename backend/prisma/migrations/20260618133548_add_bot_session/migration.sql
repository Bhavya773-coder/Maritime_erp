/*
  Warnings:

  - You are about to drop the `user_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_user_id_fkey";

-- DropTable
DROP TABLE "user_sessions";

-- CreateTable
CREATE TABLE "bot_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bot_sessions_user_id_key" ON "bot_sessions"("user_id");
