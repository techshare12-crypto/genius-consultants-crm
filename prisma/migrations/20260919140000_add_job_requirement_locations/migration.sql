-- AlterTable
ALTER TABLE "applications" ADD COLUMN "targetLocation" TEXT;

-- CreateTable
CREATE TABLE "job_requirement_locations" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "vacancies" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_requirement_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_requirement_locations_jobId_idx" ON "job_requirement_locations"("jobId");

-- CreateIndex
CREATE INDEX "job_requirement_locations_city_idx" ON "job_requirement_locations"("city");

-- CreateIndex
CREATE INDEX "applications_targetLocation_idx" ON "applications"("targetLocation");

-- AddForeignKey
ALTER TABLE "job_requirement_locations" ADD CONSTRAINT "job_requirement_locations_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "job_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
