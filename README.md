# Blosm Backend API

Node.js + MongoDB backend for Blosm Hair & Beauty salon website.

## Setup

1. Install MongoDB locally or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

2. Install and run:
```bash
cd Backend
npm install
cp .env.example .env
# Edit .env - set DATABASE_URL (e.g. mongodb://localhost:27017/blosm)
npm run db:seed
npm run dev
```

Server runs at `http://localhost:3001`

## API Endpoints

### Auth
- `POST /api/auth/send-otp` - Send OTP to mobile
- `POST /api/auth/verify-otp` - Verify OTP & get JWT token

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments/my` - My appointments (requires auth)

### Admin
- `GET /api/admin/users` - List users (requires auth)
- `GET /api/admin/appointments` - List appointments (requires auth)
- `PATCH /api/admin/appointments/:id/status` - Update status (requires auth)
