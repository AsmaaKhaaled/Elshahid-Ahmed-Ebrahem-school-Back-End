import bcrypt from 'bcryptjs';
import * as xlsx from 'xlsx';
import { prisma } from '../../config/database.js';
import { StudentModel } from './students.model.js';
import { AppError } from '../../shared/errors/app-error.js';

export class StudentsService {
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

    // 4. Resolve Class (accepts direct ID, or name like '1/1' or 'فصل 1/1')
    let resolvedClassId = null;
    let resolvedGradeLevel = (data.gradeLevel || '').trim() || null;

    const classInput = (data.classId || data.className || '').trim();
    if (classInput) {
      // Try direct ID lookup first
      let matchedClass = await prisma.class.findUnique({
        where: { id: classInput },
      });

      // If not by direct ID, search by name or displayNameArabic
      if (!matchedClass) {
        const cleanName = classInput.replace(/^(فصل\s*)/, '').trim();
        matchedClass = await prisma.class.findFirst({
          where: {
            OR: [
              { name: cleanName },
              { displayNameArabic: { contains: cleanName, mode: 'insensitive' } },
            ],
          },
        });
      }

      if (matchedClass) {
        resolvedClassId = matchedClass.id;
        if (!resolvedGradeLevel) {
          resolvedGradeLevel = matchedClass.gradeLevel || matchedClass.displayNameArabic;
        }
      } else {
        // If they provided a raw ID, use it directly
        resolvedClassId = classInput;
      }
    }

    // 5. Determine Enrollment Status and Active State
    const enrollmentStatus = (data.enrollmentStatus || 'منتظم').trim();
    const isInactiveStatus = ['محول', 'مفصول', 'INACTIVE'].includes(enrollmentStatus);
    const isActive = data.isActive !== undefined ? data.isActive : !isInactiveStatus;

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
      const classInput = (data.classId || data.className).trim();
      let matchedClass = await prisma.class.findUnique({ where: { id: classInput } });
      if (!matchedClass) {
        const cleanName = classInput.replace(/^(فصل\s*)/, '').trim();
        matchedClass = await prisma.class.findFirst({
          where: {
            OR: [
              { name: cleanName },
              { displayNameArabic: { contains: cleanName, mode: 'insensitive' } },
            ],
          },
        });
      }
      if (matchedClass) {
        updatePayload.classId = matchedClass.id;
      }
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
        .replace(/[\u064B-\u065F\u0670]/g, '')       // remove Tashkeel
        .replace(/[أإآٱ]/g, 'ا')                       // normalize Alef
        .replace(/[ة]/g, 'ه')                          // normalize Taa marbouta
        .replace(/[ى]/g, 'ي')                          // normalize Alef maksoura
        .replace(/[\*\(\)\[\]\{\}\s\-_\/\\:;,\.\|]/g, '') // strip special chars, asterisks, brackets
        .toLowerCase()
        .trim();

    // Checkers for header types
    const isNameHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        (n.includes('اسم') || n.includes('طالب') || n.includes('تلميذ') || n.includes('name')) &&
        !n.includes('ولي') &&
        !n.includes('guardian') &&
        !n.includes('اب') &&
        !n.includes('والد')
      );
    };

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

    const isCodeHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return n.includes('كود') || n.includes('code') || n.includes('جلوس') || n.includes('مسلسل');
    };

    const isGradeHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return n.includes('صف') || n.includes('مرحل') || n.includes('grade') || n.includes('stage');
    };

    const isClassHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return n.includes('فصل') || n.includes('class') || n.includes('قاع') || n.includes('شعب');
    };

    const isPhoneHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        n.includes('هاتف') ||
        n.includes('تليفون') ||
        n.includes('موب') ||
        n.includes('phone') ||
        n.includes('mobile') ||
        (n.includes('رقم') && !n.includes('قومي') && !n.includes('جلوس') && !n.includes('كود'))
      );
    };

    const isGuardianHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return (
        (n.includes('ولي') || n.includes('والد') || n.includes('اب') || n.includes('guardian')) &&
        !isPhoneHeader(text)
      );
    };

    const isStatusHeader = (text) => {
      const n = norm(text);
      if (!n) return false;
      return n.includes('قيد') || n.includes('status') || n.includes('حال') || n.includes('انتظام');
    };

    // 1. Detect the actual header row (in case row 0 is a title banner like "مدرسة...")
    let headerRowIndex = 0;

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

    const headerRow = rawMatrix[headerRowIndex] || [];
    const colMap = new Map(); // colIndex -> fieldName

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

    // 2. Process data rows
    const dataRows = rawMatrix.slice(headerRowIndex + 1);
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
      let nationalId = getVal('nid').replace(/[\s-]/g, '');
      let studentCode = getVal('code');
      let gradeLevel = getVal('grade');
      let classId = getVal('class');
      let guardianName = getVal('guardian');
      let guardianPhone = getVal('phone').replace(/[\s-]/g, '');
      let enrollmentStatus = getVal('status') || 'منتظم';

      // Smart fallback: If column mappings were not found by name, scan row cells
      if (!fullNameArabic) {
        const firstCell = String(row[0] || '').trim();
        if (firstCell && firstCell.length >= 3 && !/^\d+$/.test(firstCell)) {
          fullNameArabic = firstCell;
        }
      }

      if (!nationalId) {
        for (const cell of row) {
          const cleaned = String(cell || '').trim().replace(/[\s-]/g, '');
          if (/^[23]\d{13}$/.test(cleaned)) {
            nationalId = cleaned;
            break;
          }
        }
      }

      if (!guardianPhone) {
        for (const cell of row) {
          let cleaned = String(cell || '').trim().replace(/[\s-]/g, '');
          if (cleaned.length === 10 && cleaned.startsWith('1')) cleaned = '0' + cleaned;
          if (/^01[0125]\d{8}$/.test(cleaned)) {
            guardianPhone = cleaned;
            break;
          }
        }
      }

      // Fix phone starting without 0 if length is 10
      if (guardianPhone.length === 10 && guardianPhone.startsWith('1')) {
        guardianPhone = '0' + guardianPhone;
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
    const headers = [
      'الاسم رباعي (باللغة العربية)*',
      'الرقم القومي للطالب (14 رقم)*',
      'كود الطالب (اختياري)',
      'الصف الدراسي*',
      'الفصل*',
      'اسم ولي الأمر*',
      'هاتف ولي الأمر*',
      'حالة القيد*',
    ];

    const sampleRows = [
      [
        'عمر أحمد محمود إبراهيم',
        '31105151234567',
        'STD-2026-001',
        'الصف الأول الإعدادي',
        '1/1',
        'أحمد محمود إبراهيم',
        '01012345678',
        'منتظم',
      ],
      [
        'سارة علي حسن سالم',
        '31208201234568',
        '',
        'الصف الثاني الإعدادي',
        '2/1',
        'علي حسن سالم',
        '01123456789',
        'منتظم',
      ],
      [
        'يوسف محمد عبد الله الشريف',
        '31010101234569',
        '',
        'الصف الثالث الإعدادي',
        '3/2',
        'محمد عبد الله الشريف',
        '01234567890',
        'منتظم',
      ],
    ];

    const data = [headers, ...sampleRows];
    const ws = xlsx.utils.aoa_to_sheet(data);

    ws['!cols'] = [
      { wch: 30 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 12 },
      { wch: 25 },
      { wch: 18 },
      { wch: 14 },
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
