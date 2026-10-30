import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for Elshahid Ahmed Ebrahem School...');

  const SALT_ROUNDS = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@2026', SALT_ROUNDS);
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
  // 3. Seed Admin User
  // ==========================================
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {
      name: 'إدارة المدرسة (School Admin)',
      identifier: 'admin@school.com',
      password: adminPasswordHash,
      role: 'ADMIN',
      forcePasswordChange: false,
      isActive: true,
    },
    create: {
      name: 'إدارة المدرسة (School Admin)',
      email: 'admin@school.com',
      identifier: 'admin@school.com',
      password: adminPasswordHash,
      role: 'ADMIN',
      phone: '01000000001',
      forcePasswordChange: false,
      isActive: true,
    },
  });
  console.log(`✅ Admin Account: Identifier = ${adminUser.identifier} | Pass = Admin@2026 | forceChange = false`);

  // ==========================================
  // 4. Seed Teacher: أ/ نشوه يوسف محمد يوسف
  // ==========================================
  const teacherNationalId = '28901222800962';
  const teacherEmail = 'teacher.neshwa@school.com';

  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      name: 'نشوه يوسف محمد يوسف',
      identifier: teacherNationalId,
      password: teacherPasswordHash,
      role: 'TEACHER',
      forcePasswordChange: true,
      isActive: true,
    },
    create: {
      name: 'نشوه يوسف محمد يوسف',
      email: teacherEmail,
      identifier: teacherNationalId,
      password: teacherPasswordHash,
      role: 'TEACHER',
      phone: '01012345678',
      forcePasswordChange: true,
      isActive: true,
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
  console.log(`✅ Teacher Account (أ/ نشوه): Identifier = ${teacherUser.identifier} | Pass = Teacher@2026`);
  console.log(`   📚 فصول المعلمة نشوه (${teacherProfile.classes.length} فصول): ${teacherProfile.classes.map((c) => c.displayNameArabic).join(' ، ')}`);

  // ==========================================
  // 5. Seed Student (طالب مقيد بفصل 3/2 التابع للمعلمة)
  // ==========================================
  const studentCode = 'STU-2026-001';
  const studentEmail = 'student.omar@school.com';

  const studentUser = await prisma.user.upsert({
    where: { email: studentEmail },
    update: {
      name: 'عمر طارق حسن',
      identifier: studentCode,
      password: studentPasswordHash,
      role: 'STUDENT',
      forcePasswordChange: true,
      isActive: true,
    },
    create: {
      name: 'عمر طارق حسن',
      email: studentEmail,
      identifier: studentCode,
      password: studentPasswordHash,
      role: 'STUDENT',
      phone: '01234567890',
      forcePasswordChange: true,
      isActive: true,
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
  console.log(`✅ Student Account (عمر طارق): Identifier = ${studentUser.identifier} | Pass = Student@2026 | Class = ${class3_2.displayNameArabic}`);

  console.log('\n🎉 Database updated successfully with teacher Neshwa\'s exact classes!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
