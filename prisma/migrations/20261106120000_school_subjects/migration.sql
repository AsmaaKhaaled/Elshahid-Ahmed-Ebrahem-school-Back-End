-- The subjects table holds the school's subjects under the same names teachers' assignments use
-- (src/shared/constants/school-subjects.js), so exams & grades can be checked against them.

-- The old seeds' math subjects take the school's name for it
UPDATE "subjects" SET "nameArabic" = 'الرياضيات', "updatedAt" = CURRENT_TIMESTAMP WHERE "nameArabic" = 'رياضيات';

-- Subjects sharing a name become one row (the oldest). Everything pointing at the others moves to it first:
-- deleting a subject cascades to its exams, grades, materials and timetable rows.
CREATE TEMP TABLE "subject_merge" AS
SELECT "id" AS "old_id", "keep_id"
FROM (
  SELECT "id", first_value("id") OVER (PARTITION BY "nameArabic" ORDER BY "createdAt", "id") AS "keep_id"
  FROM "subjects"
) AS ranked
WHERE "id" <> "keep_id";

UPDATE "exams" SET "subjectId" = m."keep_id" FROM "subject_merge" m WHERE "exams"."subjectId" = m."old_id";
UPDATE "grades" SET "subjectId" = m."keep_id" FROM "subject_merge" m WHERE "grades"."subjectId" = m."old_id";
UPDATE "materials" SET "subjectId" = m."keep_id" FROM "subject_merge" m WHERE "materials"."subjectId" = m."old_id";
UPDATE "timetable" SET "subjectId" = m."keep_id" FROM "subject_merge" m WHERE "timetable"."subjectId" = m."old_id";

-- Teacher links ("A" = subject, "B" = teacher): drop the ones the kept subject already has, move the rest
DELETE FROM "_TeacherSubjects" ts
USING "subject_merge" m
WHERE ts."A" = m."old_id"
  AND EXISTS (SELECT 1 FROM "_TeacherSubjects" k WHERE k."A" = m."keep_id" AND k."B" = ts."B");
UPDATE "_TeacherSubjects" SET "A" = m."keep_id" FROM "subject_merge" m WHERE "_TeacherSubjects"."A" = m."old_id";

DELETE FROM "subjects" s USING "subject_merge" m WHERE s."id" = m."old_id";
DROP TABLE "subject_merge";

-- Every school subject not there yet
INSERT INTO "subjects" ("id", "code", "nameArabic", "nameEnglish", "gradeLevel", "updatedAt")
SELECT gen_random_uuid()::text, s.code, s.name_ar, s.name_en, 'جميع الصفوف', CURRENT_TIMESTAMP
FROM (VALUES
  ('ARB', 'اللغة العربية', 'Arabic'),
  ('ENG', 'اللغة الإنجليزية', 'English'),
  ('MATH', 'الرياضيات', 'Mathematics'),
  ('SCI', 'العلوم', 'Science'),
  ('SOC', 'الدراسات الاجتماعية', 'Social Studies'),
  ('REL-ISL', 'التربية الدينية الإسلامية', 'Islamic Religious Education'),
  ('REL-CHR', 'التربية الدينية المسيحية', 'Christian Religious Education'),
  ('CS', 'الحاسب الآلي', 'Computer Science'),
  ('ART', 'التربية الفنية', 'Art Education'),
  ('PE', 'التربية الرياضية', 'Physical Education')
) AS s(code, name_ar, name_en)
WHERE NOT EXISTS (SELECT 1 FROM "subjects" WHERE "nameArabic" = s.name_ar OR "code" = s.code);

-- One row per subject name
CREATE UNIQUE INDEX "subjects_nameArabic_key" ON "subjects"("nameArabic");
