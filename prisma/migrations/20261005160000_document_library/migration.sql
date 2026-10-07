CREATE TYPE "LibraryScope" AS ENUM ('COMMON', 'GRADE', 'CLASS');

CREATE TABLE "LibraryDocument" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "scope" "LibraryScope" NOT NULL,
    "gradeId" TEXT,
    "groupId" TEXT,
    "uploadedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryDocument_centerId_scope_createdAt_idx" ON "LibraryDocument"("centerId", "scope", "createdAt");
CREATE INDEX "LibraryDocument_gradeId_idx" ON "LibraryDocument"("gradeId");
CREATE INDEX "LibraryDocument_groupId_idx" ON "LibraryDocument"("groupId");

ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "Center"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TeachingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
