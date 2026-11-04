import bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import { prisma } from '../../config/database.js';
import { StudentModel } from './students.model.js';
import { AppError } from '../../shared/errors/app-error.js';

// The school's only enrollment statuses
export const STUDENT_STATUSES = ['منتظم', 'موقوف', 'منقول'];
// Statuses that take a student off the class lists and disable their sign-in
const INACTIVE_STATUSES = ['موقوف', 'منقول'];

const assertValidStatus = (status) => {
  if (!STUDENT_STATUSES.includes(status)) {
    throw AppError.badRequest(`حالة القيد "${status}" غير صحيحة. الحالات المتاحة: ${STUDENT_STATUSES.join(' / ')}`);
  }
};

// Grade level text -> its number, e.g. 'الصف الثاني الإعدادي' -> 2
const gradeNumberOf = (gradeLevel) => {
  const text = String(gradeLevel || '');
  if (text.includes('الأول') || text.includes('الاول') || text.startsWith('1')) return 1;
  if (text.includes('الثاني') || text.startsWith('2')) return 2;
  if (text.includes('الثالث') || text.startsWith('3')) return 3;
  return null;
};

export class StudentsService {
  /**
   * Finds the class a student belongs to. Accepts a class ID, a class name ('3/2' or 'فصل 3/2'),
   * or just the section number (e.g. 2, as in the Excel template's "رقم الفصل") together with the grade level.
   * Matches exactly only, so a student is never put in a look-alike class.
   * @returns the class, or null when no class was given
   */
  static async resolveClass(classInput, gradeLevel) {
    const input = String(classInput ?? '').trim();
    if (!input) return null;

    const byId = await prisma.class.findUnique({ where: { id: input } });
    if (byId) return byId;

    let name = input.replace(/^فصل\s*/, '').replace(/\s+/g, '');
    if (/^\d+$/.test(name)) {
      const gradeNumber = gradeNumberOf(gradeLevel);
      if (!gradeNumber) {
        throw AppError.badRequest(`رقم الفصل "${input}" يحتاج الصف الدراسي لتحديد الفصل`);
      }
      name = `${gradeNumber}/${Number(name)}`;
    }

    const byName = await prisma.class.findUnique({ where: { name } });
    if (!byName) {
      throw AppError.badRequest(`الفصل "${name}" غير موجود بالمدرسة`);
    }
    return byName;
  }

  /**
   * Helper: Parse Egyptian National ID (14 digits)
   * Extracts gender ('MALE' | 'FEMALE') and date of birth ('YYYY-MM-DD')
   */
  static parseEgyptianNationalId(nationalId) {
    if (!nationalId || typeof nationalId !== 'string' || !/^[23]\d{13}$/.test(nationalId.trim())) {
      return { gender: null, dateOfBirth: null };
    }

    const cleaned = nationalId.trim();
    const century = cleaned[0] === '2' ? '19' : '20';
    const year = century + cleaned.substring(1, 3);
    const month = cleaned.substring(3, 5);
    const day = cleaned.substring(5, 7);
    const dateOfBirth = `${year}-${month}-${day}`;

    // 13th digit (index 12): even = FEMALE, odd = MALE
    const genderDigit = parseInt(cleaned[12], 10);
    const gender = genderDigit % 2 === 0 ? 'FEMALE' : 'MALE';

    return { gender, dateOfBirth };
  }

  /**
   * Get the next auto-generated student code (e.g. STD-2026-006)
   */
  static async getNextStudentCode() {
    return StudentModel.getNextStudentCode();
  }

  static async getStudents(query) {
    return StudentModel.findAll(query);
  }

  static async getStudentById(id) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }
    return student;
  }

  /**
   * Register/Create a new student with automatic User account provisioning
   */
  static async createStudent(data) {
    const fullNameArabic = (data.fullNameArabic || data.fullName || '').trim();
    const nationalId = (data.nationalId || '').trim();

    if (!fullNameArabic) {
      throw AppError.badRequest('اسم الطالب باللغة العربية مطلوب');
    }

    if (!nationalId || !/^\d{14}$/.test(nationalId)) {
      throw AppError.badRequest('الرقم القومي للطالب يجب أن يتكون من 14 رقماً');
    }

    // 1. Check uniqueness of National ID
    const existingStudentWithNid = await prisma.student.findUnique({
      where: { nationalId },
    });
    if (existingStudentWithNid) {
      throw AppError.conflict('الرقم القومي مسجل بالفعل لطالب آخر بالمنظومة');
    }

    const existingUserWithNid = await prisma.user.findFirst({
      where: { nationalId },
    });
    if (existingUserWithNid) {
      throw AppError.conflict('الرقم القومي مسجل بالفعل لحساب مستخدم آخر');
    }

    // 2. Resolve Student Code (provided or auto-generated)
    let studentCode = (data.studentCode || '').trim();
    if (!studentCode) {
      studentCode = await StudentModel.getNextStudentCode();
    } else {
      const existingStudentWithCode = await prisma.student.findUnique({
        where: { studentCode },
      });
      if (existingStudentWithCode) {
        throw AppError.conflict(`كود الطالب '${studentCode}' مسجل بالفعل لطالب آخر`);
      }
      const existingUserWithCode = await prisma.user.findFirst({
        where: { studentCode },
      });
      if (existingUserWithCode) {
        throw AppError.conflict(`كود الطالب '${studentCode}' مستخدم بالفعل في حساب آخر`);
      }
    }

    // 3. Derive gender and birthdate from National ID if not supplied
    const { gender: parsedGender, dateOfBirth: parsedDob } = this.parseEgyptianNationalId(nationalId);
    const gender = data.gender ? data.gender.toUpperCase() : parsedGender || 'MALE';
    const dateOfBirth = data.dateOfBirth || parsedDob || null;

    // 4. Resolve Class (class ID, a name like '1/1' / 'فصل 1/1', or a section number + grade level)
    let resolvedClassId = null;
    let resolvedGradeLevel = (data.gradeLevel || '').trim() || null;

    const matchedClass = await this.resolveClass(data.classId || data.className, resolvedGradeLevel);
    if (matchedClass) {
      resolvedClassId = matchedClass.id;
      // The class decides the grade, so the two can never disagree
      resolvedGradeLevel = matchedClass.gradeLevel || resolvedGradeLevel;
    }

    // 5. Determine Enrollment Status and Active State
    const enrollmentStatus = (data.enrollmentStatus || 'منتظم').trim();
    assertValidStatus(enrollmentStatus);
    const isActive = data.isActive !== undefined ? data.isActive : !INACTIVE_STATUSES.includes(enrollmentStatus);

    // 6. Provision the User login account for the student
    const defaultPassword = 'Student@2026';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const newUser = await prisma.user.create({
      data: {
        fullName: fullNameArabic,
        name: fullNameArabic,
        nationalId,
        studentCode,
        password: hashedPassword,
        role: 'STUDENT',
        status: isActive ? 'ACTIVE' : 'INACTIVE',
        forcePasswordChange: true,
        phone: data.guardianPhone ? data.guardianPhone.trim() : null,
      },
    });

    // 7. Create Student record linked to the newly provisioned User
    const student = await StudentModel.create({
      userId: newUser.id,
      studentCode,
      fullNameArabic,
      fullNameEnglish: data.fullNameEnglish?.trim() || null,
      nationalId,
      gender,
      dateOfBirth,
      gradeLevel: resolvedGradeLevel,
      classId: resolvedClassId,
      guardianName: (data.guardianName || '').trim() || null,
      guardianPhone: (data.guardianPhone || '').trim() || null,
      address: (data.address || '').trim() || null,
      enrollmentStatus,
      isActive,
    });

    return {
      ...student,
      initialCredentials: {
        identifier: studentCode,
        nationalId,
        initialPassword: defaultPassword,
        requirePasswordChange: true,
      },
    };
  }

  static async updateStudent(id, data) {
    const existing = await StudentModel.findById(id);
    if (!existing) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }

    if (data.studentCode && data.studentCode !== existing.studentCode) {
      const codeTaken = await StudentModel.findByCode(data.studentCode);
      if (codeTaken && codeTaken.id !== id) {
        throw AppError.conflict('كود الطالب مسجل بالفعل لطالب آخر');
      }
    }

    if (data.nationalId && data.nationalId !== existing.nationalId) {
      const nidTaken = await StudentModel.findByNationalId(data.nationalId);
      if (nidTaken && nidTaken.id !== id) {
        throw AppError.conflict('الرقم القومي مسجل بالفعل لطالب آخر');
      }
    }

    const updatePayload = { ...data };

    // Resolve class if changing class
    if (data.classId || data.className) {
      const matchedClass = await this.resolveClass(data.classId || data.className, data.gradeLevel);
      updatePayload.classId = matchedClass.id;
      updatePayload.gradeLevel = matchedClass.gradeLevel || data.gradeLevel;
    }

    // A transferred / dismissed / suspended student leaves the class lists and can't sign in
    const statusChanged = typeof data.enrollmentStatus === 'string' && data.enrollmentStatus.trim();
    if (statusChanged) {
      updatePayload.enrollmentStatus = data.enrollmentStatus.trim();
      assertValidStatus(updatePayload.enrollmentStatus);
      updatePayload.isActive = !INACTIVE_STATUSES.includes(updatePayload.enrollmentStatus);
    }

    const updated = await StudentModel.update(id, updatePayload);

    // Sync User record if student has linked userId
    if (existing.userId) {
      const userUpdate = {};
      if (data.fullNameArabic) {
        userUpdate.fullName = data.fullNameArabic.trim();
        userUpdate.name = data.fullNameArabic.trim();
      }
      if (data.nationalId) userUpdate.nationalId = data.nationalId.trim();
      if (data.studentCode) userUpdate.studentCode = data.studentCode.trim();
      if (data.guardianPhone) userUpdate.phone = data.guardianPhone.trim();
      if (statusChanged) userUpdate.status = updatePayload.isActive ? 'ACTIVE' : 'INACTIVE';

      if (Object.keys(userUpdate).length > 0) {
        await prisma.user.update({
          where: { id: existing.userId },
          data: userUpdate,
        });
      }
    }

    return updated;
  }

  static async enrollStudent(id, classId) {
    const updated = await StudentModel.enrollInClass(id, classId);
    if (!updated) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }
    return updated;
  }

  static async bulkImportStudents(studentsList) {
    if (!Array.isArray(studentsList) || studentsList.length === 0) {
      throw AppError.badRequest('بيانات الاستيراد يجب أن تكون مصفوفة غير فارغة');
    }

    const createdList = [];
    const errors = [];

    for (let index = 0; index < studentsList.length; index++) {
      const row = studentsList[index];
      try {
        const student = await this.createStudent(row);
        createdList.push(student);
      } catch (err) {
        errors.push({
          row: index + 1,
          name: row.fullNameArabic || 'غير محدد',
          error: err.message,
        });
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
   * Parse an Excel Buffer (.xlsx, .xls, .csv) into an array of student objects
   */
  static parseExcelToStudentsArray(buffer) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw AppError.badRequest('ملف الإكسيل فارغ أو لا يحتوي على أوراق عمل');
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawMatrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rawMatrix || rawMatrix.length === 0) {
      throw AppError.badRequest('ورقة العمل لا تحتوي على أية صفوف بيانات');
    }

    // Helper: Normalize Arabic string for robust fuzzy comparison
    const norm = (s) =>
      String(s || '')
        .replace(/[\uFEFF\u200B-\u200F\u00A0]/g, '') // remove zero-width & non-breaking spaces
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove Tashkeel and Tatweel (ـ)
        .replace(/[أإآٱ]/g, 'ا')                       // normalize Alef
        .replace(/[ة]/g, 'ه')                          // normalize Taa marbouta
        .replace(/[ى]/g, 'ي')                          // normalize Alef maksoura
        .replace(/[\*\(\)\[\]\{\}\s\-_\/\\:;,\.\|]/g, '') // strip special chars, asterisks, brackets
        .toLowerCase()
        .trim();

    // Checkers for header types
    const isNidHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        n.includes('قومي') ||
        n.includes('بطاق') ||
        n.includes('national') ||
        n.includes('nid') ||
        n.includes('هوي')
      );
    };

    const isPhoneHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        n.includes('هاتف') ||
        n.includes('تليفون') ||
        n.includes('موب') ||
        n.includes('phone') ||
        n.includes('mobile')
      );
    };

    const isGradeHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        n.includes('صف') ||
        n.includes('مرحل') ||
        n.includes('grade') ||
        n.includes('stage')
      );
    };

    const isClassHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        n.includes('فصل') ||
        n.includes('class') ||
        n.includes('قاع') ||
        n.includes('شعب')
      );
    };

    const isCodeHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        (n.includes('كود') ||
          n.includes('code') ||
          n.includes('جلوس') ||
          n.includes('مسلسل') ||
          n === 'م' ||
          n === 'رقم') &&
        !isNidHeader(text) &&
        !isPhoneHeader(text)
      );
    };

    const isGuardianHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        (n.includes('ولي') ||
          n.includes('والد') ||
          n.includes('guardian') ||
          n.includes('اسمالاب') ||
          n.includes('اسماب')) &&
        !isPhoneHeader(text)
      );
    };

    const isStatusHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return n.includes('قيد') || n.includes('status') || n.includes('حال') || n.includes('انتظام');
    };

    const isNameHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      // Exclude codes, national IDs, phones, classes, grades, status, guardian
      if (
        isCodeHeader(text) ||
        isNidHeader(text) ||
        isPhoneHeader(text) ||
        isClassHeader(text) ||
        isGradeHeader(text) ||
        isStatusHeader(text) ||
        isGuardianHeader(text) ||
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
        const text = String(cell || '').trim();
        if (!text) continue;
        if (
          isNameHeader(text) ||
          isNidHeader(text) ||
          isClassHeader(text) ||
          isGradeHeader(text) ||
          isPhoneHeader(text) ||
          isGuardianHeader(text) ||
          isCodeHeader(text)
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

    const colMap = new Map(); // colIndex -> fieldName
    let dataRows = [];

    if (headerRowIndex >= 0) {
      const headerRow = rawMatrix[headerRowIndex] || [];
      headerRow.forEach((cell, idx) => {
        const text = String(cell || '').trim();
        if (!text) return;
        if (isNameHeader(text) && !colMap.has('name')) colMap.set('name', idx);
        else if (isNidHeader(text) && !colMap.has('nid')) colMap.set('nid', idx);
        else if (isCodeHeader(text) && !colMap.has('code')) colMap.set('code', idx);
        else if (isGradeHeader(text) && !colMap.has('grade')) colMap.set('grade', idx);
        else if (isClassHeader(text) && !colMap.has('class')) colMap.set('class', idx);
        else if (isPhoneHeader(text) && !colMap.has('phone')) colMap.set('phone', idx);
        else if (isGuardianHeader(text) && !colMap.has('guardian')) colMap.set('guardian', idx);
        else if (isStatusHeader(text) && !colMap.has('status')) colMap.set('status', idx);
      });
      dataRows = rawMatrix.slice(headerRowIndex + 1);
    } else {
      // No header row at all: all rows are data!
      dataRows = rawMatrix;
    }

    // 2. Process data rows
    const parsedStudents = [];

    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      if (!Array.isArray(row)) continue;

      // Check if row is completely empty
      const hasAnyContent = row.some((c) => String(c || '').trim() !== '');
      if (!hasAnyContent) continue;

      const getVal = (field) => {
        const colIdx = colMap.get(field);
        if (colIdx !== undefined && row[colIdx] !== undefined) {
          return this.cleanExcelValue(row[colIdx]);
        }
        return '';
      };

      let fullNameArabic = getVal('name');
      let nationalId = getVal('nid').replace(/\s-/g, '');
      let studentCode = getVal('code');
      let gradeLevel = getVal('grade');
      let classId = getVal('class');
      let guardianName = getVal('guardian');
      let guardianPhone = getVal('phone').replace(/\s-/g, '');
      let enrollmentStatus = getVal('status') || 'منتظم';

      // Smart fallback 1: Scan for 14-digit National ID
      if (!nationalId || !/^[23]\d{13}$/.test(nationalId)) {
        for (let c = 0; c < row.length; c++) {
          const cleaned = String(row[c] || '').trim().replace(/\s-/g, '');
          if (/^[23]\d{13}$/.test(cleaned)) {
            nationalId = cleaned;
            break;
          }
        }
      }

      // Smart fallback 2: Scan for Egyptian phone number
      if (!guardianPhone || !/^01[0125]\d{8}$/.test(guardianPhone)) {
        for (let c = 0; c < row.length; c++) {
          let cleaned = String(row[c] || '').trim().replace(/\s-/g, '');
          if (cleaned.length === 10 && cleaned.startsWith('1')) cleaned = '0' + cleaned;
          if (/^01[0125]\d{8}$/.test(cleaned)) {
            guardianPhone = cleaned;
            break;
          }
        }
      }
      if (guardianPhone.length === 10 && guardianPhone.startsWith('1')) {
        guardianPhone = '0' + guardianPhone;
      }

      // Smart fallback 3: Scan for Class pattern (e.g. 1/1, 2/3)
      if (!classId) {
        for (let c = 0; c < row.length; c++) {
          const cellText = String(row[c] || '').trim();
          if (/^[123]\s*\/\s*\d+$/.test(cellText)) {
            classId = cellText;
            break;
          }
        }
      }

      // Smart fallback 4: Robust scan for Student Full Name in all cells
      if (!fullNameArabic || /^\d+$/.test(fullNameArabic)) {
        for (let c = 0; c < row.length; c++) {
          const cellText = String(row[c] || '').trim();
          if (!cellText || cellText.length < 3) continue;
          if (/^\d+$/.test(cellText)) continue;
          if (cellText === nationalId || cellText === guardianPhone || cellText === classId) continue;
          if (/^[123]\s*\/\s*\d+$/.test(cellText)) continue;
          if (/^صف|الصف|اعدادي|إعدادي/i.test(cellText)) continue;
          if (/^منتظم|موقوف|منقول$/i.test(cellText)) continue;
          // Check if Arabic name with at least 2 words
          const arabicWords = cellText.split(/\s+/).filter((w) => /^[\u0621-\u064A\u0671-\u06D3]+$/.test(w));
          if (arabicWords.length >= 2) {
            fullNameArabic = cellText;
            break;
          }
        }
      }

      // If guardianName not provided, deduce father's name from student's name if >= 3 words
      if (!guardianName && fullNameArabic) {
        const parts = fullNameArabic.trim().split(/\s+/);
        if (parts.length >= 3) {
          guardianName = parts.slice(1).join(' ');
        }
      }

      // If gradeLevel not provided but class is given like 1/1, deduce gradeLevel
      if (!gradeLevel && classId) {
        const match = classId.match(/([123])\s*\/\s*(\d+)/);
        if (match) {
          const stageDigit = match[1];
          if (stageDigit === '1') gradeLevel = 'الصف الأول الإعدادي';
          else if (stageDigit === '2') gradeLevel = 'الصف الثاني الإعدادي';
          else if (stageDigit === '3') gradeLevel = 'الصف الثالث الإعدادي';
        }
      }
      parsedStudents.push({
        fullNameArabic,
        nationalId,
        studentCode,
        gradeLevel,
        classId,
        guardianName,
        guardianPhone,
        enrollmentStatus: enrollmentStatus || 'منتظم',
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

    const data = [headers, ...sampleRows];
    const ws = xlsx.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 34 },
      { wch: 22 },
      { wch: 24 },
      { wch: 12 },
      { wch: 28 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'الطلاب');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  static async generateStudentCard(id) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }

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
        gradeLevel: student.gradeLevel || student.class?.gradeLevel,
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

  static async deleteStudent(id) {
    const student = await StudentModel.findById(id);
    if (!student) {
      throw AppError.notFound(`الطالب ذو المعرف '${id}' غير موجود`);
    }

    // Delete linked user account if exists
    if (student.userId) {
      await prisma.user.delete({ where: { id: student.userId } }).catch(() => {});
    }

    await StudentModel.delete(id);
    return true;
  }
}

export default StudentsService;
