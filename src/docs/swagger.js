import { env } from '../config/env.js';
import { SYSTEM_PERMISSIONS } from '../modules/admin/admin.validation.js';

/**
 * OpenAPI 3.0 specification for the School Management System API.
 * Served by swagger-ui-express at /api/docs (see app.js).
 * Request bodies mirror the rules in each module's *.validation.js file.
 */

// ---------- Helpers ----------
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const jsonBody = (schema, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});
const idParam = (name = 'id', description = 'Resource ID') => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
});
const queryParam = (name, description, schema = { type: 'string' }) => ({
  name,
  in: 'query',
  required: false,
  description,
  schema,
});

const standardResponses = {
  200: { description: 'Success', content: { 'application/json': { schema: ref('SuccessResponse') } } },
  401: { description: 'Missing or invalid token', content: { 'application/json': { schema: ref('ErrorResponse') } } },
  403: { description: 'Role not allowed', content: { 'application/json': { schema: ref('ErrorResponse') } } },
  404: { description: 'Not found', content: { 'application/json': { schema: ref('ErrorResponse') } } },
  422: { description: 'Validation failed', content: { 'application/json': { schema: ref('ErrorResponse') } } },
};
const responses = (...codes) =>
  Object.fromEntries(codes.map((code) => [code, standardResponses[code]]));

const roles = (...list) => `**Roles:** ${list.join(', ')}`;

/**
 * Builds the standard CRUD paths for a resource.
 * `access` maps each operation to the roles allowed (from the module's routes file).
 */
const crud = ({ tag, base, name, createSchema, updateSchema, access, listQuery = [] }) => ({
  [base]: {
    get: {
      tags: [tag],
      summary: `List ${name}s`,
      description: roles(...access.list),
      parameters: listQuery,
      responses: responses(200, 401, 403),
    },
    post: {
      tags: [tag],
      summary: `Create ${name}`,
      description: roles(...access.create),
      requestBody: jsonBody(ref(createSchema)),
      responses: { 201: { description: 'Created' }, ...responses(401, 403, 422) },
    },
  },
  [`${base}/{id}`]: {
    parameters: [idParam()],
    get: {
      tags: [tag],
      summary: `Get ${name} by ID`,
      description: roles(...access.get),
      responses: responses(200, 401, 403, 404),
    },
    put: {
      tags: [tag],
      summary: `Update ${name}`,
      description: roles(...access.update),
      requestBody: jsonBody(ref(updateSchema)),
      responses: responses(200, 401, 403, 404, 422),
    },
    delete: {
      tags: [tag],
      summary: `Delete ${name}`,
      description: roles(...access.remove),
      responses: responses(200, 401, 403, 404),
    },
  },
});

const ALL = ['Any authenticated user'];
const ADMIN = ['ADMIN'];
const ADMIN_TEACHER = ['ADMIN', 'TEACHER'];

// ---------- Schemas ----------
const schemas = {
  SuccessResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'success' },
      message: { type: 'string' },
      data: {},
    },
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      status: { type: 'string', example: 'fail' },
      message: { type: 'string', example: 'Validation failed' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: { field: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },

  // Auth
  LoginRequest: {
    type: 'object',
    required: ['identifier', 'password'],
    properties: {
      identifier: { type: 'string', description: 'Email, Student Code, or National ID', example: 'admin@school.com' },
      password: { type: 'string', format: 'password', example: 'Admin@2026' },
    },
  },
  SetInitialPasswordRequest: {
    type: 'object',
    required: ['newPassword', 'confirmPassword'],
    properties: {
      newPassword: {
        type: 'string',
        format: 'password',
        minLength: 8,
        description: 'At least 8 chars with letters and digits. Cannot be Student@2026 or Teacher@2026.',
      },
      confirmPassword: { type: 'string', format: 'password' },
    },
  },

  // Users
  CreateUser: {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
      name: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'password', minLength: 6 },
      role: { type: 'string', enum: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    },
  },
  UpdateUser: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2 },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    },
  },
  ChangePassword: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', format: 'password' },
      newPassword: { type: 'string', format: 'password', minLength: 6 },
    },
  },

  // Admins (Super Admin)
  CreateAdmin: {
    type: 'object',
    required: ['fullName', 'nationalId', 'password'],
    properties: {
      fullName: { type: 'string', minLength: 3 },
      nationalId: { type: 'string', pattern: '^\\d{14}$', example: '29801011234567' },
      password: { type: 'string', format: 'password', description: 'At least 8 chars with letters and digits' },
      permissions: { type: 'array', items: { type: 'string', enum: SYSTEM_PERMISSIONS } },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', pattern: '^01[0125]\\d{8}$', example: '01012345678' },
      jobTitle: { type: 'string' },
    },
  },
  UpdateAdmin: {
    type: 'object',
    description: 'Provide at least one field. Empty string clears email / phone.',
    properties: {
      fullName: { type: 'string', minLength: 3 },
      nationalId: { type: 'string', pattern: '^\\d{14}$' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', pattern: '^01[0125]\\d{8}$' },
      jobTitle: { type: 'string' },
    },
  },
  UpdatePermissions: {
    type: 'object',
    required: ['permissions'],
    properties: { permissions: { type: 'array', items: { type: 'string', enum: SYSTEM_PERMISSIONS } } },
  },
  UpdateAdminStatus: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] } },
  },
  ResetAdminPassword: {
    type: 'object',
    required: ['newPassword'],
    properties: { newPassword: { type: 'string', format: 'password', description: 'At least 8 chars with letters and digits' } },
  },

  // Students
  CreateStudent: {
    type: 'object',
    required: ['fullNameArabic'],
    properties: {
      fullNameArabic: { type: 'string', minLength: 3 },
      gender: { type: 'string', enum: ['MALE', 'FEMALE'] },
      guardianPhone: { type: 'string' },
    },
    additionalProperties: true,
  },
  UpdateStudent: {
    type: 'object',
    properties: {
      fullNameArabic: { type: 'string', minLength: 3 },
      gender: { type: 'string', enum: ['MALE', 'FEMALE'] },
    },
    additionalProperties: true,
  },
  EnrollStudent: {
    type: 'object',
    required: ['classId'],
    properties: { classId: { type: 'string' } },
  },
  BulkImportStudents: {
    type: 'object',
    required: ['students'],
    properties: { students: { type: 'array', minItems: 1, items: ref('CreateStudent') } },
  },

  // Teachers
  CreateTeacher: {
    type: 'object',
    required: ['fullNameArabic', 'specialization'],
    properties: {
      fullNameArabic: { type: 'string', minLength: 3 },
      specialization: { type: 'string' },
      phone: { type: 'string' },
    },
    additionalProperties: true,
  },
  UpdateTeacher: {
    type: 'object',
    properties: {
      fullNameArabic: { type: 'string', minLength: 3 },
      specialization: { type: 'string' },
    },
    additionalProperties: true,
  },
  AssignSubjects: {
    type: 'object',
    required: ['assignedSubjectIds'],
    properties: { assignedSubjectIds: { type: 'array', items: { type: 'string' } } },
  },
  AssignClasses: {
    type: 'object',
    required: ['assignedClassIds'],
    properties: { assignedClassIds: { type: 'array', items: { type: 'string' } } },
  },

  // Classes
  CreateClass: {
    type: 'object',
    required: ['name', 'gradeLevel'],
    properties: { name: { type: 'string' }, gradeLevel: { type: 'string' } },
    additionalProperties: true,
  },
  UpdateClass: {
    type: 'object',
    properties: { name: { type: 'string' }, gradeLevel: { type: 'string' } },
    additionalProperties: true,
  },

  // Subjects
  CreateSubject: {
    type: 'object',
    required: ['code', 'nameArabic', 'gradeLevel'],
    properties: { code: { type: 'string' }, nameArabic: { type: 'string' }, gradeLevel: { type: 'string' } },
    additionalProperties: true,
  },
  UpdateSubject: {
    type: 'object',
    properties: { nameArabic: { type: 'string' }, gradeLevel: { type: 'string' } },
    additionalProperties: true,
  },

  // Timetable
  CreateTimetableEntry: {
    type: 'object',
    required: ['dayOfWeek', 'periodNumber', 'startTime', 'endTime', 'classId', 'subjectId'],
    properties: {
      dayOfWeek: { type: 'string', enum: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] },
      periodNumber: { type: 'integer', example: 1 },
      startTime: { type: 'string', example: '08:00' },
      endTime: { type: 'string', example: '08:45' },
      classId: { type: 'string' },
      subjectId: { type: 'string' },
      teacherId: { type: 'string' },
    },
  },
  UpdateTimetableEntry: {
    type: 'object',
    properties: {
      dayOfWeek: { type: 'string', enum: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] },
      periodNumber: { type: 'integer' },
      startTime: { type: 'string' },
      endTime: { type: 'string' },
    },
    additionalProperties: true,
  },

  // Materials
  CreateMaterial: {
    type: 'object',
    required: ['title', 'subjectId', 'fileUrl'],
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['SYLLABUS_PDF', 'MONTHLY_PLAN', 'WORKSHEET', 'REFERENCE'] },
      subjectId: { type: 'string' },
      fileUrl: { type: 'string' },
    },
    additionalProperties: true,
  },
  UpdateMaterial: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['SYLLABUS_PDF', 'MONTHLY_PLAN', 'WORKSHEET', 'REFERENCE'] },
    },
    additionalProperties: true,
  },

  // Attendance
  RecordAttendance: {
    type: 'object',
    required: ['studentId', 'classId'],
    properties: {
      studentId: { type: 'string' },
      classId: { type: 'string' },
      status: { type: 'string', enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] },
      date: { type: 'string', format: 'date' },
      remarks: { type: 'string' },
    },
  },
  RecordDailyClassAttendance: {
    type: 'object',
    required: ['classId', 'records'],
    properties: {
      classId: { type: 'string' },
      date: { type: 'string', format: 'date', description: 'Defaults to today' },
      records: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['studentId'],
          properties: {
            studentId: { type: 'string' },
            status: { type: 'string', enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], default: 'PRESENT' },
            remarks: { type: 'string' },
          },
        },
      },
    },
  },
  UpdateAttendance: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] },
      remarks: { type: 'string' },
    },
  },

  // Grades & Exams
  CreateExam: {
    type: 'object',
    required: ['title', 'subjectId', 'classId', 'examDate'],
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['QUIZ', 'MIDTERM', 'FINAL', 'MONTHLY'] },
      subjectId: { type: 'string' },
      classId: { type: 'string' },
      examDate: { type: 'string', format: 'date-time' },
      maxScore: { type: 'number', example: 100 },
    },
  },
  UpdateExam: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      type: { type: 'string', enum: ['QUIZ', 'MIDTERM', 'FINAL', 'MONTHLY'] },
      examDate: { type: 'string', format: 'date-time' },
      maxScore: { type: 'number' },
    },
  },
  SubmitGrade: {
    type: 'object',
    required: ['studentId', 'examId', 'score'],
    properties: {
      studentId: { type: 'string' },
      examId: { type: 'string' },
      score: { type: 'number', minimum: 0 },
      remarks: { type: 'string' },
    },
  },
  RecordBulkMarks: {
    type: 'object',
    required: ['examId', 'marks'],
    properties: {
      examId: { type: 'string' },
      subjectId: { type: 'string', description: "Defaults to the exam's subject" },
      marks: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['studentId', 'score'],
          properties: {
            studentId: { type: 'string' },
            score: { type: 'number', minimum: 0 },
            maxScore: { type: 'number' },
            remarks: { type: 'string' },
          },
        },
      },
    },
  },
  UpdateGrade: {
    type: 'object',
    properties: { score: { type: 'number', minimum: 0 }, remarks: { type: 'string' } },
  },

  // Announcements
  CreateAnnouncement: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string' },
      content: { type: 'string' },
      type: { type: 'string', enum: ['SCHOOL_WIDE', 'CLASS_NOTE'] },
      classId: { type: 'string', description: 'Required when type is CLASS_NOTE' },
      targetAudience: { type: 'string', enum: ['ALL', 'TEACHERS', 'STUDENTS', 'PARENTS'] },
      priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
    },
  },
  UpdateAnnouncement: {
    type: 'object',
    properties: { title: { type: 'string' }, content: { type: 'string' } },
    additionalProperties: true,
  },
};

// ---------- Paths ----------
const paths = {
  '/api/health': {
    get: {
      tags: ['System'],
      summary: 'Health check',
      security: [],
      responses: responses(200),
    },
  },

  // Auth
  '/api/v1/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Unified login (Admin, Teacher, Student)',
      description:
        'Returns a standard `token`. On first login with a default password it returns a short-lived `tempToken` instead — use it for `/auth/set-initial-password`.',
      security: [],
      requestBody: jsonBody(ref('LoginRequest')),
      responses: { ...responses(200, 422), 401: { description: 'Invalid credentials' } },
    },
  },
  '/api/v1/auth/set-initial-password': {
    patch: {
      tags: ['Auth'],
      summary: 'Set initial password',
      description: 'Authorize with the **tempToken** returned from login (not the normal token).',
      requestBody: jsonBody(ref('SetInitialPasswordRequest')),
      responses: responses(200, 401, 403, 422),
    },
  },
  '/api/v1/auth/me': {
    get: { tags: ['Auth'], summary: 'Current authenticated user', responses: responses(200, 401) },
  },

  // Users
  '/api/v1/users/me': {
    get: { tags: ['Users'], summary: 'My profile', description: roles(...ALL), responses: responses(200, 401) },
  },
  '/api/v1/users/me/change-password': {
    patch: {
      tags: ['Users'],
      summary: 'Change my password',
      description: roles(...ALL),
      requestBody: jsonBody(ref('ChangePassword')),
      responses: responses(200, 401, 422),
    },
  },
  ...crud({
    tag: 'Users',
    base: '/api/v1/users',
    name: 'user',
    createSchema: 'CreateUser',
    updateSchema: 'UpdateUser',
    access: { list: ADMIN, get: ADMIN_TEACHER, create: ADMIN, update: ADMIN, remove: ADMIN },
  }),

  // Students
  ...crud({
    tag: 'Students',
    base: '/api/v1/students',
    name: 'student',
    createSchema: 'CreateStudent',
    updateSchema: 'UpdateStudent',
    access: {
      list: ADMIN_TEACHER,
      get: ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT'],
      create: ADMIN,
      update: ADMIN,
      remove: ADMIN,
    },
  }),
  '/api/v1/students/{id}/card': {
    get: {
      tags: ['Students'],
      summary: 'Generate student card',
      description: roles('ADMIN', 'TEACHER', 'PARENT', 'STUDENT'),
      parameters: [idParam()],
      responses: responses(200, 401, 403, 404),
    },
  },
  '/api/v1/students/bulk-import': {
    post: {
      tags: ['Students'],
      summary: 'Bulk import students',
      description: roles(...ADMIN),
      requestBody: jsonBody(ref('BulkImportStudents')),
      responses: { 201: { description: 'Imported' }, ...responses(401, 403, 422) },
    },
  },
  '/api/v1/students/{id}/enroll': {
    patch: {
      tags: ['Students'],
      summary: 'Enroll student in a class',
      description: roles(...ADMIN),
      parameters: [idParam()],
      requestBody: jsonBody(ref('EnrollStudent')),
      responses: responses(200, 401, 403, 404, 422),
    },
  },

  // Teachers
  ...crud({
    tag: 'Teachers',
    base: '/api/v1/teachers',
    name: 'teacher',
    createSchema: 'CreateTeacher',
    updateSchema: 'UpdateTeacher',
    access: {
      list: ADMIN_TEACHER,
      get: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'],
      create: ADMIN,
      update: ADMIN,
      remove: ADMIN,
    },
  }),
  '/api/v1/teachers/me/classes': {
    get: {
      tags: ['Teachers'],
      summary: "The signed-in teacher's classes (assigned by the admin)",
      description: `${roles('TEACHER')}\n\nEach class has \`studentCount\` and \`isAdvisor\`.`,
      responses: responses(200, 401, 403),
    },
  },
  '/api/v1/teachers/me/classes/{classId}/students': {
    get: {
      tags: ['Teachers'],
      summary: 'Students of one of my classes (paginated, A→Z)',
      description: `${roles('TEACHER')}\n\nReturns 404 when the class isn't one of the teacher's own.`,
      parameters: [
        idParam('classId', 'Class ID'),
        queryParam('page', 'Page number (default 1)', { type: 'integer', minimum: 1 }),
        queryParam('limit', 'Page size (default 20, max 100)', { type: 'integer', minimum: 1, maximum: 100 }),
        queryParam('search', 'Student name or code'),
      ],
      responses: responses(200, 401, 403, 404),
    },
  },
  '/api/v1/teachers/{id}/subjects': {
    patch: {
      tags: ['Teachers'],
      summary: 'Assign subjects to teacher',
      description: roles(...ADMIN),
      parameters: [idParam()],
      requestBody: jsonBody(ref('AssignSubjects')),
      responses: responses(200, 401, 403, 404, 422),
    },
  },
  '/api/v1/teachers/{id}/classes': {
    patch: {
      tags: ['Teachers'],
      summary: 'Assign classes to teacher',
      description: roles(...ADMIN),
      parameters: [idParam()],
      requestBody: jsonBody(ref('AssignClasses')),
      responses: responses(200, 401, 403, 404, 422),
    },
  },

  // Classes & Subjects
  ...crud({
    tag: 'Classes',
    base: '/api/v1/classes',
    name: 'class',
    createSchema: 'CreateClass',
    updateSchema: 'UpdateClass',
    access: { list: ALL, get: ALL, create: ADMIN, update: ADMIN, remove: ADMIN },
  }),
  ...crud({
    tag: 'Subjects',
    base: '/api/v1/subjects',
    name: 'subject',
    createSchema: 'CreateSubject',
    updateSchema: 'UpdateSubject',
    access: { list: ALL, get: ALL, create: ADMIN, update: ADMIN, remove: ADMIN },
  }),

  // Timetable
  ...crud({
    tag: 'Timetable',
    base: '/api/v1/timetable',
    name: 'timetable entry',
    createSchema: 'CreateTimetableEntry',
    updateSchema: 'UpdateTimetableEntry',
    access: { list: ALL, get: ALL, create: ADMIN, update: ADMIN, remove: ADMIN },
  }),
  '/api/v1/timetable/class/{classId}': {
    get: {
      tags: ['Timetable'],
      summary: 'Timetable for a class',
      description: roles(...ALL),
      parameters: [idParam('classId', 'Class ID')],
      responses: responses(200, 401, 404),
    },
  },
  '/api/v1/timetable/teacher/{teacherId}': {
    get: {
      tags: ['Timetable'],
      summary: 'Timetable for a teacher',
      description: roles(...ALL),
      parameters: [idParam('teacherId', 'Teacher ID')],
      responses: responses(200, 401, 404),
    },
  },

  // Materials
  ...crud({
    tag: 'Materials',
    base: '/api/v1/materials',
    name: 'material',
    createSchema: 'CreateMaterial',
    updateSchema: 'UpdateMaterial',
    access: { list: ALL, get: ALL, create: ADMIN_TEACHER, update: ADMIN_TEACHER, remove: ADMIN_TEACHER },
    listQuery: [
      queryParam('page', 'Page number (default 1)', { type: 'integer', minimum: 1 }),
      queryParam('limit', 'Page size (default 20, max 100)', { type: 'integer', minimum: 1, maximum: 100 }),
      queryParam('subjectId', 'Subject ID'),
      queryParam('classId', 'Class ID (also returns materials for every class)'),
      queryParam('search', 'Title or description'),
    ],
  }),

  // Curricula (المناهج والمواد الدراسية)
  '/api/v1/curricula': {
    get: {
      tags: ['Curricula'],
      summary: 'Curricula I may see (paginated, most recently updated first)',
      description: `${roles('TEACHER', 'ADMIN', 'SUPER_ADMIN', 'STUDENT')}\n\nA teacher gets their own (plus \`startedSubjects\`), the administration every teacher's, a student their class's (student files only).`,
      parameters: [
        queryParam('page', 'Page number (default 1)', { type: 'integer', minimum: 1 }),
        queryParam('limit', 'Page size (default 15, max 100)', { type: 'integer', minimum: 1, maximum: 100 }),
        queryParam('search', 'Subject, description or teacher name'),
        queryParam('gradeId', 'G1 | G2 | G3'),
        queryParam('subject', 'Subject (Arabic name)'),
        queryParam('teacherId', 'Teacher ID (administration only)'),
      ],
      responses: responses(200, 401, 403, 422),
    },
    post: {
      tags: ['Curricula'],
      summary: 'Start the curriculum of one of my subjects for one grade',
      description: `${roles('TEACHER')}\n\nThe subject must be one the teacher teaches and the classes their own. One per subject & grade (409).`,
      requestBody: jsonBody({
        type: 'object',
        required: ['subject', 'gradeId', 'sections'],
        properties: {
          subject: { type: 'string', example: 'الرياضيات' },
          gradeId: { type: 'string', enum: ['G1', 'G2', 'G3'] },
          sections: { type: 'array', items: { type: 'string' }, example: ['3/2', '3/3'] },
          description: { type: 'string' },
        },
      }),
      responses: responses(201, 400, 401, 403, 409, 422),
    },
  },
  '/api/v1/curricula/{id}': {
    get: {
      tags: ['Curricula'],
      summary: 'One curriculum: its plan and how many files of each kind (files are paged apart)',
      parameters: [idParam()],
      responses: responses(200, 401, 403, 404),
    },
    put: {
      tags: ['Curricula'],
      summary: 'Edit my curriculum',
      description: roles('TEACHER'),
      parameters: [idParam()],
      responses: responses(200, 400, 401, 403, 404, 409, 422),
    },
    delete: {
      tags: ['Curricula'],
      summary: 'Delete my curriculum, its files and plan',
      description: roles('TEACHER'),
      parameters: [idParam()],
      responses: responses(200, 401, 403, 404),
    },
  },
  '/api/v1/curricula/{id}/files': {
    get: {
      tags: ['Curricula'],
      summary: "A curriculum's files & links (paginated, newest first)",
      parameters: [
        idParam(),
        queryParam('page', 'Page number (default 1)', { type: 'integer', minimum: 1 }),
        queryParam('limit', 'Page size (default 15, max 100)', { type: 'integer', minimum: 1, maximum: 100 }),
        queryParam('kind', 'BOOK | PLAN | EXAMS | GUIDE | OTHER'),
      ],
      responses: responses(200, 401, 403, 404, 422),
    },
    post: {
      tags: ['Curricula'],
      summary: 'Upload a file (max 20MB) or add a link',
      description: `${roles('TEACHER')}\n\nmultipart/form-data: \`kind\`, \`title\`, \`forStudents\` ("false" = teacher only), and \`file\` or \`link\`.`,
      parameters: [idParam()],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['kind', 'title'],
              properties: {
                kind: { type: 'string', enum: ['BOOK', 'PLAN', 'EXAMS', 'GUIDE', 'OTHER'] },
                title: { type: 'string' },
                forStudents: { type: 'boolean' },
                link: { type: 'string', format: 'uri' },
                file: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
      responses: responses(201, 400, 401, 403, 404, 422),
    },
  },
  '/api/v1/curricula/{id}/files/{fileId}': {
    delete: {
      tags: ['Curricula'],
      summary: 'Delete a file or link of my curriculum',
      description: roles('TEACHER'),
      parameters: [idParam(), idParam('fileId', 'File ID')],
      responses: responses(200, 401, 403, 404),
    },
  },
  '/api/v1/curricula/{id}/files/{fileId}/download': {
    get: {
      tags: ['Curricula'],
      summary: 'Download an uploaded file (students: student files of their class only)',
      parameters: [idParam(), idParam('fileId', 'File ID')],
      responses: responses(200, 401, 403, 404),
    },
  },
  '/api/v1/curricula/{id}/plan': {
    put: {
      tags: ['Curricula'],
      summary: 'Replace the plan & objectives (week 1, 2, 3... in order, max 60)',
      description: roles('TEACHER'),
      parameters: [idParam()],
      requestBody: jsonBody({
        type: 'object',
        properties: {
          weeks: {
            type: 'array',
            items: {
              type: 'object',
              properties: { topic: { type: 'string' }, objectives: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
      }),
      responses: responses(200, 401, 403, 404, 422),
    },
  },
  '/api/v1/curricula/{id}/plan-file': {
    get: {
      tags: ['Curricula'],
      summary: "Download the teacher's plan document (teacher & administration)",
      parameters: [idParam()],
      responses: responses(200, 401, 403, 404),
    },
    put: {
      tags: ['Curricula'],
      summary: 'Upload (replace) my plan document — multipart `file`, max 20MB',
      description: roles('TEACHER'),
      parameters: [idParam()],
      responses: responses(200, 400, 401, 403, 404, 422),
    },
    delete: {
      tags: ['Curricula'],
      summary: 'Remove my plan document',
      description: roles('TEACHER'),
      parameters: [idParam()],
      responses: responses(200, 401, 403, 404),
    },
  },

  // Attendance
  ...crud({
    tag: 'Attendance',
    base: '/api/v1/attendance',
    name: 'attendance record',
    createSchema: 'RecordAttendance',
    updateSchema: 'UpdateAttendance',
    access: {
      list: ADMIN_TEACHER,
      get: ['ADMIN', 'TEACHER', 'PARENT', 'STUDENT'],
      create: ADMIN_TEACHER,
      update: ADMIN_TEACHER,
      remove: ADMIN,
    },
  }),
  '/api/v1/attendance/daily-class': {
    post: {
      tags: ['Attendance'],
      summary: 'Record daily attendance for a whole class',
      description: roles(...ADMIN_TEACHER),
      requestBody: jsonBody(ref('RecordDailyClassAttendance')),
      responses: { 201: { description: 'Recorded' }, ...responses(401, 403, 422) },
    },
  },
  '/api/v1/attendance/rate/student/{studentId}': {
    get: {
      tags: ['Attendance'],
      summary: 'Attendance rate for a student',
      description: roles(...ALL),
      parameters: [idParam('studentId', 'Student ID')],
      responses: responses(200, 401, 404),
    },
  },
  '/api/v1/attendance/rate/class/{classId}': {
    get: {
      tags: ['Attendance'],
      summary: 'Attendance rate for a class',
      description: roles(...ALL),
      parameters: [idParam('classId', 'Class ID'), queryParam('date', 'Day (YYYY-MM-DD)', { type: 'string', format: 'date' })],
      responses: responses(200, 401, 404),
    },
  },

  // Grades & Exams
  ...crud({
    tag: 'Exams',
    base: '/api/v1/grades/exams',
    name: 'exam',
    createSchema: 'CreateExam',
    updateSchema: 'UpdateExam',
    access: { list: ALL, get: ALL, create: ADMIN_TEACHER, update: ADMIN_TEACHER, remove: ADMIN },
  }),
  ...crud({
    tag: 'Grades',
    base: '/api/v1/grades',
    name: 'grade',
    createSchema: 'SubmitGrade',
    updateSchema: 'UpdateGrade',
    access: { list: ALL, get: ALL, create: ADMIN_TEACHER, update: ADMIN_TEACHER, remove: ADMIN },
  }),
  '/api/v1/grades/bulk': {
    post: {
      tags: ['Grades'],
      summary: 'Record marks in bulk for an exam',
      description: roles(...ADMIN_TEACHER),
      requestBody: jsonBody(ref('RecordBulkMarks')),
      responses: { 201: { description: 'Recorded' }, ...responses(401, 403, 422) },
    },
  },
  '/api/v1/grades/student/{studentId}/report-card': {
    get: {
      tags: ['Grades'],
      summary: 'Student report card',
      description: roles(...ALL),
      parameters: [idParam('studentId', 'Student ID')],
      responses: responses(200, 401, 404),
    },
  },

  // Announcements
  ...crud({
    tag: 'Announcements',
    base: '/api/v1/announcements',
    name: 'announcement',
    createSchema: 'CreateAnnouncement',
    updateSchema: 'UpdateAnnouncement',
    access: { list: ALL, get: ALL, create: ADMIN_TEACHER, update: ADMIN_TEACHER, remove: ADMIN_TEACHER },
  }),

  // Admins (Super Admin only) — also reachable under /api/v1/admin/admins
  '/api/v1/admin': {
    get: {
      tags: ['Admins'],
      summary: 'List admins',
      description: roles('SUPER_ADMIN'),
      responses: responses(200, 401, 403),
    },
    post: {
      tags: ['Admins'],
      summary: 'Create admin',
      description: roles('SUPER_ADMIN'),
      requestBody: jsonBody(ref('CreateAdmin')),
      responses: { 201: { description: 'Created' }, ...responses(401, 403, 422) },
    },
  },
  '/api/v1/admin/{id}': {
    parameters: [idParam()],
    get: {
      tags: ['Admins'],
      summary: 'Get admin by ID',
      description: roles('SUPER_ADMIN'),
      responses: responses(200, 401, 403, 404),
    },
    patch: {
      tags: ['Admins'],
      summary: 'Update admin profile',
      description: roles('SUPER_ADMIN'),
      requestBody: jsonBody(ref('UpdateAdmin')),
      responses: responses(200, 401, 403, 404, 422),
    },
    delete: {
      tags: ['Admins'],
      summary: 'Delete admin',
      description: roles('SUPER_ADMIN'),
      responses: responses(200, 401, 403, 404),
    },
  },
  '/api/v1/admin/{id}/permissions': {
    patch: {
      tags: ['Admins'],
      summary: 'Update admin permissions',
      description: roles('SUPER_ADMIN'),
      parameters: [idParam()],
      requestBody: jsonBody(ref('UpdatePermissions')),
      responses: responses(200, 401, 403, 404, 422),
    },
  },
  '/api/v1/admin/{id}/status': {
    patch: {
      tags: ['Admins'],
      summary: 'Activate / suspend admin',
      description: roles('SUPER_ADMIN'),
      parameters: [idParam()],
      requestBody: jsonBody(ref('UpdateAdminStatus')),
      responses: responses(200, 401, 403, 404, 422),
    },
  },
  '/api/v1/admin/{id}/reset-password': {
    patch: {
      tags: ['Admins'],
      summary: 'Reset admin password',
      description: roles('SUPER_ADMIN'),
      parameters: [idParam()],
      requestBody: jsonBody(ref('ResetAdminPassword')),
      responses: responses(200, 401, 403, 404, 422),
    },
  },
};

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Elshahid Ahmed Ebrahem School Management System API',
    version: '1.0.0',
    description:
      'Login via **POST /api/v1/auth/login**, copy the `token` from the response, then click **Authorize** and paste it.',
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local development' }],
  tags: [
    'System',
    'Auth',
    'Users',
    'Admins',
    'Students',
    'Teachers',
    'Classes',
    'Subjects',
    'Timetable',
    'Materials',
    'Curricula',
    'Attendance',
    'Exams',
    'Grades',
    'Announcements',
  ].map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
  },
  security: [{ bearerAuth: [] }],
  paths,
};

export default swaggerSpec;
