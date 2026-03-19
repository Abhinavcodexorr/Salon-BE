# Salon Backend – API Routes

**Base URL:** `http://localhost:4002` (or your `PORT`)

**API Prefix:** `/api/v1`

---

## Services Module (Clean)

### Website – Public listing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/services` | **Website listing** – only active, not deleted |

### Admin – Full CRUD
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/services` | List all (active + inactive) |
| GET | `/api/v1/admin/services/:id` | Get service by ID |
| POST | `/api/v1/admin/services` | Add/Create service |
| PATCH | `/api/v1/admin/services/:id` | Update service (incl. isActive) |
| DELETE | `/api/v1/admin/services/:id` | Delete service |
| POST | `/api/v1/admin/services/seed` | Seed services (bulk) |

---

## Other Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/v1/auth/send-otp` | No | Send OTP |
| POST | `/api/v1/auth/verify-otp` | No | Verify OTP & get JWT |
| GET | `/api/v1/users/me` | Bearer | Get user profile |
| POST | `/api/v1/appointments` | Optional | Create appointment |
| GET | `/api/v1/appointments/my` | Bearer | My appointments |
| POST | `/api/v1/upload/image` | No | Upload image to S3 |
| POST | `/api/v1/admin/login` | No | Admin login |
| POST | `/api/v1/admin/logout` | No | Admin logout |
| GET | `/api/v1/admin/users` | Superadmin | List users |
| GET | `/api/v1/admin/appointments` | Superadmin | List appointments |
| PATCH | `/api/v1/admin/appointments/:id/status` | Superadmin | Update appointment status |

---

## Response Format

**Success:** `{ "success": true, "data": {...}, "message": "..." }`  
**Error:** `{ "success": false, "error": { "code": "...", "message": "..." } }`
