import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';

export class UserModel {
  static get userSelectFields() {
    return {
      id: true,
      fullName: true,
      name: true,
      email: true,
      nationalId: true,
      role: true,
      status: true,
      permissions: true,
      phone: true,
      jobTitle: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  static formatUser(u, defaultRole = 'USER') {
    return {
      id: u.id,
      fullName: u.fullName || u.fullNameArabic || u.name || '',
      name: u.name || u.fullName || u.fullNameArabic || '',
      email: u.email || null,
      nationalId: u.nationalId || null,
      studentCode: u.studentCode || null,
      teacherCode: u.teacherCode || null,
      role: u.role || defaultRole,
      status: u.status || 'ACTIVE',
      phone: u.phone || u.guardianPhone || null,
      jobTitle: u.jobTitle || u.specialization || u.gradeLevel || null,
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  static async findAll({ role, search } = {}) {
    const roleUpper = role ? role.toUpperCase() : null;

    let users = [];
    let teachers = [];
    let students = [];

    const searchCondition = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { nationalId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    // 1. Fetch from User table (Admins, Parents, or any user registered in users table)
    if (!roleUpper || ['ADMIN', 'SUPER_ADMIN', 'PARENT'].includes(roleUpper)) {
      const userWhere = { ...searchCondition };
      if (roleUpper) {
        userWhere.role = roleUpper;
      }
      users = await prisma.user.findMany({
        where: userWhere,
        select: this.userSelectFields,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // If roleUpper is TEACHER or STUDENT, also check if any in User table have that role
      users = await prisma.user.findMany({
        where: { role: roleUpper, ...searchCondition },
        select: this.userSelectFields,
        orderBy: { createdAt: 'desc' },
      });
    }

    // 2. Fetch from Teacher table if role is empty or TEACHER
    if (!roleUpper || roleUpper === 'TEACHER') {
      const teacherWhere = search
        ? {
            OR: [
              { fullNameArabic: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { nationalId: { contains: search, mode: 'insensitive' } },
              { teacherCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};

      const teacherRows = await prisma.teacher.findMany({
        where: teacherWhere,
        orderBy: { createdAt: 'desc' },
      });

      teachers = teacherRows.map((t) => this.formatUser(t, 'TEACHER'));
    }

    // 3. Fetch from Student table if role is empty or STUDENT
    if (!roleUpper || roleUpper === 'STUDENT') {
      const studentWhere = search
        ? {
            OR: [
              { fullNameArabic: { contains: search, mode: 'insensitive' } },
              { nationalId: { contains: search, mode: 'insensitive' } },
              { studentCode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};

      const studentRows = await prisma.student.findMany({
        where: studentWhere,
        orderBy: { createdAt: 'desc' },
      });

      students = studentRows.map((s) => this.formatUser(s, 'STUDENT'));
    }

    // Combine all and avoid duplicate IDs if any
    const existingIds = new Set(users.map((u) => u.id));
    const all = [...users.map((u) => this.formatUser(u))];

    for (const t of teachers) {
      if (!existingIds.has(t.id)) {
        all.push(t);
        existingIds.add(t.id);
      }
    }

    for (const s of students) {
      if (!existingIds.has(s.id)) {
        all.push(s);
        existingIds.add(s.id);
      }
    }

    // Sort by createdAt descending
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return all;
  }

  static async findById(id) {
    // 1. Try User
    const user = await prisma.user.findUnique({
      where: { id },
      select: this.userSelectFields,
    });
    if (user) return this.formatUser(user);

    // 2. Try Teacher
    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });
    if (teacher) return this.formatUser(teacher, 'TEACHER');

    // 3. Try Student
    const student = await prisma.student.findUnique({
      where: { id },
    });
    if (student) return this.formatUser(student, 'STUDENT');

    return null;
  }

  static async findByIdWithPassword(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) return { ...user, model: 'user' };

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      omit: { password: false },
    });
    if (teacher) return { ...teacher, model: 'teacher' };

    const student = await prisma.student.findUnique({
      where: { id },
      omit: { password: false },
    });
    if (student) return { ...student, model: 'student' };

    return null;
  }

  static async findByEmail(email) {
    if (!email) return null;
    const lower = email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: lower } });
    if (user) return this.formatUser(user);
    const teacher = await prisma.teacher.findFirst({ where: { email: lower } });
    if (teacher) return this.formatUser(teacher, 'TEACHER');
    return null;
  }

  static async create(data) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    const fullName = data.fullName || data.name;
    const role = data.role ? data.role.toUpperCase() : 'STUDENT';

    // If teacher role, create in Teacher table so they can access teacher portal
    if (role === 'TEACHER') {
      const count = await prisma.teacher.count();
      const teacherCode = data.teacherCode || `TCH-${String(count + 1).padStart(3, '0')}`;
      const teacher = await prisma.teacher.create({
        data: {
          fullNameArabic: fullName,
          fullNameEnglish: data.fullNameEnglish || null,
          nationalId: data.nationalId || null,
          email: data.email ? data.email.toLowerCase() : null,
          phone: data.phone || null,
          specialization: data.jobTitle || data.specialization || 'عام',
          teacherCode,
          password: hashedPassword,
          role: 'TEACHER',
          status: data.status || 'ACTIVE',
          forcePasswordChange: false,
        },
      });
      return this.formatUser(teacher, 'TEACHER');
    }

    // If student role, create in Student table
    if (role === 'STUDENT') {
      const count = await prisma.student.count();
      const studentCode = data.studentCode || `STU-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
      const student = await prisma.student.create({
        data: {
          fullNameArabic: fullName,
          fullNameEnglish: data.fullNameEnglish || null,
          nationalId: data.nationalId || null,
          studentCode,
          guardianPhone: data.phone || null,
          gradeLevel: data.jobTitle || data.gradeLevel || null,
          password: hashedPassword,
          role: 'STUDENT',
          status: data.status || 'ACTIVE',
          forcePasswordChange: false,
        },
      });
      return this.formatUser(student, 'STUDENT');
    }

    // Otherwise create in User table (ADMIN, SUPER_ADMIN, PARENT, etc.)
    const created = await prisma.user.create({
      data: {
        fullName,
        name: fullName,
        email: data.email ? data.email.toLowerCase() : null,
        nationalId: data.nationalId || null,
        password: hashedPassword,
        role,
        status: data.status || 'ACTIVE',
        phone: data.phone || null,
        jobTitle: data.jobTitle || null,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      },
      select: this.userSelectFields,
    });

    return this.formatUser(created);
  }

  static async update(id, data) {
    // 1. Check User table
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (existingUser) {
      const updateData = {};
      if (data.fullName !== undefined) updateData.fullName = data.fullName;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.fullName && !data.name) updateData.name = data.fullName;
      if (data.name && !data.fullName) updateData.fullName = data.name;
      if (data.email !== undefined) updateData.email = data.email ? data.email.toLowerCase() : null;
      if (data.nationalId !== undefined) updateData.nationalId = data.nationalId || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.role !== undefined) updateData.role = data.role.toUpperCase();
      if (Array.isArray(data.permissions)) updateData.permissions = data.permissions;

      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(data.password, salt);
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: this.userSelectFields,
      });
      return this.formatUser(updated);
    }

    // 2. Check Teacher table
    const existingTeacher = await prisma.teacher.findUnique({ where: { id } });
    if (existingTeacher) {
      const teacherUpdate = {};
      if (data.name || data.fullName) teacherUpdate.fullNameArabic = data.fullName || data.name;
      if (data.email !== undefined) teacherUpdate.email = data.email ? data.email.toLowerCase() : null;
      if (data.nationalId !== undefined) teacherUpdate.nationalId = data.nationalId;
      if (data.phone !== undefined) teacherUpdate.phone = data.phone;
      if (data.jobTitle !== undefined) teacherUpdate.specialization = data.jobTitle;
      if (data.status !== undefined) teacherUpdate.status = data.status;
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        teacherUpdate.password = await bcrypt.hash(data.password, salt);
      }

      const updated = await prisma.teacher.update({
        where: { id },
        data: teacherUpdate,
      });
      return this.formatUser(updated, 'TEACHER');
    }

    // 3. Check Student table
    const existingStudent = await prisma.student.findUnique({ where: { id } });
    if (existingStudent) {
      const studentUpdate = {};
      if (data.name || data.fullName) studentUpdate.fullNameArabic = data.fullName || data.name;
      if (data.nationalId !== undefined) studentUpdate.nationalId = data.nationalId;
      if (data.phone !== undefined) studentUpdate.guardianPhone = data.phone;
      if (data.jobTitle !== undefined) studentUpdate.gradeLevel = data.jobTitle;
      if (data.status !== undefined) studentUpdate.status = data.status;
      if (data.password) {
        const salt = await bcrypt.genSalt(10);
        studentUpdate.password = await bcrypt.hash(data.password, salt);
      }

      const updated = await prisma.student.update({
        where: { id },
        data: studentUpdate,
      });
      return this.formatUser(updated, 'STUDENT');
    }

    return null;
  }

  static async changePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      return prisma.user.update({
        where: { id },
        data: { password: hashedPassword, forcePasswordChange: false },
        select: this.userSelectFields,
      });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (teacher) {
      const updated = await prisma.teacher.update({
        where: { id },
        data: { password: hashedPassword, forcePasswordChange: false },
      });
      return this.formatUser(updated, 'TEACHER');
    }

    const student = await prisma.student.findUnique({ where: { id } });
    if (student) {
      const updated = await prisma.student.update({
        where: { id },
        data: { password: hashedPassword, forcePasswordChange: false },
      });
      return this.formatUser(updated, 'STUDENT');
    }

    return null;
  }

  static async delete(id) {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (existingUser) {
      await prisma.user.delete({ where: { id } });
      return true;
    }
    const existingTeacher = await prisma.teacher.findUnique({ where: { id } });
    if (existingTeacher) {
      await prisma.teacher.delete({ where: { id } });
      return true;
    }
    const existingStudent = await prisma.student.findUnique({ where: { id } });
    if (existingStudent) {
      await prisma.student.delete({ where: { id } });
      return true;
    }
    return false;
  }
}

export default UserModel;
