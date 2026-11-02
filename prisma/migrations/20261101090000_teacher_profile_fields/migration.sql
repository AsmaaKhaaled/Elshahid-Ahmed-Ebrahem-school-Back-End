-- CreateEnum
CREATE TYPE "TeacherEmploymentStatus" AS ENUM ('ON_DUTY', 'ON_LEAVE', 'SECONDED');

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "employmentStatus" "TeacherEmploymentStatus" NOT NULL DEFAULT 'ON_DUTY',
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "teachingSubjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

