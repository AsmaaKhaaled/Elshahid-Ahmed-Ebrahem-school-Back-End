-- Lesson materials (المواد والملفات التعليمية): the old one-file "materials" table was never used (it's empty);
-- it becomes a teacher's material with several files and / or a link, published to several classes.

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_classId_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "materials" DROP CONSTRAINT "materials_uploadedByTeacherId_fkey";

-- DropIndex
DROP INDEX "materials_subjectId_idx";

-- DropIndex
DROP INDEX "materials_classId_idx";

-- AlterTable
ALTER TABLE "materials" DROP COLUMN "classId",
DROP COLUMN "createdAt",
DROP COLUMN "fileName",
DROP COLUMN "fileSize",
DROP COLUMN "fileUrl",
DROP COLUMN "month",
DROP COLUMN "subjectId",
DROP COLUMN "type",
DROP COLUMN "uploadedById",
DROP COLUMN "uploadedByTeacherId",
ADD COLUMN     "link" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "subject" TEXT NOT NULL,
ADD COLUMN     "teacherId" TEXT NOT NULL,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "description" SET DEFAULT '';

-- DropEnum
DROP TYPE "MaterialType";

-- CreateTable
CREATE TABLE "material_files" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT,
    "fileKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MaterialClasses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MaterialClasses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "material_files_materialId_uploadedAt_idx" ON "material_files"("materialId", "uploadedAt");

-- CreateIndex
CREATE INDEX "_MaterialClasses_B_index" ON "_MaterialClasses"("B");

-- CreateIndex
CREATE INDEX "materials_teacherId_publishedAt_idx" ON "materials"("teacherId", "publishedAt");

-- CreateIndex
CREATE INDEX "materials_publishedAt_idx" ON "materials"("publishedAt");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_files" ADD CONSTRAINT "material_files_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaterialClasses" ADD CONSTRAINT "_MaterialClasses_A_fkey" FOREIGN KEY ("A") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MaterialClasses" ADD CONSTRAINT "_MaterialClasses_B_fkey" FOREIGN KEY ("B") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
