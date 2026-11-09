import { prisma } from '../../config/database.js';
import { DEFAULT_PRINCIPAL_CONTENT } from './home-content.constants.js';

export class HomeContentService {
  /**
   * Get Full Home Content
   */
  static async getHomeContent() {
    const principal = await this.getPrincipalWord();
    return {
      principal,
    };
  }

  /**
   * ① Get Principal Word (Public)
   * Returns current principal word or creates and returns the default.
   */
  static async getPrincipalWord() {
    const record = await prisma.homeContent.findUnique({
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
    const created = await prisma.homeContent.create({
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

    const result = await prisma.homeContent.upsert({
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
}

export default HomeContentService;

