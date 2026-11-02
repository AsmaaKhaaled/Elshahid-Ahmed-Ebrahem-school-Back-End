import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for Elshahid Ahmed Ebrahem School...');

  const SALT_ROUNDS = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@2026', SALT_ROUNDS);
  const staffPasswordHash = await bcrypt.hash('Staff@2026', SALT_ROUNDS);
  const teacherPasswordHash = await bcrypt.hash('Teacher@2026', SALT_ROUNDS);
  const studentPasswordHash = await bcrypt.hash('Student@2026', SALT_ROUNDS);

  // ==========================================
  // 1. Seed School Classes (فصول أ/ نشوه: 3/2 ، 3/3 ، 3/4)
  // ==========================================
  const class3_2 = await prisma.class.upsert({
    where: { name: '3/2' },
    update: {
      displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/2',
      gradeLevel: '3rd Preparatory',
      roomNumber: '302',
    },
    create: {
      name: '3/2',
      displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/2',
      gradeLevel: '3rd Preparatory',
      roomNumber: '302',
      capacity: 40,
      isActive: true,
    },
  });

  const class3_3 = await prisma.class.upsert({
    where: { name: '3/3' },
    update: {
      displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/3',
      gradeLevel: '3rd Preparatory',
      roomNumber: '303',
    },
    create: {
      name: '3/3',
      displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/3',
      gradeLevel: '3rd Preparatory',
      roomNumber: '303',
      capacity: 40,
      isActive: true,
    },
  });

  const class3_4 = await prisma.class.upsert({
    where: { name: '3/4' },
    update: {
      displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/4',
      gradeLevel: '3rd Preparatory',
      roomNumber: '304',
    },
    create: {
      name: '3/4',
      displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/4',
      gradeLevel: '3rd Preparatory',
      roomNumber: '304',
      capacity: 40,
      isActive: true,
    },
  });
  console.log(`✅ Classes ready: [${class3_2.name}, ${class3_3.name}, ${class3_4.name}]`);

  // ==========================================
  // 2. Seed Subjects (مادة الرياضيات)
  // ==========================================
  const mathSubject = await prisma.subject.upsert({
    where: { code: 'MTH-PREP3' },
    update: {
      nameArabic: 'رياضيات',
      nameEnglish: 'Mathematics',
      gradeLevel: '3rd Preparatory',
    },
    create: {
      code: 'MTH-PREP3',
      nameArabic: 'رياضيات',
      nameEnglish: 'Mathematics',
      gradeLevel: '3rd Preparatory',
      maxMarks: 100,
      passMarks: 50,
      isActive: true,
    },
  });
  console.log(`✅ Subject ready: ${mathSubject.nameArabic} (${mathSubject.code})`);

  // ==========================================
  // 3. Seed Super Admin (مدير المدرسة)
  // Created once only: the principal edits their own details & password from
  // "بيانات الحساب", so re-running the seed must never reset them.
  // ==========================================
  const existingSuperAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  const superAdmin = existingSuperAdmin ?? await prisma.user.create({
    data: {
      fullName: 'أ. د. محمود عبد العزيز الشناوي',
      name: 'أ. د. محمود عبد العزيز الشناوي',
      email: 'admin@school.com',
      nationalId: '28001011234567',
      password: adminPasswordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      phone: '01000000001',
      forcePasswordChange: false,
      permissions: [],
    },
  });
  console.log(
    existingSuperAdmin
      ? `ℹ️ Super Admin already exists, left unchanged: [${superAdmin.fullName}]`
      : `✅ Super Admin Account seeded: [${superAdmin.fullName}] | Email: ${superAdmin.email} | NationalID: ${superAdmin.nationalId}`
  );

  // ==========================================
  // 4. Seed Sub-Admin 1: شؤون الطلاب
  // Note (all upserts below): password & forcePasswordChange are set on create only,
  // so re-running the seed never resets a password the user has already changed.
  // ==========================================
  const studentAffairsAdmin = await prisma.user.upsert({
    where: { email: 'student.affairs@school.com' },
    update: {
      fullName: 'أ. محمد سعيد حسن',
      name: 'أ. محمد سعيد حسن',
      nationalId: '27805121234561',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: ['students', 'classes', 'attendance-stats', 'announcements'],
    },
    create: {
      fullName: 'أ. محمد سعيد حسن',
      name: 'أ. محمد سعيد حسن',
      email: 'student.affairs@school.com',
      nationalId: '27805121234561',
      password: staffPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      phone: '01000000002',
      forcePasswordChange: false,
      permissions: ['students', 'classes', 'attendance-stats', 'announcements'],
    },
  });
  console.log(`✅ Admin 1 (شؤون الطلاب) seeded: [${studentAffairsAdmin.fullName}] | Permissions: ${studentAffairsAdmin.permissions.join(', ')}`);

  // ==========================================
  // 5. Seed Sub-Admin 2: شؤون العاملين
  // ==========================================
  const teachersAffairsAdmin = await prisma.user.upsert({
    where: { email: 'teachers.affairs@school.com' },
    update: {
      fullName: 'أ. أحمد فتحي عبد العظيم',
      name: 'أ. أحمد فتحي عبد العظيم',
      nationalId: '28210201234562',
      role: 'ADMIN',
      status: 'ACTIVE',
      permissions: ['teachers', 'teacher-attendance'],
    },
    create: {
      fullName: 'أ. أحمد فتحي عبد العظيم',
      name: 'أ. أحمد فتحي عبد العظيم',
      email: 'teachers.affairs@school.com',
      nationalId: '28210201234562',
      password: staffPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      phone: '01000000003',
      forcePasswordChange: false,
      permissions: ['teachers', 'teacher-attendance'],
    },
  });
  console.log(`✅ Admin 2 (شؤون العاملين) seeded: [${teachersAffairsAdmin.fullName}] | Permissions: ${teachersAffairsAdmin.permissions.join(', ')}`);

  // ==========================================
  // 6. Seed Teacher: أ/ نشوه يوسف محمد يوسف
  // ==========================================
  const teacherNationalId = '28901222800962';
  const teacherEmail = 'teacher.neshwa@school.com';

  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      fullName: 'نشوه يوسف محمد يوسف',
      name: 'نشوه يوسف محمد يوسف',
      nationalId: teacherNationalId,
      role: 'TEACHER',
      status: 'ACTIVE',
      permissions: [],
    },
    create: {
      fullName: 'نشوه يوسف محمد يوسف',
      name: 'نشوه يوسف محمد يوسف',
      email: teacherEmail,
      nationalId: teacherNationalId,
      password: teacherPasswordHash,
      role: 'TEACHER',
      status: 'ACTIVE',
      phone: '01012345678',
      forcePasswordChange: true,
      permissions: [],
    },
  });

  const teacherProfile = await prisma.teacher.upsert({
    where: { teacherCode: 'TCH-001' },
    update: {
      userId: teacherUser.id,
      nationalId: teacherNationalId,
      fullNameArabic: 'نشوه يوسف محمد يوسف',
      fullNameEnglish: 'Neshwa Youssef Mohamed Youssef',
      specialization: 'رياضيات',
      email: teacherEmail,
      phone: '01012345678',
      isActive: true,
      classes: {
        set: [{ id: class3_2.id }, { id: class3_3.id }, { id: class3_4.id }],
      },
      subjects: {
        set: [{ id: mathSubject.id }],
      },
    },
    create: {
      userId: teacherUser.id,
      teacherCode: 'TCH-001',
      nationalId: teacherNationalId,
      fullNameArabic: 'نشوه يوسف محمد يوسف',
      fullNameEnglish: 'Neshwa Youssef Mohamed Youssef',
      specialization: 'رياضيات',
      email: teacherEmail,
      phone: '01012345678',
      isActive: true,
      classes: {
        connect: [{ id: class3_2.id }, { id: class3_3.id }, { id: class3_4.id }],
      },
      subjects: {
        connect: [{ id: mathSubject.id }],
      },
    },
    include: {
      classes: true,
      subjects: true,
    },
  });
  console.log(`✅ Teacher Account (أ/ نشوه): NationalID = ${teacherUser.nationalId} | Pass = Teacher@2026`);
  console.log(`   📚 فصول المعلمة نشوه (${teacherProfile.classes.length} فصول): ${teacherProfile.classes.map((c) => c.displayNameArabic).join(' ، ')}`);

  // ==========================================
  // 7. Seed Student (طالب مقيد بفصل 3/2)
  // ==========================================
  const studentCode = 'STU-2026-001';
  const studentEmail = 'student.omar@school.com';

  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      fullName: 'عمر طارق حسن',
      name: 'عمر طارق حسن',
      studentCode,
      nationalId: '30805121234567',
      role: 'STUDENT',
      status: 'ACTIVE',
      permissions: [],
    },
    create: {
      fullName: 'عمر طارق حسن',
      name: 'عمر طارق حسن',
      email: studentEmail,
      studentCode,
      nationalId: '30805121234567',
      password: studentPasswordHash,
      role: 'STUDENT',
      status: 'ACTIVE',
      phone: '01234567890',
      forcePasswordChange: true,
      permissions: [],
    },
  });

  await prisma.student.upsert({
    where: { studentCode },
    update: {
      userId: studentUser.id,
      classId: class3_2.id,
      fullNameArabic: 'عمر طارق حسن',
      fullNameEnglish: 'Omar Tarek Hassan',
      nationalId: '30805121234567',
      gender: 'MALE',
      isActive: true,
    },
    create: {
      userId: studentUser.id,
      studentCode,
      classId: class3_2.id,
      fullNameArabic: 'عمر طارق حسن',
      fullNameEnglish: 'Omar Tarek Hassan',
      nationalId: '30805121234567',
      gender: 'MALE',
      isActive: true,
    },
  });
  console.log(`✅ Student Account (عمر طارق): StudentCode = ${studentUser.studentCode} | Pass = Student@2026 | Class = ${class3_2.displayNameArabic}`);

  console.log('\n🎉 Database seeding with Roles & Permissions completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
