import { prisma } from '../../config/database.js';
import { ClassModel } from './classes.model.js';
import { AppError } from '../../shared/errors/app-error.js';
import { GRADES, STANDARD_CLASSES } from '../teachers/teachers.service.js';

export const MAX_CLASS_CAPACITY = 50;
export const MAX_SECTIONS_PER_GRADE = 10;
const DEFAULT_CAPACITY = 40;

// "2/3" -> { grade: 2, section: 3 }
const parseName = (name) => {
  const match = /^(\d+)\/(\d+)$/.exec(name);
  return match ? { grade: Number(match[1]), section: Number(match[2]) } : null;
};

export class ClassesService {
  /**
   * How many classes each grade has this year and their capacity (max students per class):
   * [{ grade: 1, sections: 4, capacity: 45 }, ...]. Before anything is saved, the standard 4 classes per grade.
   */
  static async getStructure() {
    const classes = await prisma.class.findMany({ where: { isActive: true }, select: { name: true, capacity: true } });
    return GRADES.map(({ number }) => {
      const own = classes.filter((cls) => parseName(cls.name)?.grade === number);
      if (!classes.length) {
        return { grade: number, sections: STANDARD_CLASSES.filter((cls) => cls.name.startsWith(`${number}/`)).length, capacity: DEFAULT_CAPACITY };
      }
      return {
        grade: number,
        sections: own.length,
        capacity: own.length ? Math.max(...own.map((cls) => cls.capacity)) : DEFAULT_CAPACITY,
      };
    });
  }

  /**
   * Sets each grade's classes to "<grade>/1".."<grade>/<sections>" with the given capacity.
   * A class that is no longer needed is deactivated (its history stays), but only once it has no students.
   */
  static async saveStructure({ grades }) {
    const existing = await prisma.class.findMany({
      select: { id: true, name: true, isActive: true, _count: { select: { students: { where: { isActive: true } } } } },
    });

    const blocked = [];
    const toDeactivate = [];
    for (const { grade, sections } of grades) {
      for (const cls of existing) {
        const parsed = parseName(cls.name);
        if (!cls.isActive || parsed?.grade !== grade || parsed.section <= sections) continue;
        if (cls._count.students > 0) blocked.push(`${cls.name} (${cls._count.students} طالب)`);
        else toDeactivate.push(cls.id);
      }
    }
    if (blocked.length) {
      throw AppError.badRequest(`لا يمكن تقليل عدد الفصول لوجود طلاب في: ${blocked.join('، ')}. انقلهم إلى فصل آخر أولًا`);
    }

    await prisma.$transaction([
      ...grades.flatMap(({ grade, sections, capacity }) => {
        const info = GRADES.find((g) => g.number === grade);
        return Array.from({ length: sections }, (_, i) => {
          const name = `${grade}/${i + 1}`;
          return prisma.class.upsert({
            where: { name },
            update: { isActive: true, capacity },
            create: {
              name,
              gradeLevel: info.level,
              displayNameArabic: `${info.label} - فصل ${name}`,
              roomNumber: `${grade}${String(i + 1).padStart(2, '0')}`,
              capacity,
            },
          });
        });
      }),
      prisma.class.updateMany({ where: { id: { in: toDeactivate } }, data: { isActive: false } }),
    ]);
    return this.getStructure();
  }

  static async getClasses(query) {
    return ClassModel.findAll(query);
  }

  static async getClassById(id) {
    const cls = await ClassModel.findById(id);
    if (!cls) {
      throw AppError.notFound(`Class with id '${id}' not found`);
    }
    return cls;
  }

  static async createClass(data) {
    return ClassModel.create(data);
  }

  static async updateClass(id, data) {
    const updated = await ClassModel.update(id, data);
    if (!updated) {
      throw AppError.notFound(`Class with id '${id}' not found`);
    }
    return updated;
  }

  static async deleteClass(id) {
    const deleted = await ClassModel.delete(id);
    if (!deleted) {
      throw AppError.notFound(`Class with id '${id}' not found`);
    }
    return true;
  }
}

export default ClassesService;

