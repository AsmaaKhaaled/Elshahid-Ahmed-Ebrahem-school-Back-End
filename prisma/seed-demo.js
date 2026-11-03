/**
 * Demo data for testing with a realistic amount of records (students per class, teachers with classes).
 *
 *   npm run seed:demo          -> removes any previous demo data, then adds it again
 *   npm run seed:demo:clean    -> removes the demo data only
 *
 * Every demo record is tagged so it can be removed without touching real data:
 *   students  -> studentCode starts with "DEMO-"
 *   teachers  -> teacherCode starts with "TCH-D"
 * Their login accounts (users) are removed with them. Demo passwords: Student@2026 / Teacher@2026.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STUDENT_CODE_PREFIX = 'DEMO-';
const TEACHER_CODE_PREFIX = 'TCH-D';
const YEAR = 2026;

// Students per class: uneven on purpose (an empty-ish class, mid-size ones, and 3/2 big enough for several pages)
const CLASS_SIZES = {
  '1/1': 12, '1/2': 8, '1/3': 10, '1/4': 3,
  '2/1': 9, '2/2': 25, '2/3': 7, '2/4': 0,
  '3/1': 14, '3/2': 50, '3/3': 35, '3/4': 20,
};

// Birth year by grade (1st prep ≈ 12 years old)
const BIRTH_YEAR = { 1: 2014, 2: 2013, 3: 2012 };

const BOYS = ['محمد', 'أحمد', 'محمود', 'مصطفى', 'عمر', 'يوسف', 'علي', 'حسن', 'كريم', 'زياد', 'آدم', 'مازن', 'سيف', 'إياد', 'عبد الرحمن', 'خالد', 'إبراهيم', 'مروان', 'أنس', 'ياسين'];
const GIRLS = ['مريم', 'فاطمة', 'سلمى', 'ملك', 'جنى', 'نور', 'حبيبة', 'رقية', 'آية', 'منة', 'هنا', 'لمى', 'سارة', 'ريم', 'دينا', 'شهد', 'جودي', 'تسنيم', 'رحمة', 'ندى'];
const FATHERS = ['محمد', 'أحمد', 'محمود', 'السيد', 'عبد الله', 'إبراهيم', 'حسن', 'طارق', 'هشام', 'وليد', 'عادل', 'سامح', 'أشرف', 'ياسر', 'جمال', 'رضا'];
const FAMILIES = ['عبد العزيز', 'الشناوي', 'سليمان', 'فرج', 'عثمان', 'النجار', 'الشافعي', 'منصور', 'حجازي', 'عبد الحميد', 'رمضان', 'الدسوقي', 'شاهين', 'البنا', 'زكي', 'مرسي'];
// The school's only statuses: منتظم / موقوف / منقول (≈80% regular)
const STATUSES = ['منتظم', 'منتظم', 'منتظم', 'منتظم', 'منتظم', 'منتظم', 'منتظم', 'منتظم', 'موقوف', 'منقول'];
const PHONE_PREFIXES = ['010', '011', '012', '015'];

const TEACHERS = [
  { name: 'أحمد محمود السيد', specialization: 'اللغة العربية', subjects: ['اللغة العربية'], classes: ['1/1', '1/2', '3/2'], advises: '1/1' },
  { name: 'منى عبد الله حسن', specialization: 'اللغة الإنجليزية', subjects: ['اللغة الإنجليزية'], classes: ['2/1', '2/2', '3/2', '3/3'], advises: '2/2' },
  { name: 'محمد إبراهيم عثمان', specialization: 'العلوم', subjects: ['العلوم'], classes: ['3/1', '3/2', '3/3', '3/4'], advises: '3/1' },
  { name: 'هالة سامح منصور', specialization: 'الدراسات الاجتماعية', subjects: ['الدراسات الاجتماعية'], classes: ['1/3', '1/4', '2/3'] },
  { name: 'طارق وليد النجار', specialization: 'الرياضيات', subjects: ['الرياضيات'], classes: ['1/1', '1/2', '1/3', '1/4'], advises: '1/3' },
  { name: 'سمر أشرف شاهين', specialization: 'التربية الدينية', subjects: ['التربية الدينية الإسلامية'], classes: ['2/1', '2/2', '2/3', '2/4'] },
  { name: 'خالد ياسر فرج', specialization: 'الحاسب الآلي', subjects: ['الحاسب الآلي'], classes: ['3/2', '3/3'], status: 'ON_LEAVE' },
  { name: 'إيمان جمال زكي', specialization: 'التربية الفنية', subjects: ['التربية الفنية'], classes: ['1/2', '2/2', '3/4'] },
  { name: 'وائل رضا البنا', specialization: 'التربية الرياضية', subjects: ['التربية الرياضية'], classes: ['3/1', '3/4'], status: 'SECONDED' },
  { name: 'نهى عادل مرسي', specialization: 'التربية الدينية', subjects: ['التربية الدينية المسيحية'], classes: [] }, // not assigned yet
];

const pad = (n, size) => String(n).padStart(size, '0');
const pick = (list, i) => list[i % list.length];

async function clean() {
  const demoStudents = await prisma.student.findMany({
    where: { studentCode: { startsWith: STUDENT_CODE_PREFIX } },
    select: { userId: true },
  });
  const demoTeachers = await prisma.teacher.findMany({
    where: { teacherCode: { startsWith: TEACHER_CODE_PREFIX } },
    select: { userId: true },
  });
  const userIds = [...demoStudents, ...demoTeachers].map((r) => r.userId).filter(Boolean);

  // Deleting a teacher clears them as class advisor (onDelete: SetNull) and from class assignments
  const [students, teachers, users] = await prisma.$transaction([
    prisma.student.deleteMany({ where: { studentCode: { startsWith: STUDENT_CODE_PREFIX } } }),
    prisma.teacher.deleteMany({ where: { teacherCode: { startsWith: TEACHER_CODE_PREFIX } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
  console.log(`🧹 Removed demo data: ${students.count} students, ${teachers.count} teachers, ${users.count} accounts`);
}

async function seedStudents(classesByName, passwordHash) {
  const students = [];
  let seq = 0;

  for (const [className, size] of Object.entries(CLASS_SIZES)) {
    const cls = classesByName.get(className);
    if (!cls) {
      console.warn(`⚠️ Class ${className} not found, skipped`);
      continue;
    }
    const grade = Number(className[0]);

    for (let i = 0; i < size; i++) {
      seq += 1;
      const isGirl = seq % 2 === 0;
      const father = pick(FATHERS, seq * 7);
      const family = pick(FAMILIES, seq * 3);
      const fullName = `${pick(isGirl ? GIRLS : BOYS, seq * 5 + i)} ${father} ${family}`;
      const status = pick(STATUSES, seq);
      const isActive = status === 'منتظم';

      // Egyptian national ID: century + yymmdd + governorate "88" (not a real one, marks demo) + 4-digit serial + check digit.
      // The 13th digit is odd for boys and even for girls, matching parseEgyptianNationalId.
      const month = pad((seq % 12) + 1, 2);
      const day = pad((seq % 28) + 1, 2);
      const serial = pad(seq, 3) + (isGirl ? '2' : '1');
      const nationalId = `3${String(BIRTH_YEAR[grade]).slice(2)}${month}${day}88${serial}1`;

      students.push({
        studentCode: `${STUDENT_CODE_PREFIX}${YEAR}-${pad(seq, 3)}`,
        fullName,
        nationalId,
        gender: isGirl ? 'FEMALE' : 'MALE',
        dateOfBirth: `${BIRTH_YEAR[grade]}-${month}-${day}`,
        classId: cls.id,
        gradeLevel: cls.gradeLevel,
        guardianName: `${father} ${family}`,
        guardianPhone: `${pick(PHONE_PREFIXES, seq)}${pad(10000000 + seq * 7919, 8).slice(-8)}`,
        enrollmentStatus: status,
        isActive,
      });
    }
  }

  // Accounts first (bulk), then the student profiles linked to them
  await prisma.user.createMany({
    data: students.map((s) => ({
      fullName: s.fullName,
      name: s.fullName,
      nationalId: s.nationalId,
      studentCode: s.studentCode,
      password: passwordHash,
      role: 'STUDENT',
      status: s.isActive ? 'ACTIVE' : 'INACTIVE',
      forcePasswordChange: true,
      phone: s.guardianPhone,
    })),
  });
  const users = await prisma.user.findMany({
    where: { studentCode: { startsWith: STUDENT_CODE_PREFIX } },
    select: { id: true, studentCode: true },
  });
  const userIdByCode = new Map(users.map((u) => [u.studentCode, u.id]));

  await prisma.student.createMany({
    data: students.map((s) => ({
      userId: userIdByCode.get(s.studentCode),
      studentCode: s.studentCode,
      fullNameArabic: s.fullName,
      nationalId: s.nationalId,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth,
      classId: s.classId,
      gradeLevel: s.gradeLevel,
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
      enrollmentStatus: s.enrollmentStatus,
      isActive: s.isActive,
    })),
  });

  console.log(`✅ Added ${students.length} demo students across ${Object.keys(CLASS_SIZES).length} classes`);
}

async function seedTeachers(classesByName, passwordHash) {
  for (const [index, t] of TEACHERS.entries()) {
    const n = index + 1;
    const nationalId = `2${pad(78 + (n % 12), 2)}${pad((n % 12) + 1, 2)}${pad(n + 10, 2)}88${pad(n, 3)}${n % 2 ? '1' : '2'}1`;
    const phone = `010${pad(20000000 + n * 104729, 8).slice(-8)}`;
    const email = `demo.teacher${pad(n, 2)}@school.com`;
    const classIds = t.classes.map((name) => classesByName.get(name)).filter(Boolean).map((c) => ({ id: c.id }));

    const teacher = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: t.name,
          name: t.name,
          nationalId,
          email,
          phone,
          password: passwordHash,
          role: 'TEACHER',
          forcePasswordChange: true,
        },
      });
      return tx.teacher.create({
        data: {
          userId: user.id,
          teacherCode: `${TEACHER_CODE_PREFIX}${pad(n, 2)}`,
          fullNameArabic: t.name,
          nationalId,
          email,
          phone,
          specialization: t.specialization,
          teachingSubjects: t.subjects,
          employmentStatus: t.status ?? 'ON_DUTY',
          classes: { connect: classIds },
        },
      });
    });

    // Class advisor only where the class has none yet, so real assignments are never overwritten
    if (t.advises) {
      await prisma.class.updateMany({
        where: { name: t.advises, classTeacherId: null },
        data: { classTeacherId: teacher.id },
      });
    }
  }
  console.log(`✅ Added ${TEACHERS.length} demo teachers (national IDs starting with 2…88…)`);
}

async function main() {
  await clean();
  if (process.argv.includes('--clean')) return;

  const classes = await prisma.class.findMany({ select: { id: true, name: true, gradeLevel: true } });
  const classesByName = new Map(classes.map((c) => [c.name, c]));

  const [studentHash, teacherHash] = await Promise.all([
    bcrypt.hash('Student@2026', 10),
    bcrypt.hash('Teacher@2026', 10),
  ]);

  await seedStudents(classesByName, studentHash);
  await seedTeachers(classesByName, teacherHash);

  const summary = await prisma.class.findMany({
    orderBy: { name: 'asc' },
    select: { name: true, _count: { select: { students: true, assignedTeachers: true } } },
  });
  console.table(summary.map((c) => ({ class: c.name, students: c._count.students, teachers: c._count.assignedTeachers })));
}

main()
  .catch((e) => {
    console.error('❌ Demo seeding failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
