-- CreateEnum
CREATE TYPE "BotChannel" AS ENUM ('WHATSAPP', 'INTERNAL_TEST');

-- CreateEnum
CREATE TYPE "BotMessageDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- CreateEnum
CREATE TYPE "BotCommandStatus" AS ENUM ('PARSED', 'EXECUTED', 'NEEDS_CONFIRMATION', 'FAILED');

-- CreateEnum
CREATE TYPE "BotReminderType" AS ENUM ('TASK_PENDING');

-- CreateEnum
CREATE TYPE "BotReminderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateTable
CREATE TABLE "user_contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone_number" VARCHAR(50) NOT NULL,
    "channel" "BotChannel" NOT NULL DEFAULT 'WHATSAPP',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_messages" (
    "id" UUID NOT NULL,
    "direction" "BotMessageDirection" NOT NULL,
    "channel" "BotChannel" NOT NULL,
    "from_user_id" UUID,
    "to_user_id" UUID,
    "from_phone" VARCHAR(50),
    "to_phone" VARCHAR(50),
    "raw_text" TEXT NOT NULL,
    "message_type" VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "provider_message_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_commands" (
    "id" UUID NOT NULL,
    "bot_message_id" UUID NOT NULL,
    "intent" VARCHAR(100) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "parsed_json" JSONB NOT NULL,
    "linked_task_id" UUID,
    "status" "BotCommandStatus" NOT NULL DEFAULT 'PARSED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_reminders" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "assigned_to_id" UUID NOT NULL,
    "reminder_type" "BotReminderType" NOT NULL DEFAULT 'TASK_PENDING',
    "frequency_hours" INTEGER NOT NULL DEFAULT 24,
    "next_reminder_at" TIMESTAMP(3) NOT NULL,
    "last_reminder_at" TIMESTAMP(3),
    "status" "BotReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_contacts_user_id_idx" ON "user_contacts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_contacts_user_id_phone_number_channel_key" ON "user_contacts"("user_id", "phone_number", "channel");

-- CreateIndex
CREATE INDEX "bot_messages_from_user_id_idx" ON "bot_messages"("from_user_id");

-- CreateIndex
CREATE INDEX "bot_messages_to_user_id_idx" ON "bot_messages"("to_user_id");

-- CreateIndex
CREATE INDEX "bot_messages_channel_idx" ON "bot_messages"("channel");

-- CreateIndex
CREATE INDEX "bot_messages_created_at_idx" ON "bot_messages"("created_at");

-- CreateIndex
CREATE INDEX "bot_commands_bot_message_id_idx" ON "bot_commands"("bot_message_id");

-- CreateIndex
CREATE INDEX "bot_commands_linked_task_id_idx" ON "bot_commands"("linked_task_id");

-- CreateIndex
CREATE INDEX "bot_reminders_task_id_idx" ON "bot_reminders"("task_id");

-- CreateIndex
CREATE INDEX "bot_reminders_assigned_to_id_idx" ON "bot_reminders"("assigned_to_id");

-- CreateIndex
CREATE INDEX "bot_reminders_status_idx" ON "bot_reminders"("status");

-- CreateIndex
CREATE INDEX "bot_reminders_next_reminder_at_idx" ON "bot_reminders"("next_reminder_at");

-- AddForeignKey
ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_commands" ADD CONSTRAINT "bot_commands_bot_message_id_fkey" FOREIGN KEY ("bot_message_id") REFERENCES "bot_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_commands" ADD CONSTRAINT "bot_commands_linked_task_id_fkey" FOREIGN KEY ("linked_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_reminders" ADD CONSTRAINT "bot_reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_reminders" ADD CONSTRAINT "bot_reminders_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
