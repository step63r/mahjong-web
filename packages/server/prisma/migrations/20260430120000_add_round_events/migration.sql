-- CreateTable
CREATE TABLE "round_events" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "event_data" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "round_events_round_id_key" ON "round_events"("round_id");
CREATE INDEX "round_events_round_id_idx" ON "round_events"("round_id");

-- AddForeignKey
ALTER TABLE "round_events" ADD CONSTRAINT "round_events_round_id_fkey" 
  FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
