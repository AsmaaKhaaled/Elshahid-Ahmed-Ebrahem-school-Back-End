-- Read-only views to browse each kind of account on its own (the sign-in accounts stay in "users",
-- the people's details in "teachers" / "students"). No passwords. They follow the tables automatically.

-- The school administration: principal (SUPER_ADMIN) & admins, active or not
CREATE VIEW "accounts_admins" AS
SELECT
  u."id",
  u."fullName",
  u."nationalId",
  u."email",
  u."phone",
  u."jobTitle",
  u."role",
  u."status",
  (u."status" = 'ACTIVE') AS "isActive",
  u."permissions",
  u."createdAt"
FROM "users" u
WHERE u."role" IN ('SUPER_ADMIN', 'ADMIN');

-- Teachers, with their sign-in account (if they have one)
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
  u."role",
  u."status",
  (u."status" = 'ACTIVE') AS "isActive",
  u."forcePasswordChange" AS "mustChangePassword",
  u."id" AS "userId",
  t."createdAt"
FROM "teachers" t
LEFT JOIN "users" u ON u."id" = t."userId";

-- Students, with their class and sign-in account (if they have one)
CREATE VIEW "accounts_students" AS
SELECT
  s."id",
  s."studentCode",
  s."fullNameArabic",
  s."nationalId",
  c."name" AS "className",
  s."gradeLevel",
  s."enrollmentStatus",
  u."role",
  u."status",
  (u."status" = 'ACTIVE') AS "isActive",
  u."forcePasswordChange" AS "mustChangePassword",
  u."id" AS "userId",
  s."createdAt"
FROM "students" s
LEFT JOIN "users" u ON u."id" = s."userId"
LEFT JOIN "classes" c ON c."id" = s."classId";
