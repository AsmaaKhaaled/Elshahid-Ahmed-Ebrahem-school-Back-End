-- CreateEnum
CREATE TYPE "CurriculumFileKind" AS ENUM ('BOOK', 'PLAN', 'EXAMS', 'GUIDE', 'OTHER');

-- CreateTable
CREATE TABLE "curricula" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "sections" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "planFileName" TEXT,
    "planFileSize" INTEGER,
    "planFileType" TEXT,
    "planFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_files" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "kind" "CurriculumFileKind" NOT NULL,
    "title" TEXT NOT NULL,
    "forStudents" BOOLEAN NOT NULL DEFAULT true,
    "link" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "fileKey" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_plan_weeks" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "curriculum_plan_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curricula_teacherId_updatedAt_idx" ON "curricula"("teacherId", "updatedAt");

-- CreateIndex
CREATE INDEX "curricula_updatedAt_idx" ON "curricula"("updatedAt");

-- CreateIndex
CREATE INDEX "curricula_sections_idx" ON "curricula" USING GIN ("sections");

-- CreateIndex
CREATE UNIQUE INDEX "curricula_teacherId_subject_gradeId_key" ON "curricula"("teacherId", "subject", "gradeId");

-- CreateIndex
CREATE INDEX "curriculum_files_curriculumId_uploadedAt_idx" ON "curriculum_files"("curriculumId", "uploadedAt");

-- CreateIndex
CREATE INDEX "curriculum_files_curriculumId_kind_uploadedAt_idx" ON "curriculum_files"("curriculumId", "kind", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_plan_weeks_curriculumId_week_key" ON "curriculum_plan_weeks"("curriculumId", "week");

-- AddForeignKey
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_files" ADD CONSTRAINT "curriculum_files_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_plan_weeks" ADD CONSTRAINT "curriculum_plan_weeks_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

