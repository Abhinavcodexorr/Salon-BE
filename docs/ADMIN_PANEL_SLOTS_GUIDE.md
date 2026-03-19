# Admin Panel – Slots & Availability Guide

Guidance for the admin panel team to support time slots and service availability.

---

## 1. Service Form Changes

### When **Adding** or **Editing** a service, add these fields:

| Field | Type | Label | Example | Notes |
|-------|------|-------|---------|-------|
| **duration** | number (minutes) | Duration | 30, 60, 90 | How long the service takes |
| **availableFrom** | time (HH:MM) | Available from | 09:00 | Start of availability window |
| **availableTo** | time (HH:MM) | Available to | 18:00 | End of availability window |

### API Payload Examples

**Create Service (POST /api/v1/admin/services):**
```json
{
  "title": "Hair Styling",
  "description": "Expert hair styling services...",
  "items": ["Cut & Styling", "Coloring", "Keratin"],
  "image": "https://...",
  "alt": "Hair styling",
  "duration": 60,
  "availableFrom": "09:00",
  "availableTo": "18:00"
}
```

**Update Service (PATCH /api/v1/admin/services/:id):**
```json
{
  "duration": 45,
  "availableFrom": "10:00",
  "availableTo": "19:00"
}
```

### Defaults (if not sent)
- **duration:** 30 minutes  
- **availableFrom:** 09:00  
- **availableTo:** 18:00  

---

## 2. Service Listing – Show New Fields

In the admin services list/table, show:

- **Duration** – e.g. "60 mins", "30 mins"  
- **Availability** – e.g. "9:00 AM – 6:00 PM"

**API:** `GET /api/v1/admin/services`  
Each service now includes: `duration`, `availableFrom`, `availableTo`.

---

## 3. Slot Interval

- Slots are in **30-minute** steps (9:00, 9:30, 10:00, …).
- The website booking flow uses these slots.
- Admins define the **window** (availableFrom, availableTo).  
  The backend calculates slots inside that window.

---

## 4. What the Website Does

1. User selects a **service** and **date**.
2. Website calls:  
   `GET /api/v1/appointments/available-slots?date=2025-03-25&serviceId=xxx`
3. Backend returns available slots for that service and date.
4. User picks a slot and books.

Admin panel does **not** book directly; it manages services and availability. Booking is on the website.

---

## 5. Summary for Admin Panel

| Action | Changes |
|--------|---------|
| **Add Service** | Add `duration`, `availableFrom`, `availableTo` fields |
| **Edit Service** | Include `duration`, `availableFrom`, `availableTo` in the form |
| **Service List** | Display duration and availability |
| **Booking** | Not needed in admin; handled on website |

---

## 6. API Reference (Admin)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/services` | List services (includes duration, availability) |
| GET | `/api/v1/admin/services/:id` | Get one service (includes duration, availability) |
| POST | `/api/v1/admin/services` | Create service (send duration, availableFrom, availableTo) |
| PATCH | `/api/v1/admin/services/:id` | Update service (can update duration, availableFrom, availableTo) |

---

## 7. UI Suggestions

**Add Service Form:**
```
Duration (minutes): [30] [60] [90] or input
Available from:     [09:00]
Available to:       [18:00]
```

**Edit Service:** Same fields, pre-filled from existing service.

**Service Table:** Extra columns: "Duration" and "Available (From–To)".
