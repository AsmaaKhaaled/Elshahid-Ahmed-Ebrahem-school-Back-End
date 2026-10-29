import { prisma } from '../../config/database.js';

export class SubjectModel {
  static async findAll({ gradeLevel, search } = {}) {
    const where = {};

    if (gradeLevel) {
      where.gradeLevel = { contains: gradeLevel, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { nameArabic: { contains: search, mode: 'insensitive' } },
        { nameEnglish: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.subject.findMany({
      where,
      include: {
        teachers: {
          select: { id: true, teacherCode: true, fullNameArabic: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  static async findById(id) {
    return prisma.subject.findUnique({
      where: { id },
      include: {
        teachers: true,
      },
    });
  }

  static async findByCode(code) {
    return prisma.subject.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        teachers: true,
      },
    });
  }

  static async create(data) {
    return prisma.subject.create({
      data: {
        code: data.code.toUpperCase(),
        nameArabic: data.nameArabic,
        nameEnglish: data.nameEnglish || null,
        gradeLevel: data.gradeLevel,
        maxMarks: Number(data.maxMarks) || 100,
        passMarks: Number(data.passMarks) || 50,
      },
    });
  }

  static async update(id, data) {
    const updateData = { ...data };
    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    return prisma.subject.update({
      where: { id },
      data: updateData,
    });
  }

  static async delete(id) {
    await prisma.subject.delete({
      where: { id },
    });
    return true;
  }
}

export default SubjectModel;
