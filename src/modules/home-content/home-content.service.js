import { prisma } from '../../config/database.js';
import { AppError } from '../../shared/errors/app-error.js';
import { DEFAULT_PRINCIPAL_CONTENT, DEFAULT_GALLERY_SLIDES } from './home-content.constants.js';

export class HomeContentService {
  /**
   * Get Full Home Content
   */
  static async getHomeContent() {
    const [principal, slides] = await Promise.all([
      this.getPrincipalWord(),
      this.getGallerySlides({ includeHidden: false }),
    ]);

    return {
      principal,
      slides,
    };
  }

  /**
   * ① Get Principal Word (Public)
   * Returns current principal word or creates and returns the default.
   */
  static async getPrincipalWord() {
    const record = await prisma.homePrincipal.findUnique({
      where: { key: 'principal_word' },
    });

    if (record) {
      return {
        name: record.name,
        title: record.title,
        photoUrl: record.photoUrl,
        message: record.message,
        updatedAt: record.updatedAt,
      };
    }

    // Initialize with default content if not yet seeded
    const created = await prisma.homePrincipal.create({
      data: {
        key: 'principal_word',
        name: DEFAULT_PRINCIPAL_CONTENT.name,
        title: DEFAULT_PRINCIPAL_CONTENT.title,
        photoUrl: DEFAULT_PRINCIPAL_CONTENT.photoUrl,
        message: DEFAULT_PRINCIPAL_CONTENT.message,
      },
    });

    return {
      name: created.name,
      title: created.title,
      photoUrl: created.photoUrl,
      message: created.message,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * ② Update Principal Word (Admin Only)
   * @param {Object} data
   * @param {string} [userId]
   */
  static async updatePrincipalWord(data, userId = null) {
    let normalizedMessage = [];

    if (Array.isArray(data.message)) {
      normalizedMessage = data.message
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => p.length > 0);
    } else if (typeof data.message === 'string') {
      normalizedMessage = data.message
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    const photoUrl =
      data.photoUrl !== undefined && data.photoUrl !== null && data.photoUrl.trim().length > 0
        ? data.photoUrl.trim()
        : null;

    const result = await prisma.homePrincipal.upsert({
      where: { key: 'principal_word' },
      update: {
        name: data.name.trim(),
        title: data.title.trim(),
        photoUrl,
        message: normalizedMessage,
        updatedBy: userId,
      },
      create: {
        key: 'principal_word',
        name: data.name.trim(),
        title: data.title.trim(),
        photoUrl,
        message: normalizedMessage,
        updatedBy: userId,
      },
    });

    return {
      name: result.name,
      title: result.title,
      photoUrl: result.photoUrl,
      message: result.message,
      updatedAt: result.updatedAt,
    };
  }

  // ==========================================
  // School Gallery Slides (صور أنشطة المدرسة)
  // ==========================================

  /**
   * Helper to resolve a slide by its DB id or fallback legacy/mock id (e.g. 'slide-1', 'slide-2')
   * @param {string} id
   */
  static async findSlideById(id) {
    if (!id || typeof id !== 'string') return null;

    // 1. Direct match by DB ID
    let slide = await prisma.homeGallerySlide.findUnique({ where: { id } });
    if (slide) return slide;

    // 2. Legacy/mock id fallback (e.g. 'slide-1', 'slide-2')
    if (id.startsWith('slide-')) {
      const orderNum = parseInt(id.replace('slide-', ''), 10);
      const defaultTitles = [
        'الأنشطة الطلابية',
        'الأنشطة الرياضية',
        'المعامل والتجارب العلمية',
        'الأنشطة الفنية والمسرحية',
        'حفلات التكريم والتفوق',
      ];
      const fallbackTitle = defaultTitles[orderNum - 1];

      // Try title first
      if (fallbackTitle) {
        slide = await prisma.homeGallerySlide.findFirst({
          where: { title: { contains: fallbackTitle } },
        });
        if (slide) return slide;
      }

      // Try order
      if (!isNaN(orderNum)) {
        slide = await prisma.homeGallerySlide.findFirst({
          where: { order: orderNum },
        });
        if (slide) return slide;
      }
    }

    return null;
  }

  /**
   * ① Get Gallery Slides (Public & Admin)
   * @param {Object} [options]
   * @param {boolean|string} [options.includeHidden=false]
   */
  static async getGallerySlides({ includeHidden = false } = {}) {
    // 1. Auto-seed if table is empty
    const count = await prisma.homeGallerySlide.count();
    if (count === 0) {
      await prisma.homeGallerySlide.createMany({
        data: DEFAULT_GALLERY_SLIDES.map((slide) => ({
          title: slide.title,
          caption: slide.caption,
          src: slide.src,
          order: slide.order,
          hidden: slide.hidden,
        })),
      });
    }

    // 2. Build filter
    const showAll = includeHidden === true || includeHidden === 'true';
    const where = showAll ? {} : { hidden: false };

    // 3. Fetch ordered slides
    return prisma.homeGallerySlide.findMany({
      where,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        caption: true,
        src: true,
        order: true,
        hidden: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * ② Create Gallery Slide (Admin Only)
   * @param {Object} data
   * @param {string} [userId]
   */
  static async createGallerySlide(data, userId = null) {
    const maxOrderRecord = await prisma.homeGallerySlide.aggregate({
      _max: { order: true },
    });
    const nextOrder = (maxOrderRecord._max.order ?? 0) + 1;

    return prisma.homeGallerySlide.create({
      data: {
        title: data.title.trim(),
        caption: data.caption ? data.caption.trim() : null,
        src: data.src.trim(),
        order: nextOrder,
        hidden: Boolean(data.hidden),
        createdBy: userId,
        updatedBy: userId,
      },
      select: {
        id: true,
        title: true,
        caption: true,
        src: true,
        order: true,
        hidden: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * ③ Update Gallery Slide (Admin Only)
   * @param {string} id
   * @param {Object} data
   * @param {string} [userId]
   */
  static async updateGallerySlide(id, data, userId = null) {
    let existing = await this.findSlideById(id);

    // If it doesn't exist by ID or legacy lookup, create it so user never loses work!
    if (!existing) {
      return this.createGallerySlide(data, userId);
    }

    const updateData = { updatedBy: userId };

    if (data.title !== undefined) {
      updateData.title = data.title.trim();
    }
    if (data.caption !== undefined) {
      updateData.caption = data.caption ? data.caption.trim() : null;
    }
    if (data.src !== undefined) {
      updateData.src = data.src.trim();
    }
    if (data.hidden !== undefined) {
      updateData.hidden = Boolean(data.hidden);
    }
    if (data.order !== undefined) {
      updateData.order = data.order;
    }

    return prisma.homeGallerySlide.update({
      where: { id: existing.id },
      data: updateData,
      select: {
        id: true,
        title: true,
        caption: true,
        src: true,
        order: true,
        hidden: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * ④ Toggle Hidden Status (Admin Only)
   * @param {string} id
   * @param {string} [userId]
   */
  static async toggleHidden(id, userId = null) {
    const existing = await this.findSlideById(id);
    if (!existing) {
      throw AppError.notFound('صورة النشاط غير موجودة');
    }

    const updated = await prisma.homeGallerySlide.update({
      where: { id: existing.id },
      data: {
        hidden: !existing.hidden,
        updatedBy: userId,
      },
      select: {
        id: true,
        hidden: true,
      },
    });

    return updated;
  }

  /**
   * ⑤ Reorder Slides (Admin Only)
   * @param {string[]} slideIds
   * @param {string} [userId]
   */
  static async reorderGallerySlides(slideIds, userId = null) {
    if (!Array.isArray(slideIds) || slideIds.length === 0) {
      throw AppError.badRequest('قائمة المعرفات slideIds مطلوبة');
    }

    for (let index = 0; index < slideIds.length; index++) {
      const id = slideIds[index];
      const slide = await this.findSlideById(id);
      if (slide) {
        await prisma.homeGallerySlide.update({
          where: { id: slide.id },
          data: {
            order: index + 1,
            updatedBy: userId,
          },
        });
      }
    }

    return { success: true };
  }

  /**
   * ⑥ Delete Gallery Slide (Admin Only)
   * @param {string} id
   */
  static async deleteGallerySlide(id) {
    const existing = await this.findSlideById(id);
    if (!existing) {
      return { id };
    }

    await prisma.homeGallerySlide.delete({ where: { id: existing.id } });
    return { id: existing.id };
  }
}

export default HomeContentService;

