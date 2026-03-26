# Admin Panel – Slots & Availability Guide

Guidance for the admin panel team: **duration is per service**; **booking hours are salon-wide** (same window for every service).

---

## 1. Service form (add / edit)

| Field | Type | Notes |
|-------|------|--------|
| **duration** | number (minutes) | How long the service takes — used for slot length and overlap |
| **price** | number | Service price |

Do **not** send per-service `availableFrom` / `availableTo` — those are removed from the API.

### API payload example

**POST /api/v1/admin/services**
```json
{
  "title": "Hair Styling",
  "description": "…",
  "items": ["Cut & Styling"],
  "duration": 60,
  "price": 49
}
```

---

## 2. Salon opening hours (backend config)

Slot grid for **all** services uses one window, set on the server:

| Env variable | Example | Meaning |
|----------------|---------|--------|
| `SALON_AVAILABLE_FROM` | `09:00` | First possible slot start (HH:mm) |
| `SALON_AVAILABLE_TO` | `18:00` | End of day (last slot must end before this) |

Defaults: `09:00` → `18:00`. Slot step: **30 minutes** (`src/config/slots.js`).

Change hours by updating **`.env`** on the API host and restarting — not the admin service form.

---

## 3. Website flow

1. User picks **service** and **date**.
2. `GET /api/v1/appointments/available-slots?date=YYYY-MM-DD&serviceId=<id>`
3. Backend uses **salon window** + that service’s **duration** + existing bookings to return open times.
4. User books with `time` set to one of those slots.

---

## 4. Admin API (services)

| Method | Endpoint | Notes |
|--------|----------|--------|
| GET | `/api/v1/admin/services` | List services (`duration`, `price`, no per-service hours) |
| PATCH | `/api/v1/admin/services/:id` | Update `duration`, `price`, etc. |

---

## 5. UI suggestions

- **Service form:** duration (minutes), price; remove “available from / to” if you had them.
- **Settings / docs for ops:** mention that salon hours are env-based on the API server.
