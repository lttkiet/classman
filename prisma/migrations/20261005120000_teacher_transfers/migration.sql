CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetTeacherId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "responseMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransferRequest_centerId_status_createdAt_idx" ON "TransferRequest"("centerId", "status", "createdAt");
CREATE INDEX "TransferRequest_requesterId_status_idx" ON "TransferRequest"("requesterId", "status");
CREATE INDEX "TransferRequest_targetTeacherId_status_idx" ON "TransferRequest"("targetTeacherId", "status");
CREATE INDEX "TransferRequest_learnerId_status_idx" ON "TransferRequest"("learnerId", "status");
CREATE UNIQUE INDEX "TransferRequest_one_pending_per_learner_idx" ON "TransferRequest"("learnerId") WHERE "status" = 'PENDING';

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_targetTeacherId_fkey" FOREIGN KEY ("targetTeacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
