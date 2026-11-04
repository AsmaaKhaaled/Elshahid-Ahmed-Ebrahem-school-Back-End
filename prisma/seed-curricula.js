/**
 * Demo curricula (المناهج والمواد الدراسية), the way the demo teachers would fill them in: some complete
 * (ministry book, distribution, sample exams, teacher's guide, links, a week-by-week plan), some half
 * done, some only just started. Needs the demo teachers first (npm run seed:demo).
 *
 *   npm run seed:curricula          -> removes the previous demo curricula, then adds them again
 *   npm run seed:curricula:clean    -> removes the demo curricula only
 *
 * Only the curricula of the demo teachers (teacherCode "TCH-D...") are touched. Uploaded files are small
 * placeholder PDFs written to the uploads folder of THIS machine (another machine's server won't have them).
 */
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEACHER_CODE_PREFIX = 'TCH-D';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const FOLDER = 'curricula';
const DAY = 24 * 60 * 60 * 1000;
const EKB = 'https://www.ekb.eg/';
const MOE = 'https://moe.gov.eg/';

// ---- What each subject's teacher uploads, per grade ----
// file: an uploaded PDF (its name), link: a link instead; forStudents: false = the teacher only

const CURRICULA = {
  'الرياضيات|G1': {
    description: 'منهج الرياضيات للصف الأول الإعدادي - الفصل الدراسي الأول (الأعداد النسبية، الجبر، الهندسة، الإحصاء).',
    files: [
      { kind: 'BOOK', title: 'كتاب الرياضيات - الترم الأول', file: 'كتاب-الرياضيات-1ع-ت1.pdf' },
      { kind: 'PLAN', title: 'توزيع منهج الرياضيات على الأسابيع', file: 'توزيع-منهج-الرياضيات-1ع.pdf' },
      { kind: 'EXAMS', title: 'نماذج امتحانات الوزارة - الترم الأول', file: 'نماذج-امتحانات-رياضيات-1ع.pdf' },
      { kind: 'EXAMS', title: 'امتحانات الأعوام السابقة بالإجابات', file: 'امتحانات-سابقة-رياضيات-1ع.pdf' },
      { kind: 'GUIDE', title: 'دليل المعلم - الرياضيات', file: 'دليل-معلم-الرياضيات-1ع.pdf', forStudents: false },
      { kind: 'OTHER', title: 'بنك المعرفة المصري - الرياضيات', link: EKB },
    ],
    planFile: 'خطة-منهج-الرياضيات-1ع.pdf',
    plan: [
      ['مفهوم العدد النسبي وتمثيله على خط الأعداد', ['يتعرف مفهوم العدد النسبي', 'يمثل الأعداد النسبية على خط الأعداد']],
      ['مقارنة وترتيب الأعداد النسبية', ['يقارن بين عددين نسبيين', 'يرتب مجموعة أعداد نسبية تصاعدياً وتنازلياً']],
      ['جمع وطرح الأعداد النسبية وخواصهما', ['يجمع ويطرح أعداداً نسبية', 'يستخدم خواص الجمع في تسهيل الحساب']],
      ['ضرب وقسمة الأعداد النسبية', ['يضرب ويقسم أعداداً نسبية', 'يحل مسائل حياتية على الأعداد النسبية']],
      ['الحدود والمقادير الجبرية', ['يميز الحد الجبري ودرجته', 'يجمع ويطرح المقادير الجبرية']],
      ['ضرب وقسمة المقادير الجبرية', ['يضرب حداً جبرياً في مقدار', 'يقسم مقداراً جبرياً على حد جبري']],
      ['التحليل بإخراج العامل المشترك الأعلى', ['يوجد العامل المشترك الأعلى', 'يحلل المقدار الجبري']],
      ['المفاهيم الهندسية الأساسية والزوايا', ['يتعرف الزوايا المتجاورة والمتقابلة بالرأس', 'يحل تمارين على الزوايا']],
    ],
    daysAgo: 1,
  },
  'العلوم|G3': {
    description: 'منهج العلوم للصف الثالث الإعدادي - الفصل الدراسي الأول.',
    files: [
      { kind: 'BOOK', title: 'كتاب العلوم - الترم الأول', file: 'كتاب-العلوم-3ع-ت1.pdf' },
      { kind: 'PLAN', title: 'توزيع منهج العلوم', file: 'توزيع-منهج-العلوم-3ع.pdf' },
      { kind: 'EXAMS', title: 'نماذج امتحانات الشهادة الإعدادية', file: 'نماذج-الشهادة-علوم-3ع.pdf' },
      { kind: 'GUIDE', title: 'دليل المعلم ودليل التجارب العملية', file: 'دليل-معلم-العلوم-3ع.pdf', forStudents: false },
      { kind: 'OTHER', title: 'تجارب افتراضية - بنك المعرفة', link: EKB },
    ],
    plan: [
      ['الحركة الاهتزازية', ['يعرف الحركة الاهتزازية', 'يحسب الزمن الدوري والتردد']],
      ['الحركة الموجية وأنواع الموجات', ['يميز الموجات المستعرضة والطولية', 'يعرف الطول الموجي وسرعة الموجة']],
      ['الصوت وخصائصه', ['يتعرف شروط انتقال الصوت', 'يفسر صدى الصوت']],
      ['انعكاس الضوء', ['يستنتج قانوني انعكاس الضوء', 'يرسم مسار شعاع منعكس']],
      ['انكسار الضوء', ['يفسر ظاهرة انكسار الضوء', 'يتعرف معامل الانكسار']],
      ['الانقسام الخلوي', ['يقارن بين الانقسام الميتوزي والميوزي']],
    ],
    daysAgo: 2,
  },
  'اللغة العربية|G1': {
    description: 'منهج اللغة العربية للصف الأول الإعدادي - الترم الأول: القراءة والنصوص والنحو والقصة.',
    files: [
      { kind: 'BOOK', title: 'كتاب اللغة العربية - الترم الأول', file: 'كتاب-العربي-1ع-ت1.pdf' },
      { kind: 'PLAN', title: 'توزيع منهج اللغة العربية', file: 'توزيع-منهج-العربي-1ع.pdf' },
      { kind: 'OTHER', title: 'موقع وزارة التربية والتعليم', link: MOE },
    ],
    plan: [
      ['القراءة: الموضوع الأول', ['يقرأ قراءة جهرية سليمة', 'يستخرج الأفكار الرئيسية']],
      ['النصوص: النص الأول', ['يحفظ الأبيات المقررة', 'يشرح النص بأسلوبه']],
      ['النحو: الفعل الماضي والمضارع والأمر', ['يميز أنواع الفعل', 'يضبط آخر الفعل المضارع']],
      ['النحو: الفاعل', ['يعرب الفاعل', 'يميز الفاعل الظاهر والضمير']],
      ['النحو: المبتدأ والخبر', ['يحدد المبتدأ والخبر', 'يميز أنواع الخبر']],
      ['القصة: الفصلان الأول والثاني', ['يلخص أحداث الفصل', 'يحلل الشخصيات']],
    ],
    daysAgo: 4,
  },
  'اللغة العربية|G3': {
    description: 'منهج اللغة العربية للصف الثالث الإعدادي - الترم الأول.',
    files: [
      { kind: 'BOOK', title: 'كتاب اللغة العربية - الترم الأول', file: 'كتاب-العربي-3ع-ت1.pdf' },
      { kind: 'EXAMS', title: 'نماذج امتحانات الشهادة الإعدادية - عربي', file: 'نماذج-الشهادة-عربي-3ع.pdf' },
      { kind: 'GUIDE', title: 'دليل المعلم - اللغة العربية', file: 'دليل-معلم-العربي-3ع.pdf', forStudents: false },
    ],
    plan: [],
    daysAgo: 9,
  },
  'اللغة الإنجليزية|G2': {
    description: 'Hello! 2 - Term 1: Student Book & Workbook.',
    files: [
      { kind: 'BOOK', title: 'Student Book - Term 1', file: 'Hello2-StudentBook-T1.pdf' },
      { kind: 'BOOK', title: 'Workbook - Term 1', file: 'Hello2-Workbook-T1.pdf' },
      { kind: 'PLAN', title: 'Syllabus distribution - Term 1', file: 'Hello2-Distribution-T1.pdf' },
      { kind: 'OTHER', title: 'Egyptian Knowledge Bank - English', link: EKB },
    ],
    plan: [
      ['Unit 1: Vocabulary & reading', ['Uses the unit vocabulary in context', 'Reads for gist and detail']],
      ['Unit 1: Grammar - present simple & continuous', ['Distinguishes the two tenses', 'Writes correct sentences']],
      ['Unit 2: Listening & speaking', ['Answers listening questions', 'Takes part in a short dialogue']],
      ['Unit 2: Writing a short paragraph', ['Plans and writes a paragraph of 6 sentences']],
      ['Revision & monthly test', ['Reviews units 1–2']],
    ],
    daysAgo: 3,
  },
  'اللغة الإنجليزية|G3': {
    description: 'Hello! 3 - Term 1.',
    files: [{ kind: 'BOOK', title: 'Student Book - Term 1', file: 'Hello3-StudentBook-T1.pdf' }],
    plan: [],
    daysAgo: 15,
  },
  'الدراسات الاجتماعية|G1': {
    description: 'منهج الدراسات الاجتماعية للصف الأول الإعدادي - جغرافية مصر وتاريخها القديم.',
    files: [
      { kind: 'BOOK', title: 'كتاب الدراسات الاجتماعية - الترم الأول', file: 'كتاب-الدراسات-1ع-ت1.pdf' },
      { kind: 'PLAN', title: 'توزيع منهج الدراسات', file: 'توزيع-منهج-الدراسات-1ع.pdf' },
    ],
    plan: [
      ['موقع مصر وأهميته', ['يحدد موقع مصر على الخريطة', 'يستنتج أهمية الموقع']],
      ['أشكال سطح مصر', ['يميز أقسام سطح مصر']],
      ['مناخ مصر', ['يصف خصائص مناخ مصر']],
      ['سكان مصر وتوزيعهم', ['يفسر توزيع السكان']],
      ['مصر الفرعونية: التوحيد وبناء الدولة', ['يتعرف دور الملك مينا']],
    ],
    daysAgo: 6,
  },
  'الدراسات الاجتماعية|G2': {
    description: 'الوطن العربي: الموقع والسطح والمناخ، والحضارة الإسلامية.',
    files: [
      { kind: 'BOOK', title: 'كتاب الدراسات الاجتماعية - الترم الأول', file: 'كتاب-الدراسات-2ع-ت1.pdf' },
      { kind: 'OTHER', title: 'أطلس الوطن العربي - بنك المعرفة', link: EKB },
    ],
    plan: [],
    daysAgo: 11,
  },
  'التربية الدينية الإسلامية|G2': {
    description: 'منهج التربية الدينية الإسلامية للصف الثاني الإعدادي - الترم الأول.',
    files: [{ kind: 'BOOK', title: 'كتاب التربية الدينية الإسلامية - الترم الأول', file: 'كتاب-الدين-2ع-ت1.pdf' }],
    plan: [
      ['القرآن الكريم: تلاوة وحفظ', ['يتلو الآيات تلاوة صحيحة', 'يحفظ الآيات المقررة']],
      ['الحديث الشريف', ['يشرح الحديث', 'يستنبط القيم المستفادة']],
      ['العقيدة', ['يوضح المفهوم ويستدل عليه']],
      ['الأخلاق والسيرة', ['يتمثل القيم في سلوكه']],
    ],
    daysAgo: 7,
  },
  'الحاسب الآلي|G3': {
    description: 'مقدمة في البرمجة والخوارزميات.',
    files: [
      { kind: 'BOOK', title: 'كتاب الحاسب الآلي - الترم الأول', file: 'كتاب-الحاسب-3ع-ت1.pdf' },
      { kind: 'OTHER', title: 'منصة تعلم البرمجة - بنك المعرفة', link: EKB },
    ],
    plan: [
      ['مفهوم الخوارزمية وخرائط التدفق', ['يكتب خوارزمية لحل مشكلة بسيطة', 'يرسم خريطة تدفق']],
      ['المتغيرات وأنواع البيانات', ['يميز أنواع البيانات']],
      ['الجمل الشرطية', ['يستخدم جملة الشرط في برنامج']],
      ['التكرار', ['يكتب برنامجاً يستخدم التكرار']],
    ],
    daysAgo: 20,
  },
  // Started but nothing uploaded yet
  'التربية الفنية|G1': { description: '', files: [], plan: [], daysAgo: 25 },
  'التربية الفنية|G2': {
    description: 'مشروعات الترم الأول وخاماتها.',
    files: [{ kind: 'GUIDE', title: 'دليل المعلم - التربية الفنية', file: 'دليل-معلم-الفنية.pdf', forStudents: false }],
    plan: [],
    daysAgo: 18,
  },
  'التربية الرياضية|G3': { description: '', files: [], plan: [], daysAgo: 30 },
};

// A one-page PDF saying it's a demo file (the real one is the ministry's); returns its key
function writePlaceholderPdf(title) {
  const text = `Elshahid Ahmed Ebrahem School - demo curriculum file (${crypto.createHash('md5').update(title).digest('hex').slice(0, 8)})`;
  const content = `BT /F1 14 Tf 60 760 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const offset = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const dir = path.join(UPLOAD_DIR, FOLDER);
  fs.mkdirSync(dir, { recursive: true });
  const name = `demo-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`;
  fs.writeFileSync(path.join(dir, name), pdf);
  return { key: `${FOLDER}/${name}`, size: Buffer.byteLength(pdf) };
}

function removeStored(keys) {
  for (const key of keys.filter(Boolean)) {
    const full = path.resolve(UPLOAD_DIR, key);
    if (full.startsWith(UPLOAD_DIR + path.sep)) fs.rmSync(full, { force: true });
  }
}

async function clean() {
  const where = { teacher: { teacherCode: { startsWith: TEACHER_CODE_PREFIX } } };
  const [files, curricula] = await Promise.all([
    prisma.curriculumFile.findMany({ where: { curriculum: where, fileKey: { not: null } }, select: { fileKey: true } }),
    prisma.curriculum.findMany({ where, select: { planFileKey: true } }),
  ]);
  const { count } = await prisma.curriculum.deleteMany({ where });
  removeStored([...files.map((f) => f.fileKey), ...curricula.map((c) => c.planFileKey)]);
  console.log(`🧹 Removed ${count} demo curricula`);
}

async function seed() {
  const teachers = await prisma.teacher.findMany({
    where: { teacherCode: { startsWith: TEACHER_CODE_PREFIX } },
    select: {
      id: true,
      teacherCode: true,
      teachingSubjects: true,
      classes: { select: { name: true } },
      supervisedClasses: { select: { name: true } },
    },
    orderBy: { teacherCode: 'asc' },
  });
  if (!teachers.length) {
    console.log('⚠️  No demo teachers found. Run "npm run seed:demo" first.');
    return;
  }

  const now = Date.now();
  let curriculaCount = 0;
  let filesCount = 0;
  for (const teacher of teachers) {
    const subject = teacher.teachingSubjects[0];
    const classes = [...new Set([...teacher.classes, ...teacher.supervisedClasses].map((c) => c.name))].sort();
    // One curriculum per grade the teacher teaches, for their classes in it
    const grades = [...new Set(classes.map((name) => `G${name[0]}`))];
    for (const gradeId of grades) {
      const spec = CURRICULA[`${subject}|${gradeId}`];
      if (!spec) continue;
      const updatedAt = new Date(now - spec.daysAgo * DAY);
      // Files uploaded over the days before the last update, newest last
      const files = spec.files.map((file, i) => {
        const uploadedAt = new Date(updatedAt.getTime() - (spec.files.length - 1 - i) * 2 * DAY);
        const base = { kind: file.kind, title: file.title, forStudents: file.forStudents !== false, uploadedAt };
        if (file.link) return { ...base, link: file.link };
        const stored = writePlaceholderPdf(file.title);
        return { ...base, fileName: file.file, fileSize: stored.size, fileType: 'application/pdf', fileKey: stored.key };
      });
      const planFile = spec.planFile ? writePlaceholderPdf(spec.planFile) : null;

      await prisma.curriculum.create({
        data: {
          teacherId: teacher.id,
          subject,
          gradeId,
          sections: classes.filter((name) => name[0] === gradeId[1]),
          description: spec.description,
          createdAt: new Date(updatedAt.getTime() - (spec.files.length * 2 + 3) * DAY),
          updatedAt,
          ...(planFile && {
            planFileName: spec.planFile,
            planFileSize: planFile.size,
            planFileType: 'application/pdf',
            planFileKey: planFile.key,
          }),
          files: { create: files },
          planWeeks: { create: spec.plan.map(([topic, objectives], i) => ({ week: i + 1, topic, objectives })) },
        },
      });
      curriculaCount++;
      filesCount += files.length;
    }
  }
  console.log(`✅ Added ${curriculaCount} demo curricula with ${filesCount} files and links (uploads in ${path.join(UPLOAD_DIR, FOLDER)})`);
}

async function main() {
  await clean();
  if (process.argv.includes('--clean')) return;
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ Seeding demo curricula failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
