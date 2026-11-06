/**
 * Demo admin accounts, to see how "المسؤولون والصلاحيات" looks with several admins.
 *
 *   npm run seed:demo:admins          -> removes any previous demo admins, then adds them again
 *   npm run seed:demo:admins:clean    -> removes the demo admins only
 *
 * Every demo admin is tagged by its email ("...@demo.local"), so it can be removed without touching real accounts.
 * Their passwords are random and never printed: the accounts are for display only, nobody can sign in with them.
 */
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL_DOMAIN = '@demo.local';
// 14 digits that can't be a real national ID's birth date (month 00)
const NATIONAL_ID_PREFIX = '2900099000';

// Mixed on purpose: full / partial / single permissions, long names, suspended and inactive accounts
const ADMINS = [
  {
    fullName: 'محمد عبد الفتاح السيد',
    jobTitle: 'وكيل المدرسة',
    permissions: ['students', 'teachers', 'classes', 'exams', 'attendance-stats', 'teacher-attendance', 'academic-year', 'announcements'],
    status: 'ACTIVE',
  },
  { fullName: 'هالة محمود عبد الرحمن', jobTitle: 'وكيل شؤون الطلاب', permissions: ['students', 'attendance-stats', 'honor-roll'], status: 'ACTIVE' },
  { fullName: 'سامح إبراهيم النجار', jobTitle: 'مسؤول الامتحانات', permissions: ['exams', 'honor-roll'], status: 'ACTIVE' },
  { fullName: 'نادية حسن الشربيني', jobTitle: 'شؤون العاملين', permissions: ['teachers', 'teacher-attendance'], status: 'ACTIVE' },
  { fullName: 'طارق عادل منصور', jobTitle: 'أخصائي اجتماعي', permissions: ['students'], status: 'ACTIVE' },
  { fullName: 'إيمان سعيد عبد الحميد البنا', jobTitle: 'مسؤولة الإعلانات والتواصل', permissions: ['announcements', 'platform-activity'], status: 'ACTIVE' },
  { fullName: 'وليد جمال شاهين', jobTitle: 'مشرف الجداول', permissions: ['classes', 'academic-year'], status: 'SUSPENDED' },
  { fullName: 'رشا أشرف الدسوقي', jobTitle: 'سكرتارية', permissions: [], status: 'INACTIVE' },
];

const PHONE_PREFIXES = ['010', '011', '012', '015'];

async function clean() {
  const { count } = await prisma.user.deleteMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN }, role: 'ADMIN' } });
  console.log(`Removed ${count} demo admin(s).`);
}

async function seed() {
  // One random password for all of them, thrown away right after hashing
  const password = await bcrypt.hash(randomBytes(24).toString('hex'), 10);

  for (const [i, admin] of ADMINS.entries()) {
    const n = String(i + 1).padStart(4, '0');
    await prisma.user.create({
      data: {
        ...admin,
        name: admin.fullName,
        role: 'ADMIN',
        email: `admin${i + 1}${DEMO_EMAIL_DOMAIN}`,
        nationalId: `${NATIONAL_ID_PREFIX}${n}`,
        phone: `${PHONE_PREFIXES[i % PHONE_PREFIXES.length]}0000${n}`,
        password,
      },
    });
  }
  console.log(`Added ${ADMINS.length} demo admins (${ADMINS.filter((a) => a.status !== 'ACTIVE').length} not active).`);
}

const onlyClean = process.argv.includes('--clean');

clean()
  .then(() => (onlyClean ? null : seed()))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
