import { prisma } from '../../config/database.js';

export class ClassModel {
  static formatClass(c) {
    const studentCount = c._count?.students ?? 0;
    const statusMap = {
      ON_DUTY: 'على رأس العمل',
      ON_LEAVE: 'إجازة اعتيادية',
      SECONDED: 'منتدب',
    };

    let classTeacher = null;
    if (c.classTeacher) {
      classTeacher = {
        id: c.classTeacher.id,
        name: c.classTeacher.fullNameArabic,
        fullNameArabic: c.classTeacher.fullNameArabic,
        teacherCode: c.classTeacher.teacherCode,
        phone: c.classTeacher.phone || '',
        specialization: c.classTeacher.specialization || '',
        status: statusMap[c.classTeacher.employmentStatus] || 'على رأس العمل',
        employmentStatus: c.classTeacher.employmentStatus || 'ON_DUTY',
      };
    }

    return {
      id: c.id,
      name: c.name,
      section: c.name,
      displayNameArabic: c.displayNameArabic || `فصل ${c.name}`,
      gradeLevel: c.gradeLevel,
      roomNumber: c.roomNumber || '',
      capacity: c.capacity,
      enrolledStudents: studentCount,
      currentStudentCount: studentCount,
      shift: 'صباحي',
      classTeacherId: c.classTeacherId || null,
      classTeacher,
      advisorHistory: Array.isArray(c.advisorHistory) ? c.advisorHistory : [],
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  static async findAll({ gradeLevel, search, includeInactive } = {}) {
    // Classes removed from this year's setup only show when asked for (?includeInactive=true)
    const where = includeInactive === 'true' ? {} : { isActive: true };

    if (gradeLevel) {
      where.gradeLevel = { contains: gradeLevel, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayNameArabic: { contains: search, mode: 'insensitive' } },
      ];
    }

    const classList = await prisma.class.findMany({
      where,
      include: {
        classTeacher: true,
        _count: {
          select: { students: { where: { isActive: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classList.map((c) => this.formatClass(c));
  }

  static async findById(id) {
    // Try ID first, then fallback to name (e.g. "1/1")
    let cls = await prisma.class.findUnique({
      where: { id },
      include: {
        classTeacher: true,
        _count: {
          select: { students: { where: { isActive: true } } },
        },
      },
    });

    if (!cls) {
      cls = await prisma.class.findUnique({
        where: { name: id },
        include: {
          classTeacher: true,
          _count: {
            select: { students: { where: { isActive: true } } },
          },
        },
      });
    }

    if (!cls) return null;

    return this.formatClass(cls);
  }

  static async create(data) {
    const created = await prisma.class.create({
      data: {
        name: data.name,
        displayNameArabic: data.displayNameArabic || data.name,
        gradeLevel: data.gradeLevel,
        roomNumber: data.roomNumber || null,
        capacity: Number(data.capacity) || 40,
        classTeacherId: data.classTeacherId || null,
        advisorHistory: Array.isArray(data.advisorHistory) ? data.advisorHistory : [],
      },
      include: {
        classTeacher: true,
        _count: {
          select: { students: { where: { isActive: true } } },
        },
      },
    });

    return this.formatClass(created);
  }

  static async update(id, data) {
    const allowed = ['name', 'displayNameArabic', 'gradeLevel', 'roomNumber', 'capacity', 'classTeacherId', 'advisorHistory'];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = key === 'capacity' ? Number(data[key]) : data[key];
      }
    }

    const updated = await prisma.class.update({
      where: { id },
      data: updateData,
      include: {
        classTeacher: true,
        _count: {
          select: { students: { where: { isActive: true } } },
        },
      },
    });

    return this.formatClass(updated);
  }

  static async delete(id) {
    await prisma.class.delete({
      where: { id },
    });
    return true;
  }
}

export default ClassModel;
