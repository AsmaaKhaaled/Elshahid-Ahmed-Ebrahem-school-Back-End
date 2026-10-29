import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { ApiResponse } from './shared/utils/api-response.js';

// Import Active MVP Module Routers
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import studentsRoutes from './modules/students/students.routes.js';
import teachersRoutes from './modules/teachers/teachers.routes.js';
import classesRoutes from './modules/classes/classes.routes.js';
import subjectsRoutes from './modules/subjects/subjects.routes.js';
import timetableRoutes from './modules/timetable/timetable.routes.js';
import materialsRoutes from './modules/materials/materials.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import gradesRoutes from './modules/grades/grades.routes.js';
import announcementsRoutes from './modules/announcements/announcements.routes.js';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL || '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root and Health Check
app.get('/', (req, res) => {
  return ApiResponse.success(res, {
    message: 'Welcome to Elshahid Ahmed Ebrahem School Management System API',
    data: {
      status: 'online',
      version: '1.0.0',
      activeModules: [
        'auth',
        'users',
        'students',
        'teachers',
        'classes',
        'subjects',
        'timetable',
        'materials',
        'attendance',
        'grades',
        'announcements',
      ],
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/api/health', (req, res) => {
  return ApiResponse.success(res, {
    message: 'System is healthy',
    data: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
  });
});

// API Routes Mounting (v1)
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/students`, studentsRoutes);
app.use(`${API_PREFIX}/teachers`, teachersRoutes);
app.use(`${API_PREFIX}/classes`, classesRoutes);
app.use(`${API_PREFIX}/subjects`, subjectsRoutes);
app.use(`${API_PREFIX}/timetable`, timetableRoutes);
app.use(`${API_PREFIX}/materials`, materialsRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/grades`, gradesRoutes);
app.use(`${API_PREFIX}/announcements`, announcementsRoutes);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

export default app;
