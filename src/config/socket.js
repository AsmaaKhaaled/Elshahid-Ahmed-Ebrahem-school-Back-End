import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import { prisma } from './database.js';

let io = null;

/**
 * Initialize Socket.io instance with HTTP Server
 * @param {import('http').Server} httpServer
 */
export const initSocket = (httpServer) => {
  const allowedOrigins = env.CLIENT_URL.split(',').map((origin) => origin.trim());
  const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const allowed =
          !origin ||
          allowedOrigins.includes(origin) ||
          (env.NODE_ENV === 'development' && localhostPattern.test(origin));
        callback(null, allowed);
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization;

      if (!authHeader) {
        // Allow unauthenticated guest connection (e.g., visitors viewing public announcements)
        socket.user = { role: 'GUEST', id: null };
        return next();
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

      if (!token) {
        socket.user = { role: 'GUEST', id: null };
        return next();
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        socket.user = { role: 'GUEST', id: null };
        return next();
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          role: true,
          fullName: true,
          status: true,
          studentProfile: { select: { id: true, classId: true } },
          teacherProfile: { select: { id: true } },
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        socket.user = { role: 'GUEST', id: null };
        return next();
      }

      socket.user = user;
      return next();
    } catch (err) {
      // If token expired or invalid, treat as guest rather than abruptly dropping connection
      socket.user = { role: 'GUEST', id: null };
      return next();
    }
  });

  // Socket Connection Handlers
  io.on('connection', (socket) => {
    const user = socket.user || { role: 'GUEST' };

    // 1. Join role-based room
    const roleRoom = `role_${user.role}`;
    socket.join(roleRoom);

    // 2. Join personal user room if logged in
    if (user.id) {
      socket.join(`user_${user.id}`);
    }

    // 3. Join student class room if student
    if (user.studentProfile?.classId) {
      socket.join(`class_${user.studentProfile.classId}`);
    }

    // 4. Join all-users broadcast room
    socket.join('school_wide');

    // Handle mark as read event from socket if sent via websocket
    socket.on('announcement:mark_read', async (data) => {
      try {
        if (!user.id || !data?.announcementId) return;
        await prisma.announcementRead.upsert({
          where: {
            unique_announcement_user_read: {
              announcementId: data.announcementId,
              userId: user.id,
            },
          },
          update: { readAt: new Date() },
          create: {
            announcementId: data.announcementId,
            userId: user.id,
          },
        });

        // Notify this user's sessions of updated read state
        io.to(`user_${user.id}`).emit('announcement:read_confirmed', {
          announcementId: data.announcementId,
          userId: user.id,
        });
      } catch (e) {
        // ignore socket mark_read errors
      }
    });
  });

  return io;
};

/**
 * Get active socket instance
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Please call initSocket first.');
  }
  return io;
};

/**
 * Broadcast announcement in real-time according to target audience
 * @param {Object} announcement
 */
export const broadcastAnnouncement = (announcement) => {
  if (!io) return;

  const audiences = Array.isArray(announcement.audiences)
    ? announcement.audiences
    : ['TEACHER', 'STUDENT', 'PARENT'];

  const targetRooms = new Set();

  // Always notify Admins so their dashboard updates instantly
  targetRooms.add('role_ADMIN');
  targetRooms.add('role_SUPER_ADMIN');

  if (audiences.includes('TEACHER')) {
    targetRooms.add('role_TEACHER');
  }

  if (audiences.includes('STUDENT')) {
    targetRooms.add('role_STUDENT');
  }

  if (audiences.includes('PARENT') || audiences.includes('ALL')) {
    targetRooms.add('role_PARENT');
    targetRooms.add('role_GUEST');
  }

  const notificationPayload = {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    category: announcement.category,
    audiences: announcement.audiences,
    author: announcement.authorName || 'إدارة المدرسة',
    publishedAt: announcement.createdAt || new Date().toISOString(),
    expiresAt: announcement.expiresAt,
    pinned: announcement.pinned,
    attachment: announcement.attachmentUrl
      ? { name: announcement.attachmentName || 'ملف مرفق', url: announcement.attachmentUrl }
      : undefined,
  };

  // Broadcast to all relevant rooms
  for (const room of targetRooms) {
    io.to(room).emit('announcement:new', notificationPayload);
    io.to(room).emit('notification:new', {
      type: 'ANNOUNCEMENT',
      title: announcement.title,
      message: announcement.content,
      category: announcement.category,
      announcementId: announcement.id,
      timestamp: new Date().toISOString(),
    });
  }
};

export default {
  initSocket,
  getIO,
  broadcastAnnouncement,
};

