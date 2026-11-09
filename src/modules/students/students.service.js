import * as xlsx from 'xlsx';
import { prisma } from '../../config/database.js';
import { StudentModel } from './students.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { compareArabic } from '../../shared/utils/arabic.js';
import { teachingScopeOf } from '../../shared/utils/teaching-scope.js';
import { assertIdentityFree } from '../auth/accounts.js';
import { GRADES, assignmentsOf } from '../teachers/teachers.service.js';
import {
  toLatinDigits,
  normalizeNationalId,
  normalizePhone,
  nationalIdError,
  phoneError,
  isValidNationalId,
  isValidEgyptianMobile,
} from '../../shared/utils/egyptian-ids.js';

// The school's only enrollment statuses
export const STUDENT_STATUSES = ['منتظم', 'موقوف', 'منقول'];
// Statuses that take a student off the class lists and disable their sign-in
const INACTIVE_STATUSES = ['موقوف', 'منقول'];
const GENDERS = ['MALE', 'FEMALE'];
// One import request at most (a whole school is ~500 students)
export const MAX_IMPORT_ROWS = 2000;
const MAX_SECTIONS = 10;

const assertValidStatus = (status) => {
  if (!STUDENT_STATUSES.includes(status)) {
    throw AppError.badRequest(`حالة القيد "${status}" غير صحيحة. الحالات المتاحة: ${STUDENT_STATUSES.join(' / ')}`);
  }
};

const isActiveStatus = (status) => !INACTIVE_STATUSES.includes(status);

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const cleanName = (value) => text(value).replace(/\s+/g, ' ');
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Grade level text -> its number: 'الصف الثاني الإعدادي' / 'تانية' / '2nd Preparatory' / '2' -> 2
 */
export const gradeNumberOf = (gradeLevel) => {
  const value = toLatinDigits(gradeLevel)
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .trim();
  if (!value) return null;
  const digit = /^([123])(?!\d)/.exec(value);
  if (digit) return Number(digit[1]);
  if (value.includes('اول')) return 1;
  if (value.includes('ثاني') || value.includes('تاني')) return 2;
  if (value.includes('ثالث') || value.includes('تالت')) return 3;
  return null;
};

/** The grade a class belongs to, from its name ("2/3" -> grade 2) */
const gradeNumberOfClass = (cls) => Number(/^(\d+)\//.exec(cls?.name ?? '')?.[1]) || gradeNumberOf(cls?.gradeLevel);

/** A student's grade level is always stored as the Arabic label, e.g. 'الصف الثاني الإعدادي' */
const gradeLabelOf = (number) => GRADES.find((g) => g.number === number)?.label ?? null;

/** Optional grade text -> its Arabic label; an unknown grade is an error, never guessed */
const normalizeGradeLevel = (value) => {
  if (!text(value)) return null;
  const label = gradeLabelOf(gradeNumberOf(value));
  if (!label) {
    throw AppError.badRequest(`الصف الدراسي "${text(value)}" غير صحيح. الصفوف المتاحة: ${GRADES.map((g) => g.label).join(' / ')}`);
  }
  return label;
};

/** What a teacher may see about a student (no national ID, birth date or address) */
const TEACHER_STUDENT_SELECT = {
  id: true,
  studentCode: true,
  fullNameArabic: true,
  gender: true,
  gradeLevel: true,
  classId: true,
  guardianName: true,
  guardianPhone: true,
  enrollmentStatus: true,
  isActive: true,
  class: { select: { id: true, name: true, displayNameArabic: true, gradeLevel: true, roomNumber: true } },
};

export class StudentsService {
  // ---------------------------------------------------------------------------
  // Classes
  // ---------------------------------------------------------------------------

  /**
   * Finds the class a student belongs to. Accepts a class ID, a class name ('3/2', 'فصل 3/2', '٣/٢'),
   * or just the section number (e.g. 2) together with the grade level.
   * Matches exactly only, so a student is never put in a look-alike class. When a grade level is
   * given too, it must be the class's grade.
   * @returns the class, or null when no class was given
   */
  static async resolveClass(classInput, gradeLevel) {
    const input = text(classInput);
    if (!input) return null;

    const byId = await prisma.class.findUnique({ where: { id: input } });
    if (byId) {
      if (!byId.isActive) throw AppError.badRequest(`الفصل "${byId.name}" غير مفعّل هذا العام`);
      this.assertGradeMatchesClass(gradeLevel, byId);
      return byId;
    }

    let name = toLatinDigits(input).replace(/^فصل\s*/, '').replace(/\s+/g, '');
    if (/^\d+$/.test(name)) {
      const gradeNumber = gradeNumberOf(gradeLevel);
      if (!gradeNumber) {
        throw AppError.badRequest(`رقم الفصل "${input}" يحتاج الصف الدراسي لتحديد الفصل`);
      }
      name = `${gradeNumber}/${Number(name)}`;
    }

    const byName = await prisma.class.findUnique({ where: { name } });
    // A class removed from this year's classes no longer takes students
    if (!byName || !byName.isActive) {
      throw AppError.badRequest(`الفصل "${name}" غير موجود بالمدرسة`);
    }
    this.assertGradeMatchesClass(gradeLevel, byName);
    return byName;
  }

  static assertGradeMatchesClass(gradeLevel, cls) {
    const given = gradeNumberOf(gradeLevel);
    const ofClass = gradeNumberOfClass(cls);
    if (given && ofClass && given !== ofClass) {
      throw AppError.badRequest(
        `الصف الدراسي "${text(gradeLevel)}" لا يطابق الفصل ${cls.name} (${gradeLabelOf(ofClass)})`
      );
    }
  }

  /** The class must have room for one more active student (`studentId`: the student being moved, not counted) */
  static async assertClassHasRoom(cls, studentId = null) {
    const count = await prisma.student.count({
      where: { classId: cls.id, isActive: true, ...(studentId && { id: { not: studentId } }) },
    });
    if (count >= cls.capacity) {
      throw AppError.badRequest(`الفصل ${cls.name} مكتمل (${count} من ${cls.capacity} طالب). اختر فصلاً آخر أو زوّد سعة الفصل`);
    }
  }

  // ---------------------------------------------------------------------------
  // National ID
  // ---------------------------------------------------------------------------

  /**
   * Extracts gender ('MALE' | 'FEMALE') and date of birth ('YYYY-MM-DD') from an Egyptian national ID
   */
  static parseEgyptianNationalId(nationalId) {
    const cleaned = normalizeNationalId(nationalId);
    if (!isValidNationalId(cleaned)) {
      return { gender: null, dateOfBirth: null };
    }

    const century = cleaned[0] === '2' ? '19' : '20';
    const dateOfBirth = `${century}${cleaned.substring(1, 3)}-${cleaned.substring(3, 5)}-${cleaned.substring(5, 7)}`;
    // 13th digit (index 12): even = FEMALE, odd = MALE
    const gender = Number(cleaned[12]) % 2 === 0 ? 'FEMALE' : 'MALE';
    return { gender, dateOfBirth };
  }

  static normalizeGender(value) {
    const gender = text(value).toUpperCase();
    if (!GENDERS.includes(gender)) {
      throw AppError.badRequest("النوع يجب أن يكون 'MALE' أو 'FEMALE'");
    }
    return gender;
  }

  // ---------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------

  static async getNextStudentCode() {
    return StudentModel.getNextStudentCode();
  }

  /**
   * The students list. A teacher only gets the students of their own classes, without
   * national IDs / birth dates / addresses.
   */
  static async getStudents(query = {}, user = null) {
    const scope = await teachingScopeOf(user);
    if (!scope) return StudentModel.findAll(query);

    const classIds = [...scope.ownClassIds];
    if (query.classId && !classIds.includes(query.classId)) {
      return { students: [], total: 0 };
    }
    return StudentModel.findAll(
      { ...query, classId: query.classId || undefined, classIds, activeOnly: true },
      TEACHER_STUDENT_SELECT
    );
  }

  static async getStudentById(id, user = null) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }
    await this.assertCanView(student, user);
    if (user?.role !== 'TEACHER') return student;

    const { nationalId, dateOfBirth, address, fullNameEnglish, ...forTeacher } = student;
    return forTeacher;
  }

  /** A student sees only themselves; a teacher only the students of their own classes */
  static async assertCanView(student, user) {
    if (!user) return;
    if (user.role === 'STUDENT' && user.studentProfile?.id !== student.id) {
      throw AppError.forbidden('غير مصرح لك بالاطلاع على بيانات طالب آخر');
    }
    if (user.role === 'TEACHER') {
      const scope = await teachingScopeOf(user);
      if (!student.classId || !scope.ownClassIds.has(student.classId)) {
        throw AppError.forbidden('هذا الطالب ليس في أحد فصولك');
      }
    }
  }

  /**
   * The student's teachers: who teaches which subject to their class, and the class advisor.
   * Contact details and national IDs are never included.
   */
  static async getStudentTeachers(studentId, user = null) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true, class: { select: { id: true, name: true, classTeacherId: true } } },
    });
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${studentId}' غير موجود`);
    }
    await this.assertCanView(student, user);
    if (!student.class) {
      return { className: null, teachers: [] };
    }

    const cls = student.class;
    const teachers = await prisma.teacher.findMany({
      where: {
        isActive: true,
        OR: [{ classes: { some: { id: cls.id } } }, { supervisedClasses: { some: { id: cls.id } } }],
      },
      select: {
        id: true,
        fullNameArabic: true,
        specialization: true,
        employmentStatus: true,
        teachingSubjects: true,
        teachingAssignments: true,
        classes: { select: { name: true } },
      },
    });

    const list = teachers
      .map((teacher) => {
        const subjects = assignmentsOf(teacher, teacher.classes.map((c) => c.name))
          .filter((a) => a.classes.includes(cls.name))
          .map((a) => a.subject);
        return {
          id: teacher.id,
          fullName: teacher.fullNameArabic,
          specialization: teacher.specialization,
          status: teacher.employmentStatus,
          subjects,
          isAdvisor: cls.classTeacherId === teacher.id,
        };
      })
      .filter((t) => t.subjects.length || t.isAdvisor)
      .sort((a, b) => compareArabic(a.fullName, b.fullName));

    return { className: cls.name, teachers: list };
  }

  // ---------------------------------------------------------------------------
  // Registering & editing
  // ---------------------------------------------------------------------------

  /**
   * Registers a new student, with their sign-in account on the same row
   * (first sign-in: national ID + student code, then the student chooses their own password)
   */
  static async createStudent(data = {}) {
    const fullNameArabic = cleanName(data.fullNameArabic || data.fullName);
    const nationalId = normalizeNationalId(data.nationalId);
    const guardianPhone = normalizePhone(data.guardianPhone) || null;

    if (fullNameArabic.length < 3) {
      throw AppError.badRequest('اسم الطالب باللغة العربية مطلوب (3 أحرف على الأقل)');
    }

    const nidError = nationalIdError(nationalId);
    if (nidError) {
      throw AppError.badRequest(nidError);
    }

    // The phone is optional on import, but when given it must be an Egyptian mobile number
    if (guardianPhone && !isValidEgyptianMobile(guardianPhone)) {
      throw AppError.badRequest(`هاتف ولي الأمر: ${phoneError(guardianPhone)}`);
    }

    const enrollmentStatus = text(data.enrollmentStatus) || 'منتظم';
    assertValidStatus(enrollmentStatus);
    const isActive = isActiveStatus(enrollmentStatus);

    // National ID: not used by another student, nor by a teacher's or an admin's account
    if (await StudentModel.findByNationalId(nationalId)) {
      throw AppError.conflict('الرقم القومي مسجل بالفعل لطالب آخر بالمنظومة');
    }
    await assertIdentityFree({ nationalId });

    let studentCode = text(data.studentCode);
    if (!studentCode) {
      studentCode = await StudentModel.getNextStudentCode();
    } else if (await StudentModel.findByCode(studentCode)) {
      throw AppError.conflict(`كود الطالب '${studentCode}' مسجل بالفعل لطالب آخر`);
    }

    const parsed = this.parseEgyptianNationalId(nationalId);
    const gender = text(data.gender) ? this.normalizeGender(data.gender) : parsed.gender;
    const dateOfBirth = text(data.dateOfBirth) || parsed.dateOfBirth;

    // The class decides the grade, so the two can never disagree
    const cls = await this.resolveClass(data.classId || data.className, data.gradeLevel);
    const gradeLevel = cls ? gradeLabelOf(gradeNumberOfClass(cls)) : normalizeGradeLevel(data.gradeLevel);
    if (cls && isActive) {
      await this.assertClassHasRoom(cls);
    }

    const student = await StudentModel.create({
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      studentCode,
      fullNameArabic,
      fullNameEnglish: cleanName(data.fullNameEnglish) || null,
      nationalId,
      gender,
      dateOfBirth,
      gradeLevel,
      classId: cls?.id ?? null,
      guardianName: cleanName(data.guardianName) || null,
      guardianPhone,
      address: text(data.address) || null,
      enrollmentStatus,
      isActive,
    });

    return {
      ...student,
      initialCredentials: {
        identifier: nationalId,
        nationalId,
        studentCode,
        initialPassword: studentCode,
        requirePasswordChange: true,
      },
    };
  }

  /**
   * Edits a student. Only the fields sent are changed. The class always decides the grade,
   * a full class takes no one, and the enrollment status decides whether the student can sign in.
   */
  static async updateStudent(id, input = {}) {
    const existing = await StudentModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }

    const payload = {};

    if (has(input, 'fullNameArabic') || has(input, 'fullName')) {
      payload.fullNameArabic = cleanName(input.fullNameArabic ?? input.fullName);
      if (payload.fullNameArabic.length < 3) {
        throw AppError.badRequest('اسم الطالب باللغة العربية مطلوب (3 أحرف على الأقل)');
      }
    }
    if (has(input, 'fullNameEnglish')) payload.fullNameEnglish = cleanName(input.fullNameEnglish) || null;
    if (has(input, 'guardianName')) payload.guardianName = cleanName(input.guardianName) || null;
    if (has(input, 'address')) payload.address = text(input.address) || null;

    if (has(input, 'studentCode')) {
      const studentCode = text(input.studentCode);
      if (!studentCode) throw AppError.badRequest('كود الطالب لا يمكن أن يكون فارغاً');
      if (studentCode !== existing.studentCode) {
        const taken = await StudentModel.findByCode(studentCode);
        if (taken && taken.id !== id) throw AppError.conflict('كود الطالب مسجل بالفعل لطالب آخر');
      }
      payload.studentCode = studentCode;
    }

    if (has(input, 'nationalId')) {
      const nationalId = normalizeNationalId(input.nationalId);
      const nidError = nationalIdError(nationalId);
      if (nidError) throw AppError.badRequest(nidError);
      if (nationalId !== existing.nationalId) {
        const taken = await StudentModel.findByNationalId(nationalId);
        if (taken && taken.id !== id) throw AppError.conflict('الرقم القومي مسجل بالفعل لطالب آخر');
        await assertIdentityFree({ nationalId }, { model: 'student', id });
        // A corrected national ID corrects the birth date & gender too (unless they are sent)
        const parsed = this.parseEgyptianNationalId(nationalId);
        payload.gender = parsed.gender;
        payload.dateOfBirth = parsed.dateOfBirth;
      }
      payload.nationalId = nationalId;
    }

    if (has(input, 'gender') && text(input.gender)) payload.gender = this.normalizeGender(input.gender);
    if (has(input, 'dateOfBirth') && text(input.dateOfBirth)) payload.dateOfBirth = text(input.dateOfBirth);

    if (has(input, 'guardianPhone')) {
      const guardianPhone = normalizePhone(input.guardianPhone);
      if (!isValidEgyptianMobile(guardianPhone)) {
        throw AppError.badRequest(`هاتف ولي الأمر: ${phoneError(guardianPhone)}`);
      }
      payload.guardianPhone = guardianPhone;
    }

    // Enrollment status -> whether the student is on the class lists and can sign in
    let isActive = existing.isActive;
    if (has(input, 'enrollmentStatus') && text(input.enrollmentStatus)) {
      payload.enrollmentStatus = text(input.enrollmentStatus);
      assertValidStatus(payload.enrollmentStatus);
      isActive = isActiveStatus(payload.enrollmentStatus);
      payload.isActive = isActive;
      payload.status = isActive ? 'ACTIVE' : 'INACTIVE';
    }

    // Class & grade: sending an empty class takes the student out of their class
    const classSent = has(input, 'classId') || has(input, 'className');
    const gradeSent = has(input, 'gradeLevel') && text(input.gradeLevel);
    let cls = existing.class;
    if (classSent) {
      cls = await this.resolveClass(input.classId || input.className, input.gradeLevel);
      payload.classId = cls?.id ?? null;
    } else if (gradeSent && cls) {
      this.assertGradeMatchesClass(input.gradeLevel, cls);
    }
    if (cls) {
      payload.gradeLevel = gradeLabelOf(gradeNumberOfClass(cls));
    } else if (gradeSent) {
      payload.gradeLevel = normalizeGradeLevel(input.gradeLevel);
    }

    // A full class takes no new (or returning) active student
    const joinsClass = cls && (cls.id !== existing.classId || (isActive && !existing.isActive));
    if (joinsClass && isActive) {
      await this.assertClassHasRoom(cls, id);
    }

    return StudentModel.update(id, payload);
  }

  /** Puts a student in a class (by class ID or name); the grade follows the class */
  static async enrollStudent(id, classInput) {
    const existing = await StudentModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }
    const cls = await this.resolveClass(classInput);
    if (!cls) {
      throw AppError.badRequest('الفصل مطلوب لتسكين الطالب');
    }
    if (cls.id === existing.classId) return existing;
    if (existing.isActive) {
      await this.assertClassHasRoom(cls, id);
    }
    return StudentModel.update(id, { classId: cls.id, gradeLevel: gradeLabelOf(gradeNumberOfClass(cls)) });
  }

  /**
   * Places every active student who has a grade but no class into that grade's classes:
   * each student goes to the class with the fewest students (A→Z by name, so the result is predictable),
   * and a full class takes no one. Optionally for one grade only.
   */
  static async distributeStudents({ gradeLevel } = {}) {
    const onlyGrade = text(gradeLevel) ? gradeNumberOf(gradeLevel) : null;
    if (text(gradeLevel) && !onlyGrade) {
      normalizeGradeLevel(gradeLevel); // throws the "unknown grade" error
    }

    const [waiting, classes] = await Promise.all([
      prisma.student.findMany({
        where: { classId: null, isActive: true },
        select: { id: true, fullNameArabic: true, studentCode: true, gradeLevel: true },
      }),
      prisma.class.findMany({
        where: { isActive: true },
        select: { id: true, name: true, capacity: true, _count: { select: { students: { where: { isActive: true } } } } },
      }),
    ]);

    const placed = [];
    const notPlaced = [];
    const updates = [];

    for (const grade of GRADES) {
      if (onlyGrade && grade.number !== onlyGrade) continue;
      const gradeClasses = classes
        .filter((cls) => gradeNumberOfClass(cls) === grade.number)
        .map((cls) => ({ ...cls, count: cls._count.students, section: Number(cls.name.split('/')[1]) || 0 }));
      const students = waiting
        .filter((s) => gradeNumberOf(s.gradeLevel) === grade.number)
        .sort((a, b) => compareArabic(a.fullNameArabic, b.fullNameArabic));

      for (const student of students) {
        const target = gradeClasses
          .filter((cls) => cls.count < cls.capacity)
          .sort((a, b) => a.count - b.count || a.section - b.section)[0];
        if (!target) {
          notPlaced.push({
            id: student.id,
            name: student.fullNameArabic,
            reason: gradeClasses.length ? `كل فصول ${grade.label} مكتملة` : `لا توجد فصول مفعّلة لـ ${grade.label}`,
          });
          continue;
        }
        target.count += 1;
        placed.push({ id: student.id, name: student.fullNameArabic, studentCode: student.studentCode, className: target.name });
        updates.push(
          prisma.student.update({ where: { id: student.id }, data: { classId: target.id, gradeLevel: grade.label } })
        );
      }
    }

    if (!onlyGrade) {
      for (const student of waiting.filter((s) => !gradeNumberOf(s.gradeLevel))) {
        notPlaced.push({ id: student.id, name: student.fullNameArabic, reason: 'الصف الدراسي غير محدد للطالب' });
      }
    }

    if (updates.length) await prisma.$transaction(updates);

    return { placedCount: placed.length, notPlacedCount: notPlaced.length, placed, notPlaced };
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  /**
   * Registers a list of students one by one: a wrong row is reported (with its row number and the reason)
   * and the others are still registered.
   */
  static async bulkImportStudents(studentsList) {
    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      throw AppError.badRequest('بيانات الاستيراد يجب أن تكون مصفوفة غير فارغة');
    }
    if (studentsList.length > MAX_IMPORT_ROWS) {
      throw AppError.badRequest(`الحد الأقصى ${MAX_IMPORT_ROWS} طالب في المرة الواحدة (الملف يحتوي على ${studentsList.length})`);
    }

    const createdList = [];
    const errors = [];

    for (let index = 0; index < studentsList.length; index++) {
      const row = studentsList[index] || {};
      const rowNumber = row.rowNumber || index + 1;
      try {
        if (row.parseError) throw AppError.badRequest(row.parseError);
        createdList.push(await this.createStudent(row));
      } catch (err) {
        errors.push({
          row: rowNumber,
          name: cleanName(row.fullNameArabic || row.fullName) || 'غير محدد',
          error: err.statusCode && err.statusCode < 500 ? err.message : 'تعذر حفظ هذا الطالب، حاول مرة أخرى',
        });
        if (!(err.statusCode && err.statusCode < 500)) console.error('[Students import] row', rowNumber, err);
      }
    }

    return {
      totalRows: studentsList.length,
      importedCount: createdList.length,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      students: createdList,
    };
  }

  /**
   * Normalize Excel Cell values (especially National ID & Phone numbers stored as numbers)
   */
  static cleanExcelValue(val) {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (/^[0-9]+(\.[0-9]+)?[eE]\+[0-9]+$/.test(str)) {
      try {
        str = BigInt(Math.round(Number(str))).toString();
      } catch (_) {}
    }
    return str;
  }

  /**
   * Excel turns a typed "2/3" into a date. Reads the class back from it when only one reading
   * (month/day or day/month) is a real class; otherwise the row is rejected, never guessed.
   */
  static classFromExcelDate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const isClass = (grade, section) => grade >= 1 && grade <= 3 && section >= 1 && section <= MAX_SECTIONS;
    const readings = new Set();
    if (isClass(month, day)) readings.add(`${month}/${day}`);
    if (isClass(day, month)) readings.add(`${day}/${month}`);
    if (readings.size === 1) return { classId: [...readings][0] };
    return {
      parseError:
        'تحولت خانة الفصل إلى تاريخ في ملف Excel، لذا فالفصل المقصود غير واضح. غيّر تنسيق عمود الفصل إلى "نص" واكتب الفصل مثل 2/3',
    };
  }

  /**
   * Parse an Excel Buffer (.xlsx, .xls, .csv) into an array of student objects.
   * Each one carries `rowNumber`: its row in the sheet, for the import report.
   */
  static parseExcelToStudentsArray(buffer) {
    let workbook;
    try {
      workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
    } catch (_) {
      throw AppError.badRequest('تعذر قراءة الملف. تأكد إنه ملف إكسيل سليم (.xlsx أو .xls أو .csv)');
    }
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw AppError.badRequest('ملف الإكسيل فارغ أو لا يحتوي على أوراق عمل');
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawMatrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true });
    // The sheet's data may not start at row 1
    const firstSheetRow = sheet['!ref'] ? xlsx.utils.decode_range(sheet['!ref']).s.r + 1 : 1;

    if (!rawMatrix || rawMatrix.length === 0) {
      throw AppError.badRequest('ورقة العمل لا تحتوي على أية صفوف بيانات');
    }

    // Helper: Normalize Arabic string for robust fuzzy comparison
    const norm = (s) =>
      String(s || '')
        .replace(/[﻿​-\u200F ]/g, '') // remove zero-width & non-breaking spaces
        .replace(/[ً-ٰٟـ]/g, '') // remove Tashkeel and Tatweel (ـ)
        .replace(/[أإآٱ]/g, 'ا') // normalize Alef
        .replace(/[ة]/g, 'ه') // normalize Taa marbouta
        .replace(/[ى]/g, 'ي') // normalize Alef maksoura
        .replace(/[\*\(\)\[\]\{\}\s\-_\/\\:;,\.\|]/g, '') // strip special chars, asterisks, brackets
        .toLowerCase()
        .trim();

    // Checkers for header types
    const isNidHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return n.includes('قومي') || n.includes('بطاق') || n.includes('national') || n.includes('nid') || n.includes('هوي');
    };

    const isPhoneHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return n.includes('هاتف') || n.includes('تليفون') || n.includes('موب') || n.includes('phone') || n.includes('mobile');
    };

    const isGradeHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return n.includes('صف') || n.includes('مرحل') || n.includes('grade') || n.includes('stage');
    };

    const isClassHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return n.includes('فصل') || n.includes('class') || n.includes('قاع') || n.includes('شعب');
    };

    const isCodeHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return (
        (n.includes('كود') ||
          n.includes('code') ||
          n.includes('جلوس') ||
          n.includes('مسلسل') ||
          n === 'م' ||
          n === 'رقم') &&
        !isNidHeader(value) &&
        !isPhoneHeader(value)
      );
    };

    const isGuardianHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return (
        (n.includes('ولي') || n.includes('والد') || n.includes('guardian') || n.includes('اسمالاب') || n.includes('اسماب')) &&
        !isPhoneHeader(value)
      );
    };

    const isStatusHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      return n.includes('قيد') || n.includes('status') || n.includes('حال') || n.includes('انتظام');
    };

    const isNameHeader = (value) => {
      const n = norm(value);
      if (!n) return false;
      // Exclude codes, national IDs, phones, classes, grades, status, guardian
      if (
        isCodeHeader(value) ||
        isNidHeader(value) ||
        isPhoneHeader(value) ||
        isClassHeader(value) ||
        isGradeHeader(value) ||
        isStatusHeader(value) ||
        isGuardianHeader(value) ||
        n.includes('اسمالام') ||
        n.includes('اسمام')
      ) {
        return false;
      }
      return (
        n.includes('اسم') ||
        n.includes('name') ||
        n === 'طالب' ||
        n === 'الطالب' ||
        n === 'الطلاب' ||
        n === 'تلميذ' ||
        n === 'التلميذ' ||
        n === 'التلاميذ' ||
        n.includes('اسماء') ||
        n.includes('بيانات')
      );
    };

    // 1. Detect the actual header row (in case row 0 is a title banner like "مدرسة...")
    let headerRowIndex = -1;

    for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row)) continue;
      let matchedCount = 0;
      for (const cell of row) {
        const value = cell instanceof Date ? '' : String(cell || '').trim();
        if (!value) continue;
        if (
          isNameHeader(value) ||
          isNidHeader(value) ||
          isClassHeader(value) ||
          isGradeHeader(value) ||
          isPhoneHeader(value) ||
          isGuardianHeader(value) ||
          isCodeHeader(value)
        ) {
          matchedCount++;
        }
      }
      if (matchedCount >= 2) {
        headerRowIndex = r;
        break;
      }
    }

    // Fallback: check if row 0 has a recognized name header even if only 1 header matched
    if (headerRowIndex === -1 && rawMatrix.length > 0 && Array.isArray(rawMatrix[0])) {
      const hasName = rawMatrix[0].some((cell) => isNameHeader(String(cell || '').trim()));
      if (hasName) {
        headerRowIndex = 0;
      }
    }

    const colMap = new Map(); // fieldName -> colIndex
    let dataRows = [];

    if (headerRowIndex >= 0) {
      const headerRow = rawMatrix[headerRowIndex] || [];
      headerRow.forEach((cell, idx) => {
        const value = String(cell || '').trim();
        if (!value) return;
        if (isNameHeader(value) && !colMap.has('name')) colMap.set('name', idx);
        else if (isNidHeader(value) && !colMap.has('nid')) colMap.set('nid', idx);
        else if (isCodeHeader(value) && !colMap.has('code')) colMap.set('code', idx);
        else if (isGradeHeader(value) && !colMap.has('grade')) colMap.set('grade', idx);
        else if (isClassHeader(value) && !colMap.has('class')) colMap.set('class', idx);
        else if (isPhoneHeader(value) && !colMap.has('phone')) colMap.set('phone', idx);
        else if (isGuardianHeader(value) && !colMap.has('guardian')) colMap.set('guardian', idx);
        else if (isStatusHeader(value) && !colMap.has('status')) colMap.set('status', idx);
      });
      dataRows = rawMatrix.slice(headerRowIndex + 1);
    } else {
      // No header row at all: all rows are data!
      dataRows = rawMatrix;
    }
    const firstDataRow = firstSheetRow + (headerRowIndex >= 0 ? headerRowIndex + 1 : 0);

    // 2. Process data rows
    const parsedStudents = [];
    const isClassText = (value) => /^[123]\s*\/\s*\d+$/.test(toLatinDigits(value));

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      if (!Array.isArray(row)) continue;

      // Skip completely empty rows
      const hasAnyContent = row.some((c) => c instanceof Date || String(c ?? '').trim() !== '');
      if (!hasAnyContent) continue;

      const getVal = (field) => {
        const colIdx = colMap.get(field);
        if (colIdx === undefined || row[colIdx] === undefined || row[colIdx] instanceof Date) return '';
        return this.cleanExcelValue(row[colIdx]);
      };
      const cellText = (c) => (row[c] instanceof Date ? '' : String(row[c] ?? '').trim());

      let fullNameArabic = getVal('name');
      let nationalId = normalizeNationalId(getVal('nid'));
      const studentCode = getVal('code');
      let gradeLevel = getVal('grade');
      let classId = toLatinDigits(getVal('class'));
      let guardianName = getVal('guardian');
      let guardianPhone = normalizePhone(getVal('phone'));
      const enrollmentStatus = getVal('status') || 'منتظم';
      let parseError = null;

      // The class cell became a date in Excel ("2/3" -> 2 March)
      const rawClassCell = colMap.has('class') ? row[colMap.get('class')] : undefined;
      if (rawClassCell instanceof Date) {
        const fromDate = this.classFromExcelDate(rawClassCell);
        classId = fromDate.classId ?? '';
        parseError = fromDate.parseError ?? null;
      }

      // Smart fallback 1: the national ID column is missing or wrong -> look for a valid one in the row.
      // If none is found the original value is kept, so the row is rejected with the reason.
      if (!isValidNationalId(nationalId)) {
        for (let c = 0; c < row.length; c++) {
          const cleaned = normalizeNationalId(this.cleanExcelValue(cellText(c)));
          if (isValidNationalId(cleaned)) {
            nationalId = cleaned;
            break;
          }
        }
      }

      // Smart fallback 2: same for the guardian's Egyptian mobile number
      if (!isValidEgyptianMobile(guardianPhone)) {
        for (let c = 0; c < row.length; c++) {
          const cleaned = normalizePhone(this.cleanExcelValue(cellText(c)));
          if (isValidEgyptianMobile(cleaned)) {
            guardianPhone = cleaned;
            break;
          }
        }
      }

      // Smart fallback 3: no class column -> look for a class like 1/1, 2/3
      if (!classId && !parseError && !colMap.has('class')) {
        for (let c = 0; c < row.length; c++) {
          if (isClassText(cellText(c))) {
            classId = toLatinDigits(cellText(c));
            break;
          }
        }
      }

      // Smart fallback 4: Robust scan for Student Full Name in all cells
      if (!fullNameArabic || /^\d+$/.test(fullNameArabic)) {
        for (let c = 0; c < row.length; c++) {
          const value = cellText(c);
          if (!value || value.length < 3) continue;
          if (/^[\d٠-٩\s\-]+$/.test(value)) continue;
          if (value === guardianPhone || value === classId) continue;
          if (isClassText(value)) continue;
          if (/^(صف|الصف)|اعدادي|إعدادي/.test(value)) continue;
          if (/^(منتظم|موقوف|منقول)$/.test(value)) continue;
          // An Arabic name with at least 2 words
          const arabicWords = value.split(/\s+/).filter((w) => /^[ء-يٱ-ۓ]+$/.test(w));
          if (arabicWords.length >= 2) {
            fullNameArabic = value;
            break;
          }
        }
      }

      // No guardian name: the student's name without the first name is the father's (3+ words)
      if (!guardianName && fullNameArabic) {
        const parts = fullNameArabic.trim().split(/\s+/);
        if (parts.length >= 3) {
          guardianName = parts.slice(1).join(' ');
        }
      }

      // No grade but a class like 1/1 -> the class's grade
      if (!gradeLevel && classId) {
        const match = classId.match(/^([123])\s*\/\s*(\d+)$/);
        if (match) gradeLevel = gradeLabelOf(Number(match[1]));
      }

      parsedStudents.push({
        rowNumber: firstDataRow + rowIndex,
        fullNameArabic,
        nationalId,
        studentCode,
        gradeLevel,
        classId,
        guardianName,
        guardianPhone,
        enrollmentStatus,
        ...(parseError && { parseError }),
      });
    }

    if (parsedStudents.length === 0) {
      throw AppError.badRequest('لم يتم العثور على أية صفوف بيانات صالحة للطلاب في الملف');
    }

    return parsedStudents;
  }

  /**
   * Import students directly from an uploaded Excel file buffer
   */
  static async importFromExcel(buffer) {
    const studentsList = this.parseExcelToStudentsArray(buffer);
    return this.bulkImportStudents(studentsList);
  }

  // ---------------------------------------------------------------------------
  // Excel files
  // ---------------------------------------------------------------------------

  /**
   * Generate an official Excel template for student enrollment
   */
  static generateExcelTemplate() {
    // Same columns & order as the students table. The class is written in full, e.g. "2/3".
    // Status: منتظم / موقوف / منقول (empty = منتظم).
    const headers = [
      'اسم الطالب رباعي',
      'الرقم القومي للطالب',
      'الصف الدراسي',
      'الفصل',
      'اسم ولي الأمر',
      'هاتف ولي الأمر',
      'كود الطالب (اختياري)',
      'الحالة (اختياري)',
    ];

    const sampleRows = [
      ['عمر أحمد محمود إبراهيم', '31105151234567', 'الصف الأول الإعدادي', '1/1', 'أحمد محمود إبراهيم', '01012345678', '', ''],
      ['سارة علي حسن سالم', '31208201234568', 'الصف الثاني الإعدادي', '2/3', 'علي حسن سالم', '01123456789', '', ''],
      ['يوسف محمد عبد الله الشريف', '31010101234569', 'الصف الثالث الإعدادي', '3/2', 'محمد عبد الله الشريف', '01234567890', '', 'منتظم'],
    ];

    const ws = xlsx.utils.aoa_to_sheet([headers, ...sampleRows]);
    // National ID, class & phone stay text in Excel (so 2/3 isn't turned into a date, nor 010... lose its 0)
    for (let r = 1; r <= sampleRows.length; r++) {
      for (const c of [1, 3, 5]) {
        const cell = ws[xlsx.utils.encode_cell({ r, c })];
        if (cell) cell.z = '@';
      }
    }

    ws['!cols'] = [{ wch: 34 }, { wch: 22 }, { wch: 24 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 20 }, { wch: 16 }];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'الطلاب');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /** The students list (same filters as the list page) as an Excel file, sorted by class then name */
  static async exportStudentsExcel(query = {}) {
    const { students } = await StudentModel.findAll({ ...query, page: undefined, limit: undefined });
    students.sort(
      (a, b) =>
        (a.class?.name ?? '~').localeCompare(b.class?.name ?? '~', 'en', { numeric: true }) ||
        compareArabic(a.fullNameArabic, b.fullNameArabic)
    );

    const headers = [
      'م',
      'اسم الطالب',
      'الرقم القومي',
      'كود الطالب',
      'الصف الدراسي',
      'الفصل',
      'النوع',
      'تاريخ الميلاد',
      'اسم ولي الأمر',
      'هاتف ولي الأمر',
      'الحالة',
    ];
    const rows = students.map((s, i) => [
      i + 1,
      s.fullNameArabic,
      s.nationalId ?? '',
      s.studentCode,
      s.gradeLevel ?? '',
      s.class?.name ?? 'بدون فصل',
      s.gender === 'FEMALE' ? 'أنثى' : 'ذكر',
      s.dateOfBirth ?? '',
      s.guardianName ?? '',
      s.guardianPhone ?? '',
      s.enrollmentStatus ?? '',
    ]);

    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 6 }, { wch: 34 }, { wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 10 }];
    ws['!views'] = [{ RTL: true }];
    const wb = xlsx.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    xlsx.utils.book_append_sheet(wb, ws, 'الطلاب');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ---------------------------------------------------------------------------
  // Card & deletion
  // ---------------------------------------------------------------------------

  static async generateStudentCard(id, user = null) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }
    await this.assertCanView(student, user);

    return {
      cardId: `CARD-${student.studentCode}`,
      schoolName: 'مدرسة الشهيد أحمد إبراهيم للتعليم الأساسي - سلوا',
      schoolAdministration: 'إدارة كوم أمبو التعليمية - محافظة أسوان',
      student: {
        id: student.id,
        studentCode: student.studentCode,
        fullNameArabic: student.fullNameArabic,
        fullNameEnglish: student.fullNameEnglish,
        nationalId: student.nationalId,
        gender: student.gender,
        gradeLevel: student.gradeLevel || gradeLabelOf(gradeNumberOfClass(student.class)),
        className: student.class?.displayNameArabic || student.class?.name,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
        enrollmentStatus: student.enrollmentStatus,
      },
      barcodeValue: student.studentCode,
      qrData: JSON.stringify({
        code: student.studentCode,
        name: student.fullNameArabic,
        nid: student.nationalId,
        class: student.class?.name,
      }),
      issuedAt: new Date().toISOString(),
      expiresAt: `${new Date().getFullYear() + 1}-06-30`,
    };
  }

  /**
   * Deletes a student registered by mistake. A student with attendance or grades on record
   * can't be deleted (it would erase that history): they are marked "منقول" instead.
   */
  static async deleteStudent(id) {
    const student = await prisma.student.findUnique({
      where: { id },
      select: { id: true, _count: { select: { attendances: true, grades: true } } },
    });
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }
    if (student._count.attendances > 0 || student._count.grades > 0) {
      throw AppError.conflict(
        `لا يمكن حذف الطالب لأن له سجلات (${student._count.attendances} غياب، ${student._count.grades} درجة). غيّر حالته إلى "منقول" بدلاً من الحذف للحفاظ على سجله`
      );
    }

    // The student's account is on the same row, so it goes with it
    await StudentModel.delete(id);
    return true;
  }
}

export default StudentsService;
