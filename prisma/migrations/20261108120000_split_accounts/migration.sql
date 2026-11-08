-- "users" keeps the school administration's accounts only (SUPER_ADMIN & ADMIN).
-- A teacher's / student's sign-in account (password, role, status, first-sign-in flag) moves onto their own row,
-- and "who did it" columns get a teacher column next to the admin one.

-- The account views read teachers."userId" / students."userId": rebuilt at the end
DROP VIEW IF EXISTS "accounts_teachers";
DROP VIEW IF EXISTS "accounts_students";

-- 1. Accounts on the teachers & students rows
ALTER TABLE "teachers"
  ADD COLUMN "password" TEXT,
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'TEACHER',
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "forcePasswordChange" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "students"
  ADD COLUMN "password" TEXT,
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'STUDENT',
  ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "forcePasswordChange" BOOLEAN NOT NULL DEFAULT true;

UPDATE "teachers" t
SET "password" = u."password", "status" = u."status", "forcePasswordChange" = u."forcePasswordChange",
    "email" = COALESCE(t."email", u."email")
FROM "users" u WHERE u."id" = t."userId";

UPDATE "students" s
SET "password" = u."password", "status" = u."status", "forcePasswordChange" = u."forcePasswordChange"
FROM "users" u WHERE u."id" = s."userId";

-- 2. "Who did it": a teacher column next to the admin one, and the teachers' rows move to it
ALTER TABLE "attendances" ADD COLUMN "recordedByTeacherId" TEXT;
ALTER TABLE "grades" ADD COLUMN "recordedByTeacherId" TEXT;
ALTER TABLE "exams" ADD COLUMN "announcedByTeacherId" TEXT;
ALTER TABLE "materials" ADD COLUMN "uploadedByTeacherId" TEXT;
ALTER TABLE "announcements" ADD COLUMN "authorTeacherId" TEXT;

UPDATE "attendances" x SET "recordedByTeacherId" = t."id", "recordedById" = NULL FROM "teachers" t WHERE t."userId" = x."recordedById";
UPDATE "grades" x SET "recordedByTeacherId" = t."id", "recordedById" = NULL FROM "teachers" t WHERE t."userId" = x."recordedById";
UPDATE "exams" x SET "announcedByTeacherId" = t."id", "announcedById" = NULL FROM "teachers" t WHERE t."userId" = x."announcedById";
UPDATE "materials" x SET "uploadedByTeacherId" = t."id", "uploadedById" = NULL FROM "teachers" t WHERE t."userId" = x."uploadedById";
UPDATE "announcements" x SET "authorTeacherId" = t."id", "authorId" = NULL FROM "teachers" t WHERE t."userId" = x."authorId";

ALTER TABLE "attendances" ADD CONSTRAINT "attendances_recordedByTeacherId_fkey" FOREIGN KEY ("recordedByTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "grades" ADD CONSTRAINT "grades_recordedByTeacherId_fkey" FOREIGN KEY ("recordedByTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_announcedByTeacherId_fkey" FOREIGN KEY ("announcedByTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "materials" ADD CONSTRAINT "materials_uploadedByTeacherId_fkey" FOREIGN KEY ("uploadedByTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorTeacherId_fkey" FOREIGN KEY ("authorTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Announcement reads: by an admin, a teacher or a student (exactly one)
ALTER TABLE "announcement_reads"
  ADD COLUMN "teacher_id" TEXT,
  ADD COLUMN "student_id" TEXT,
  ALTER COLUMN "user_id" DROP NOT NULL;

UPDATE "announcement_reads" r SET "teacher_id" = t."id", "user_id" = NULL FROM "teachers" t WHERE t."userId" = r."user_id";
UPDATE "announcement_reads" r SET "student_id" = s."id", "user_id" = NULL FROM "students" s WHERE s."userId" = r."user_id";

ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_one_reader"
  CHECK (num_nonnulls("user_id", "teacher_id", "student_id") = 1);
CREATE UNIQUE INDEX "announcement_reads_announcement_id_teacher_id_key" ON "announcement_reads"("announcement_id", "teacher_id");
CREATE UNIQUE INDEX "announcement_reads_announcement_id_student_id_key" ON "announcement_reads"("announcement_id", "student_id");
CREATE INDEX "announcement_reads_teacher_id_idx" ON "announcement_reads"("teacher_id");
CREATE INDEX "announcement_reads_student_id_idx" ON "announcement_reads"("student_id");

-- 4. Teachers & students no longer point at "users"; their old accounts there go away
ALTER TABLE "teachers" DROP COLUMN "userId";
ALTER TABLE "students" DROP COLUMN "userId";
DELETE FROM "users" WHERE "role" IN ('TEACHER', 'STUDENT');
ALTER TABLE "users" DROP COLUMN "studentCode";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN';

-- 5. The account views, from the teachers' & students' own columns now
CREATE VIEW "accounts_teachers" AS
SELECT
  t."id",
  t."teacherCode",
  t."fullNameArabic",
  t."nationalId",
  t."phone",
  t."specialization",
  t."teachingSubjects",
  t."employmentStatus",
  t."role",
  t."status",
  (t."status" = 'ACTIVE') AS "isActive",
  t."forcePasswordChange" AS "mustChangePassword",
  t."createdAt"
FROM "teachers" t;

CREATE VIEW "accounts_students" AS
SELECT
  s."id",
  s."studentCode",
  s."fullNameArabic",
  s."nationalId",
  c."name" AS "className",
  s."gradeLevel",
  s."enrollmentStatus",
  s."role",
  s."status",
  (s."status" = 'ACTIVE') AS "isActive",
  s."forcePasswordChange" AS "mustChangePassword",
  s."createdAt"
FROM "students" s
LEFT JOIN "classes" c ON c."id" = s."classId";
