-- AlterTable
ALTER TABLE "teacher_attendance_days" ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "closedAt" DROP NOT NULL;

