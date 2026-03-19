# Salon Backend – API Routes

**Base URL:** `http://localhost:4002` (or your `PORT`)

**API Prefix:** `/api/v1`

---

## All Routes

| Method | Endpoint | Auth | Module | Description |
|--------|----------|------|--------|-------------|
| GET | `/health` | No | - | Health check |
| POST | `/api/v1/auth/send-otp` | No | auth | Send OTP to phone |
| POST | `/api/v1/auth/verify-otp` | No | auth | Verify OTP & get JWT |
| GET | `/api/v1/users/me` | Bearer | users | Get current user profile |
| GET | `/api/v1/services` | No | services | List services |
| GET | `/api/v1/services/titles` | No | services | List service titles (dropdown) |
| POST | `/api/v1/services` | No | services | Create service |
| POST | `/api/v1/services/seed` | No | services | Seed services |
| POST | `/api/v1/appointments` | Optional | appointments | Create appointment |
| GET | `/api/v1/appointments/my` | Bearer | appointments | Get my appointments |
| POST | `/api/v1/upload/image` | No | upload | Upload image to S3, returns URL |
| GET | `/api/v1/admin/services` | No | admin | List services (all/active/deactivated) |
| GET | `/api/v1/admin/services/:id` | No | admin | Get service by ID |
| POST | `/api/v1/admin/services` | No | admin | Create service |
| PATCH | `/api/v1/admin/services/:id` | No | admin | Update service |
| PATCH | `/api/v1/admin/services/:id/status` | No | admin | Activate/deactivate service |
| DELETE | `/api/v1/admin/services/:id` | No | admin | Delete service |
| GET | `/api/v1/admin/users` | Bearer | admin | List users (paginated) |
| GET | `/api/v1/admin/appointments` | Bearer | admin | List appointments (paginated) |
| PATCH | `/api/v1/admin/appointments/:id/status` | Bearer | admin | Update appointment status |

---

## Response Format

**Success:** `{ "success": true, "data": {...}, "message": "..." }`  
**Error:** `{ "success": false, "error": { "code": "...", "message": "..." } }`

---

## Postman Import

1. **Import** → Upload `Salon-Backend.postman_collection.json`
2. Collection variables: `baseUrl` = `http://localhost:4002`, `token` (auto-set after Verify OTP)
3. Ready to use
