-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "teachingAssignments" JSONB NOT NULL DEFAULT '[]';
