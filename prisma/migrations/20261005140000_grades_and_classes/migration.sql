CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TeachingGroup" ADD COLUMN "gradeId" TEXT;

CREATE UNIQUE INDEX "Grade_centerId_name_key" ON "Grade"("centerId", "name");
CREATE UNIQUE INDEX "TeachingGroup_centerId_name_key" ON "TeachingGroup"("centerId", "name");
CREATE INDEX "Grade_centerId_status_idx" ON "Grade"("centerId", "status");
CREATE INDEX "TeachingGroup_gradeId_idx" ON "TeachingGroup"("gradeId");

ALTER TABLE "Grade" ADD CONSTRAINT "Grade_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeachingGroup" ADD CONSTRAINT "TeachingGroup_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
