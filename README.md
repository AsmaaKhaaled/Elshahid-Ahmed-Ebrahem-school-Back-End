# Elshahid Ahmed Ebrahem School Management System - Backend API (MVP)
### مدرسة الشهيد أحمد إبراهيم - سلوا

A modular, production-ready Node.js RESTful API designed with **Pure JavaScript (ES Modules)** and a **Modular Layered Architecture**.

---

## 🏗 Modular Layered Architecture

Each module under `src/modules/` adheres strictly to the 5-layer architecture:
```
Routes ──► Validation ──► Controller ──► Service ──► Model
```

- **Routes (`<module>.routes.js`)**: Endpoints, HTTP verbs, and middleware bindings.
- **Validation (`<module>.validation.js`)**: Request body, query, and parameter validation rules.
- **Controller (`<module>.controller.js`)**: HTTP controllers returning standard `ApiResponse`.
- **Service (`<module>.service.js`)**: Pure business logic and operations.
- **Model (`<module>.model.js`)**: Entity schemas and data access methods.

---

## 📁 Active MVP Modules

```
src/
├── config/
│   ├── env.js                      # Environment configuration
│   └── database.js                 # Database connection manager
├── middlewares/
│   ├── auth.middleware.js          # JWT Bearer token authentication
│   ├── role.middleware.js          # RBAC (ADMIN, TEACHER, STUDENT, PARENT)
│   ├── validate.middleware.js      # Request validation middleware
│   └── error.middleware.js         # Centralized error & 404 handler
├── shared/
│   ├── errors/
│   │   └── app-error.js            # Custom AppError class
│   └── utils/
│       ├── api-response.js         # Standard API response utility
│       └── token.util.js           # JWT sign/verify helpers
├── modules/
│   ├── auth/                       # Login & Token generation for Admin, Teacher, Student
│   ├── users/                      # Core identity, /me profile & password changes
│   ├── students/                   # Student profiles, class enrollment, Excel bulk-import & card generation
│   ├── teachers/                   # Teacher profiles & assigned subjects/classes
│   ├── classes/                    # Classrooms management (e.g. 1/A, 1/B)
│   ├── subjects/                   # Curriculum subjects list (Math, Science/Biology, Arabic, etc.)
│   ├── timetable/                  # Weekly schedule per class & teacher
│   ├── materials/                  # PDF curriculum uploads & monthly lesson plans
│   ├── attendance/                 # Daily attendance recording & attendance rate calculation
│   ├── grades/                     # Exam schedule announcement & manual marks recording
│   └── announcements/              # School-wide trips/events by Admin + class notes by Teachers
├── app.js                          # Express app configuration & mounted v1 routes
└── server.js                       # Server entry point & graceful shutdown
```

---

## 📡 API Endpoints Overview (`/api/v1`)

| Module | Base Path | Key Endpoints & Capabilities |
|---|---|---|
| **Auth** | `/api/v1/auth` | `/login`, `/register`, `/refresh-token` |
| **Users** | `/api/v1/users` | `/me` (profile), `/me/change-password`, user administration |
| **Students** | `/api/v1/students` | `/bulk-import` (Excel array), `/:id/card` (ID card), `/:id/enroll` |
| **Teachers** | `/api/v1/teachers` | `/:id/subjects` (assign subjects), `/:id/classes` (assign classes) |
| **Classes** | `/api/v1/classes` | Classrooms management (1/A, 1/B), capacity, room assignment |
| **Subjects** | `/api/v1/subjects` | Courses, passing & maximum marks (Biology, Math, Arabic, etc.) |
| **Timetable** | `/api/v1/timetable` | Weekly schedule, `/class/:classId`, `/teacher/:teacherId` |
| **Materials** | `/api/v1/materials` | Curriculum PDF uploads, monthly lesson plans, syllabus |
| **Attendance** | `/api/v1/attendance` | `/daily-class` (batch recording), `/rate/student/:id`, `/rate/class/:id` |
| **Grades** | `/api/v1/grades` | `/exams` (schedules), `/bulk` (class marks), `student/:id/report-card` |
| **Announcements** | `/api/v1/announcements` | `SCHOOL_WIDE` trips/events (Admin) & `CLASS_NOTE` (Teachers) |

---

## 🚀 Running the Project

```bash
# Start in development mode with native Node watch:
npm run dev

# Start in production mode:
npm start
```
