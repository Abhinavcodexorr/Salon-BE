# Salon Backend – API Routes & cURL Reference

**Base URL:** `http://localhost:3001/api/v1` (or `http://localhost:PORT/api/v1`)

---

## Response Structure

All APIs return a consistent production-level structure.

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERR_BAD_REQUEST",
    "message": "Human readable error message"
  }
}
```

---

## Route Overview

### Admin Panel APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/services` | No | List all services |
| POST | `/api/v1/admin/services` | No | Create service |
| PATCH | `/api/v1/admin/services/:id` | No | Update service |
| PATCH | `/api/v1/admin/services/:id/status` | No | Activate/deactivate service |
| DELETE | `/api/v1/admin/services/:id` | No | Delete service |
| GET | `/api/v1/admin/users` | Bearer token | List users (paginated, searchable) |
| GET | `/api/v1/admin/appointments` | Bearer token | List appointments (paginated, filterable) |
| PATCH | `/api/v1/admin/appointments/:id/status` | Bearer token | Update appointment status |
| POST | `/api/v1/services/seed` | No | Seed services |

### Website (Customer) APIs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/send-otp` | No | Send OTP to phone |
| POST | `/api/v1/auth/verify-otp` | No | Verify OTP & get JWT |
| GET | `/api/v1/users/me` | Yes | Get current user profile + wallet |
| GET | `/api/v1/services` | No | List services |
| GET | `/api/v1/services/titles` | No | List service titles for dropdown |
| POST | `/api/v1/appointments` | Optional | Create appointment |
| GET | `/api/v1/appointments/my` | Yes | Get my appointments |

---

## Health Check

```bash
curl --request GET "http://localhost:3001/health"
```

Response: `{ "success": true, "data": { "status": "ok" } }`

---

# Admin Panel – cURL Examples

### 1. Get Services (no auth)

```bash
curl --request GET "http://localhost:3001/api/v1/admin/services"
```

### 2. Get Users (paginated, searchable) – requires token

```bash
curl --request GET "http://localhost:3001/api/v1/admin/users?page=1&limit=20&search=john" \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

First get a token via: `POST /api/v1/auth/verify-otp`

### 3. Get Appointments (paginated, filterable)

```bash
curl --request GET "http://localhost:3001/api/v1/admin/appointments?page=1&limit=20&status=pending&search=john" \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

Query params: `page`, `limit`, `status` (pending|confirmed|completed|cancelled), `search`

### 4. Update Appointment Status

```bash
curl --request PATCH "http://localhost:3001/api/v1/admin/appointments/APPOINTMENT_ID_HERE/status" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer YOUR_TOKEN_HERE" \
  --data-raw '{"status": "confirmed"}'
```

### 5. Create Service (Admin)

```bash
curl --request POST "http://localhost:3001/api/v1/admin/services" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "title": "Hair Styling",
    "description": "Indulge in our expert hair styling services tailored to enhance your natural beauty and confidence.",
    "items": ["Cut & Styling", "Coloring & Highlights", "Keratin Treatments", "Bridal Hair"],
    "image": "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=85",
    "alt": "Hair styling at Blosm"
  }'
```

### 6. Update Service

```bash
curl --request PATCH "http://localhost:3001/api/v1/admin/services/SERVICE_ID" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "title": "Hair Styling",
    "description": "Updated description.",
    "items": ["Cut", "Coloring"],
    "image": "https://example.com/image.jpg",
    "alt": "Updated alt"
  }'
```

### 7. Activate / Deactivate Service

```bash
# Activate
curl --request PATCH "http://localhost:3001/api/v1/admin/services/SERVICE_ID/status" \
  --header "Content-Type: application/json" \
  --data-raw '{"isActive": true}'

# Deactivate
curl --request PATCH "http://localhost:3001/api/v1/admin/services/SERVICE_ID/status" \
  --header "Content-Type: application/json" \
  --data-raw '{"isActive": false}'
```

### 8. Delete Service

```bash
curl --request DELETE "http://localhost:3001/api/v1/admin/services/SERVICE_ID"
```

### 9. Seed Services

```bash
curl --request POST "http://localhost:3001/api/v1/services/seed" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "services": [
      {
        "title": "Hair Styling",
        "description": "Indulge in our expert hair styling services tailored to enhance your natural beauty and confidence.",
        "items": ["Cut & Styling", "Coloring & Highlights", "Keratin Treatments", "Bridal Hair"],
        "image": "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=85",
        "alt": "Hair styling at Blosm"
      }
    ]
  }'
```

---

# Website (Customer) – cURL Examples

### 1. Send OTP

```bash
curl --request POST "http://localhost:3001/api/v1/auth/send-otp" \
  --header "Content-Type: application/json" \
  --data-raw '{"mobile": "410123456", "countryCode": "+61"}'
```

### 2. Verify OTP & Login

```bash
curl --request POST "http://localhost:3001/api/v1/auth/verify-otp" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "mobile": "410123456",
    "countryCode": "+61",
    "otp": "123456"
  }'
```

Response: `{ "success": true, "data": { "token": "...", "user": { ... } }, "message": "Login successful" }`

### 3. Get Current User (Profile + Wallet)

```bash
curl --request GET "http://localhost:3001/api/v1/users/me" \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Get Services

```bash
curl --request GET "http://localhost:3001/api/v1/services"
```

### 5. Get Service Titles (for dropdown)

```bash
curl --request GET "http://localhost:3001/api/v1/services/titles"
```

### 6. Create Appointment (auth optional)

```bash
curl --request POST "http://localhost:3001/api/v1/appointments" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "410123456",
    "countryCode": "+61",
    "service": "Hair Styling",
    "date": "2025-03-25",
    "time": "10:00",
    "notes": "First visit"
  }'
```

### 7. Get My Appointments (auth required)

```bash
curl --request GET "http://localhost:3001/api/v1/appointments/my" \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Postman Import

1. Import `Salon-Backend.postman_collection.json`
2. Set `baseUrl` = `http://localhost:3001` (paths include `/api/v1/`)
3. After **Verify OTP**, `data.token` is used for auth
4. Set collection variable `token` from `data.token` (Tests tab auto-sets it)
