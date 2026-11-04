import fs from 'fs';
import path from 'path';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

/**
 * Uploaded files live on the server's disk under env.UPLOAD_DIR; the database keeps only their key
 * (the path inside that folder, e.g. "curricula/1730000000000-ab12cd34.pdf").
 */

/** The file's full path, refusing any key that would leave the uploads folder. */
export const storagePath = (key) => {
  const full = path.resolve(env.UPLOAD_DIR, key);
  if (!full.startsWith(env.UPLOAD_DIR + path.sep)) {
    throw AppError.badRequest('مسار ملف غير صالح');
  }
  return full;
};

/** The key of a file multer just wrote into the uploads folder. */
export const storageKey = (file) => path.relative(env.UPLOAD_DIR, file.path).split(path.sep).join('/');

/** Removes stored files; a file already gone is not an error (best effort, never throws). */
export const removeStoredFiles = async (keys) => {
  await Promise.all(
    keys.filter(Boolean).map(async (key) => {
      try {
        await fs.promises.unlink(storagePath(key));
      } catch (error) {
        if (error.code !== 'ENOENT') console.error('[Storage] Could not remove', key, error.message);
      }
    })
  );
};

/** Streams a stored file as a download, under its original (possibly Arabic) name. */
export const sendStoredFile = (res, { key, name, type }) => {
  const full = storagePath(key);
  if (!fs.existsSync(full)) {
    throw AppError.notFound('الملف غير موجود على الخادم');
  }
  const asciiName = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  res.setHeader('Content-Type', type || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
  );
  res.setHeader('Cache-Control', 'private, no-store');
  // Streamed, so a 20MB file never sits in memory
  fs.createReadStream(full)
    .on('error', (error) => {
      console.error('[Storage] Could not read', key, error.message);
      res.destroy(error);
    })
    .pipe(res);
};
