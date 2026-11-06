import { prisma } from '../../config/database.js';

export class ClassModel {
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
        classTeacher: {
          select: { id: true, teacherCode: true, fullNameArabic: true, specialization: true },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classList.map((c) => ({
      ...c,
      currentStudentCount: c._count.students,
    }));
  }

  static async findById(id) {
    const cls = await prisma.class.findUnique({
      where: { id },
      include: {
        classTeacher: true,
        assignedTeachers: true,
        students: true,
        _count: {
          select: { students: true },
        },
      },
    });

    if (!cls) return null;

    return {
      ...cls,
      currentStudentCount: cls._count.students,
    };
  }

  static async create(data) {
    return prisma.class.create({
      data: {
        name: data.name,
        displayNameArabic: data.displayNameArabic || data.name,
        gradeLevel: data.gradeLevel,
        roomNumber: data.roomNumber || null,
        capacity: Number(data.capacity) || 40,
        classTeacherId: data.classTeacherId || null,
      },
      include: {
        classTeacher: true,
      },
    });
  }

  static async update(id, data) {
    const allowed = ['name', 'displayNameArabic', 'gradeLevel', 'roomNumber', 'capacity', 'classTeacherId'];
    const updateData = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = key === 'capacity' ? Number(data[key]) : data[key];
      }
    }

    return prisma.class.update({
      where: { id },
      data: updateData,
      include: {
        classTeacher: true,
      },
    });
  }

  static async delete(id) {
    await prisma.class.delete({
      where: { id },
    });
    return true;
  }
}

export default ClassModel;
