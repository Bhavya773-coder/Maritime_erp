-- CreateTable
CREATE TABLE "vessel_activity_logs" (
    "id" UUID NOT NULL,
    "vessel_id" UUID NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "summary" TEXT NOT NULL,
    "related_task_id" UUID,
    "reported_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vessel_activity_logs_vessel_id_idx" ON "vessel_activity_logs"("vessel_id");

-- CreateIndex
CREATE INDEX "vessel_activity_logs_created_at_idx" ON "vessel_activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "vessel_activity_logs" ADD CONSTRAINT "vessel_activity_logs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_activity_logs" ADD CONSTRAINT "vessel_activity_logs_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
