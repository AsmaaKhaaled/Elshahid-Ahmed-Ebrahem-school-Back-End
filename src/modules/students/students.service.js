import bcrypt from 'bcryptjs';
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
