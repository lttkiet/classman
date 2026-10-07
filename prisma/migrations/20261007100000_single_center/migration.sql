ALTER TABLE "Center" ADD COLUMN "singleton" BOOLEAN NOT NULL DEFAULT TRUE;
CREATE UNIQUE INDEX "Center_singleton_key" ON "Center"("singleton");
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");
