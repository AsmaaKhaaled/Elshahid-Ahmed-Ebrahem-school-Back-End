import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { swaggerSpec } from './docs/swagger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { ApiResponse } from './shared/utils/api-response.js';
import { generalApiLimiter } from './middlewares/rate-limit.middleware.js';

// Import Active MVP Module Routers
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import studentsRoutes from './modules/students/students.routes.js';
import teachersRoutes from './modules/teachers/teachers.routes.js';
import classesRoutes from './modules/classes/classes.routes.js';
import subjectsRoutes from './modules/subjects/subjects.routes.js';
import timetableRoutes from './modules/timetable/timetable.routes.js';
import schedulesRoutes from './modules/schedules/schedules.routes.js';
import materialsRoutes from './modules/materials/materials.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import gradesRoutes from './modules/grades/grades.routes.js';
import announcementsRoutes from './modules/announcements/announcements.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import teacherAttendanceRoutes from './modules/teacher-attendance/teacher-attendance.routes.js';
import curriculaRoutes from './modules/curricula/curricula.routes.js';
import assignmentsRoutes from './modules/assignments/assignments.routes.js';
import honorRollRoutes from './modules/honor-roll/honor-roll.routes.js';
import homeContentRoutes from './modules/home-content/home-content.routes.js';
import academicYearRoutes from './modules/academic-year/academic-year.routes.js';

const app = express();

// API Documentation (available only in non-production environments)
if (!env.isProduction) {
  app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { swaggerOptions: { persistAuthorization: true } }));
}



// Security and utility middlewares
app.use(helmet());
app.use('/api/', generalApiLimiter);
// CLIENT_URL may hold several comma-separated origins.
// In development, any localhost port is allowed (ng serve may pick a random port).
const allowedOrigins = env.CLIENT_URL.split(',').map((origin) => origin.trim());
const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        allowedOrigins.includes(origin) ||
        (env.NODE_ENV === 'development' && localhostPattern.test(origin));
      callback(null, allowed);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
        'teacher-attendance',
        'curricula',
        'assignments',
        'honor-roll',
        'home-content',
        'academic-year',
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
app.use(`${API_PREFIX}/timetable`, schedulesRoutes);
app.use(`${API_PREFIX}/schedules`, schedulesRoutes);
app.use(`${API_PREFIX}/materials`, materialsRoutes);
app.use(`${API_PREFIX}/attendance`, attendanceRoutes);
app.use(`${API_PREFIX}/grades`, gradesRoutes);
app.use(`${API_PREFIX}/announcements`, announcementsRoutes);
app.use(`${API_PREFIX}/teacher-attendance`, teacherAttendanceRoutes);
app.use(`${API_PREFIX}/curricula`, curriculaRoutes);
app.use(`${API_PREFIX}/assignments`, assignmentsRoutes);
app.use(`${API_PREFIX}/honor-roll`, honorRollRoutes);
app.use(`${API_PREFIX}/home-content`, homeContentRoutes);
app.use(`${API_PREFIX}/academic-year`, academicYearRoutes);
app.use(`${API_PREFIX}/admin/admins`, adminRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralized Global Error Handler
app.use(errorHandler);

export default app;
