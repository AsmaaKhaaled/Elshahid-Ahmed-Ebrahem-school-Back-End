import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';

/**
 * Where each kind of sign-in account lives:
 * - the school administration (SUPER_ADMIN, ADMIN): "users"
 * - teachers: "teachers"     - students: "students"
 * A token carries the account's id and role, and the role says which table the id is in.
 * Everything here returns one shape (see toAccount), whichever table the account came from.
 */

export const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const MODEL_OF_ROLE = { SUPER_ADMIN: 'user', ADMIN: 'user', TEACHER: 'teacher', STUDENT: 'student' };

export const modelOfRole = (role) => MODEL_OF_ROLE[role] ?? null;

// The profile the sign-in & session responses carry (as before: the student's class, the teacher's subjects & classes)
const PROFILE_INCLUDE = {
  teacher: { subjects: true, classes: true },
  student: { class: { select: { id: true, name: true, displayNameArabic: true, gradeLevel: true } } },
};

/** One shape for an account from any of the three tables (`password` only when the query asked for it). */
const toAccount = (model, row) => {
  if (model === 'user') {
    return {
      model,
      id: row.id,
      role: row.role,
      status: row.status,
      forcePasswordChange: row.forcePasswordChange,
      password: row.password,
      fullName: row.fullName || row.name || '',
      nationalId: row.nationalId,
      email: row.email,
      studentCode: null,
      phone: row.phone,
      jobTitle: row.jobTitle,
      permissions: row.permissions || [],
      profile: null,
      teacherProfile: null,
      studentProfile: null,
    };
  }

  const { password, ...profile } = row;
  const isTeacher = model === 'teacher';
  return {
    model,
    id: row.id,
    role: row.role,
    status: row.status,
    forcePasswordChange: row.forcePasswordChange,
    password,
    fullName: row.fullNameArabic,
    nationalId: row.nationalId,
    email: isTeacher ? row.email : null,
    studentCode: isTeacher ? null : row.studentCode,
    phone: isTeacher ? row.phone : null,
    jobTitle: isTeacher ? row.jobTitle : null,
    permissions: [],
    profile,
    // What the rest of the app reads to scope a teacher / student (req.user.teacherProfile / studentProfile)
    teacherProfile: isTeacher ? { id: row.id } : null,
    studentProfile: isTeacher
      ? null
      : { id: row.id, classId: row.classId, nationalId: row.nationalId, studentCode: row.studentCode },
  };
};

const queryOf = (model, { withPassword, withProfile }) => ({
  ...(model !== 'user' && withPassword && { omit: { password: false } }),
  ...(withProfile && PROFILE_INCLUDE[model] && { include: PROFILE_INCLUDE[model] }),
});

/** The account a token points at (its role says which table), or null. */
export const findAccount = async (role, id, { withPassword = false, withProfile = false } = {}) => {
  const model = modelOfRole(role);
  if (!model || !id) return null;
  let row = await prisma[model].findUnique({ where: { id }, ...queryOf(model, { withPassword, withProfile }) });
  if (!row && model !== 'user') {
    row = await prisma.user.findUnique({ where: { id } });
    if (row && row.role === role) return toAccount('user', row);
  }
  // A token's role must match the account's (an admin's id is never accepted as a teacher's)
  return row && row.role === role ? toAccount(model, row) : null;
};

/**
 * The account a sign-in identifier belongs to: an admin's national ID / email, a teacher's national ID /
 * teacher code / email, or a student's national ID / student code. National IDs are unique across the
 * three tables (checked whenever an account is created or edited, see assertIdentityFree).
 */
export const findAccountByIdentifier = async (identifier, { withPassword = false, withProfile = false } = {}) => {
  const value = identifier.trim();
  const email = value.toLowerCase();
  const lookups = [
    ['user', { OR: [{ email }, { nationalId: value }] }],
    ['teacher', { OR: [{ nationalId: value }, { teacherCode: value }, { email }] }],
    ['student', { OR: [{ nationalId: value }, { studentCode: value }] }],
  ];
  for (const [model, where] of lookups) {
    const row = await prisma[model].findFirst({ where, ...queryOf(model, { withPassword, withProfile }) });
    if (row) return toAccount(model, row);
  }
  return null;
};

/** Sets an account's password (already hashed) and clears its first-sign-in flag. */
export const setAccountPassword = (account, passwordHash) =>
  prisma[account.model].update({
    where: { id: account.id },
    data: { password: passwordHash, forcePasswordChange: false },
    select: { id: true },
  });

/** What `req.user` holds for a signed-in account (never the password). */
export const toSessionUser = ({ password, profile, model, ...account }) => account;

/** The sign-in & session responses' user object (same fields as before the accounts were split). */
export const toUserResponse = (account) => ({
  id: account.id,
  fullName: account.fullName,
  email: account.email,
  nationalId: account.nationalId,
  studentCode: account.studentCode,
  role: account.role,
  status: account.status,
  permissions: account.permissions,
  phone: account.phone,
  jobTitle: account.jobTitle,
  profile: account.profile,
});

/**
 * Sign-in identifiers must point at one account: a national ID (or an email) used by an account
 * in one table can't be given to an account in another. `except`: the account being edited.
 */
export const assertIdentityFree = async ({ nationalId, email }, except = {}) => {
  const not = (model) => (except.model === model && except.id ? { id: { not: except.id } } : {});
  const checks = [];
  if (nationalId) {
    checks.push(
      prisma.user.findFirst({ where: { nationalId, ...not('user') }, select: { id: true } }),
      prisma.teacher.findFirst({ where: { nationalId, ...not('teacher') }, select: { id: true } }),
      prisma.student.findFirst({ where: { nationalId, ...not('student') }, select: { id: true } })
    );
  }
  const [nidUser, nidTeacher, nidStudent] = await Promise.all(checks);
  if (nidUser || nidTeacher || nidStudent) {
    throw AppError.conflict('الرقم القومي مسجل بالفعل لحساب آخر');
  }

  if (email) {
    const [emailUser, emailTeacher] = await Promise.all([
      prisma.user.findFirst({ where: { email, ...not('user') }, select: { id: true } }),
      prisma.teacher.findFirst({ where: { email, ...not('teacher') }, select: { id: true } }),
    ]);
    if (emailUser || emailTeacher) {
      throw AppError.conflict('البريد الإلكتروني مسجل بالفعل لحساب آخر');
    }
  }
};

const READER_COLUMN = { user: 'userId', teacher: 'teacherId', student: 'studentId' };

/**
 * Who read an announcement, as announcement_reads columns: { userId } for an admin, { teacherId } for a
 * teacher, { studentId } for a student. null for a visitor.
 */
export const readerOf = (user) => {
  const column = READER_COLUMN[modelOfRole(user?.role)];
  return column && user.id ? { [column]: user.id } : null;
};

/**
 * "Who did it" columns: an admin goes in the users column, a teacher in the teachers one,
 * e.g. doneBy(req.user, 'recordedById', 'recordedByTeacherId').
 */
export const doneBy = (user, adminField, teacherField) => ({
  [adminField]: user && modelOfRole(user.role) === 'user' ? user.id : null,
  [teacherField]: user?.role === 'TEACHER' ? user.id : null,
});
