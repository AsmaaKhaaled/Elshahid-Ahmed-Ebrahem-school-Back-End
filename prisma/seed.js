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

  // Clean up legacy non-standard test class if exists
  await prisma.class.deleteMany({
    where: { name: '1/A' },
  }).catch(() => {});

  // ==========================================
  // 1. Seed School Classes (فصول المدرسة الـ 12 - 3 مراحل × 4 فصول)
  // ==========================================
  const schoolClassesData = [
    // المرحلة الأولى: الصف الأول الإعدادي (4 فصول)
    { name: '1/1', displayNameArabic: 'الصف الأول الإعدادي - فصل 1/1', gradeLevel: 'الصف الأول الإعدادي', roomNumber: '101' },
    { name: '1/2', displayNameArabic: 'الصف الأول الإعدادي - فصل 1/2', gradeLevel: 'الصف الأول الإعدادي', roomNumber: '102' },
    { name: '1/3', displayNameArabic: 'الصف الأول الإعدادي - فصل 1/3', gradeLevel: 'الصف الأول الإعدادي', roomNumber: '103' },
    { name: '1/4', displayNameArabic: 'الصف الأول الإعدادي - فصل 1/4', gradeLevel: 'الصف الأول الإعدادي', roomNumber: '104' },

    // المرحلة الثانية: الصف الثاني الإعدادي (4 فصول)
    { name: '2/1', displayNameArabic: 'الصف الثاني الإعدادي - فصل 2/1', gradeLevel: 'الصف الثاني الإعدادي', roomNumber: '201' },
    { name: '2/2', displayNameArabic: 'الصف الثاني الإعدادي - فصل 2/2', gradeLevel: 'الصف الثاني الإعدادي', roomNumber: '202' },
    { name: '2/3', displayNameArabic: 'الصف الثاني الإعدادي - فصل 2/3', gradeLevel: 'الصف الثاني الإعدادي', roomNumber: '203' },
    { name: '2/4', displayNameArabic: 'الصف الثاني الإعدادي - فصل 2/4', gradeLevel: 'الصف الثاني الإعدادي', roomNumber: '204' },

    // المرحلة الثالثة: الصف الثالث الإعدادي (4 فصول)
    { name: '3/1', displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/1', gradeLevel: 'الصف الثالث الإعدادي', roomNumber: '301' },
    { name: '3/2', displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/2', gradeLevel: 'الصف الثالث الإعدادي', roomNumber: '302' },
    { name: '3/3', displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/3', gradeLevel: 'الصف الثالث الإعدادي', roomNumber: '303' },
    { name: '3/4', displayNameArabic: 'الصف الثالث الإعدادي - فصل 3/4', gradeLevel: 'الصف الثالث الإعدادي', roomNumber: '304' },
  ];

  const seededClasses = {};
  for (const item of schoolClassesData) {
    const cls = await prisma.class.upsert({
      where: { name: item.name },
      update: {
        displayNameArabic: item.displayNameArabic,
        gradeLevel: item.gradeLevel,
        roomNumber: item.roomNumber,
        capacity: 40,
        isActive: true,
      },
      create: {
        name: item.name,
        displayNameArabic: item.displayNameArabic,
        gradeLevel: item.gradeLevel,
        roomNumber: item.roomNumber,
        capacity: 40,
        isActive: true,
      },
    });
    seededClasses[item.name] = cls;
  }
  console.log(`✅ Seeded ${Object.keys(seededClasses).length} classes for all 3 preparatory stages (12 classes total).`);

  // ==========================================
  // 2. Seed Subjects (مادة الرياضيات)
  // ==========================================
  const mathSubject = await prisma.subject.upsert({
    where: { code: 'MTH-PREP3' },
    update: {
      nameArabic: 'رياضيات',
      nameEnglish: 'Mathematics',
      gradeLevel: 'الصف الثالث الإعدادي',
    },
    create: {
      code: 'MTH-PREP3',
      nameArabic: 'رياضيات',
      nameEnglish: 'Mathematics',
      gradeLevel: 'الصف الثالث الإعدادي',
      maxMarks: 100,
      passMarks: 50,
      isActive: true,
    },
  });
  console.log(`✅ Subject ready: ${mathSubject.nameArabic} (${mathSubject.code})`);

  // ==========================================
  // 3. Seed Super Admin (مدير المدرسة)
  // ==========================================
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {
      fullName: 'أ. د. محمود عبد العزيز الشناوي',
      name: 'أ. د. محمود عبد العزيز الشناوي',
      nationalId: '28001011234567',
      password: adminPasswordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      forcePasswordChange: false,
      permissions: [],
    },
    create: {
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
  console.log(`✅ Super Admin Account seeded: [${superAdmin.fullName}] | Email: ${superAdmin.email}`);

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
  console.log(`✅ Admin 1 (شؤون الطلاب) seeded: [${studentAffairsAdmin.fullName}]`);

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
  console.log(`✅ Admin 2 (شؤون العاملين) seeded: [${teachersAffairsAdmin.fullName}]`);

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
        set: [
          { id: seededClasses['3/2'].id },
          { id: seededClasses['3/3'].id },
          { id: seededClasses['3/4'].id },
        ],
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
        connect: [
          { id: seededClasses['3/2'].id },
          { id: seededClasses['3/3'].id },
          { id: seededClasses['3/4'].id },
        ],
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
  console.log(`✅ Teacher Account (أ/ نشوه): NationalID = ${teacherUser.nationalId}`);
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
      classId: seededClasses['3/2'].id,
      gradeLevel: 'الصف الثالث الإعدادي',
      fullNameArabic: 'عمر طارق حسن',
      fullNameEnglish: 'Omar Tarek Hassan',
      nationalId: '30805121234567',
      gender: 'MALE',
      enrollmentStatus: 'منتظم',
      isActive: true,
    },
    create: {
      userId: studentUser.id,
      studentCode,
      classId: seededClasses['3/2'].id,
      gradeLevel: 'الصف الثالث الإعدادي',
      fullNameArabic: 'عمر طارق حسن',
      fullNameEnglish: 'Omar Tarek Hassan',
      nationalId: '30805121234567',
      gender: 'MALE',
      enrollmentStatus: 'منتظم',
      isActive: true,
    },
  });
  console.log(`✅ Student Account (عمر طارق): StudentCode = ${studentUser.studentCode} | Class = ${seededClasses['3/2'].displayNameArabic}`);

  console.log('\n🎉 Database seeding with 12 preparatory classes completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
