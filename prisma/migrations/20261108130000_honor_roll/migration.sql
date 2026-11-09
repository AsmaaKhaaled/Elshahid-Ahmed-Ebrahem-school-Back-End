-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "HonorKind" AS ENUM ('TEACHER', 'STUDENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "honor_roll" (
    "id" TEXT NOT NULL,
    "kind" "HonorKind" NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT,
    "teacherId" TEXT,
    "studentId" TEXT,
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "section" TEXT,
    "achievement" TEXT,
    "academicYear" TEXT DEFAULT '2026/2027',
    "term" TEXT DEFAULT 'الفصل الدراسي الأول',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "honor_roll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "honor_roll_kind_idx" ON "honor_roll"("kind");
CREATE INDEX IF NOT EXISTS "honor_roll_isActive_idx" ON "honor_roll"("isActive");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "honor_roll" ADD CONSTRAINT "honor_roll_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "honor_roll" ADD CONSTRAINT "honor_roll_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

