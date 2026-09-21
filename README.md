# Co-working Space Desk & Room Booking System

Full-stack booking platform: members book desks / meeting rooms per time slot, admins manage inventory, approve or reject requests, and overlapping bookings are impossible even under simultaneous requests.

**Stack:** Node.js + Express + MongoDB (Mongoose) · React (Vite) + Axios · JWT access + refresh tokens · Docker Compose.

---

## 1. Quick start (Docker — one command)

```bash
cp backend/.env.example backend/.env
docker-compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:5000/api
- Swagger docs: http://localhost:5000/api/docs
- DB is seeded automatically on boot.

**Demo logins**

| Role   | Email               | Password  |
|--------|---------------------|-----------|
| Admin  | admin@cowork.com    | admin123  |
| Member | member@cowork.com   | member123 |

## 2. Manual run (no Docker)

```bash
# MongoDB must be running locally on 27017
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
cd ../frontend && cp .env.example .env && npm install && npm run dev
```

---

## 3. Roles & features

**Visitor** – browse spaces with search (name), filters (type, min capacity, date availability), pagination, space detail page, hourly availability calendar per date.

**Member** – register / login (JWT), request a booking for date + start/end time, view own bookings by status, cancel own pending/approved future bookings.

**Admin** – space CRUD, maintenance block-outs, all bookings with status/date/space filters, approve or reject pending requests. Approving one booking auto-rejects every other pending booking that overlaps it.

---

## 4. Concurrency: no double booking

Two members pressing "book" on the same slot at the same millisecond must not both succeed. The write path is serialized per space:

1. `withLock("space:<id>")` (`src/utils/lock.js`) inserts a document into the `locks` collection whose `key` carries a **unique index**. MongoDB guarantees only one concurrent insert wins (error 11000); the loser retries with backoff or gets `409 LOCK_TIMEOUT`.
2. Inside the lock we run the overlap query
   `startAt < newEnd AND endAt > newStart AND status IN (pending, approved)`
   backed by the compound index `{ space, startAt, endAt, status }`.
3. Only if no conflict exists is the booking inserted; the lock is released in a `finally` block and also expires via a TTL index, so a crashed process cannot deadlock the space.

The same lock protects admin approval, so a slot can never end up with two approved bookings.

Why a lock collection instead of a Mongo transaction: transactions require a replica set, which would force reviewers into extra setup. This approach is transactionally safe on a plain standalone `mongo:7` container. If you deploy on a replica set, the lock can be swapped for a `session.withTransaction()` block without touching the route logic.

### Try it

```bash
# fire 5 identical bookings at once -> exactly one 201, rest 409
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:5000/api/bookings \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"spaceId":"<SPACE_ID>","date":"2026-10-01","start":"14:00","end":"15:00"}' \
    -o /dev/null -w "%{http_code}\n" &
done; wait
```

---

## 5. Auth design

- Access token: short-lived (`ACCESS_TOKEN_TTL`, default 15m), sent as `Authorization: Bearer`.
- Refresh token: 7 days, persisted in the `refreshtokens` collection with a TTL index, **rotated** on every `/auth/refresh` (the used token is revoked). Revoked or unknown tokens are rejected.
- `/auth/logout` revokes the refresh token.
- The Axios interceptor auto-refreshes on a `401 TOKEN_EXPIRED` and replays the original request once.
- Role-based guards: `protect` + `authorize('admin')`.

## 6. API

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | public (rate limited 10/15min) |
| POST | `/api/auth/login` | public (rate limited 10/15min) |
| POST | `/api/auth/refresh` · `/api/auth/logout` | public |
| GET | `/api/auth/me` | authed |
| GET | `/api/spaces` | public — `search, type, minCapacity, date, onlyAvailable, page, limit` |
| GET | `/api/spaces/:id` | public |
| GET | `/api/spaces/:id/availability?date=YYYY-MM-DD` | public |
| POST / PUT / DELETE | `/api/spaces` · `/api/spaces/:id` | admin |
| POST | `/api/spaces/:id/maintenance` | admin |
| POST | `/api/bookings` | member |
| GET | `/api/bookings/my` | member |
| PATCH | `/api/bookings/:id/cancel` | owner / admin |
| GET | `/api/bookings` — `status, date, spaceId, from, to, page, limit` | admin |
| PATCH | `/api/bookings/:id/approve` · `/reject` | admin |

Swagger UI: `/api/docs`. Postman collection: `postman_collection.json` (import, run **Login** first — it stores the token automatically).

### Error shape (every failure)

```json
{ "success": false,
  "error": { "code": "CONFLICT", "message": "This slot overlaps an existing booking or maintenance window",
             "details": { "conflictWith": { "start": "...", "end": "...", "status": "approved" } } } }
```

Success shape: `{ "success": true, "data": ..., "meta": { page, limit, total, totalPages } }`.

## 7. Validation rules

`express-validator` on every write endpoint: valid ObjectIds, `date=YYYY-MM-DD`, `HH:mm` times, email format, password ≥ 6 chars, capacity ≥ 1. Business rules in the route: end must be after start, past-dated slots rejected, bookings capped at 12 hours, inactive/missing spaces rejected, cancellation limited to future pending/approved bookings.

## 8. Indexes

`users.email` (unique) · `spaces {type, capacity, isActive}` + text index on name/description · `bookings {space, startAt, endAt, status}` (overlap queries), `{status, date}` (admin filters), `{user, startAt}` (member dashboard) · TTL indexes on `refreshtokens.expiresAt` and `locks.expiresAt`.

## 9. Project structure

```
backend/src
  config/db.js
  models/     User Space Booking RefreshToken Lock
  middleware/ auth  validate  rateLimit  error
  routes/     auth  spaces  bookings
  utils/      lock  time  ApiError  asyncHandler  notify
  swagger.json  app.js  server.js  seed.js
frontend/src
  api/        client.js (axios + refresh interceptor)  auth.jsx
  pages/      Spaces  SpaceDetail  Login  Register  MyBookings  AdminDashboard
  App.jsx  styles.css
docker-compose.yml  postman_collection.json
```

## 10. Notes / trade-offs

- Times are stored as UTC `Date` values built from `date + HH:mm`; the UI renders the same UTC window, so slots stay consistent across machines. A production build would add a per-space timezone field.
- Notifications are a console stub (`utils/notify.js`) fired on create / approve / reject / cancel — drop in nodemailer to make it real.
- Rate limiting: 10 requests / 15 min on login & register, 200 / min on the rest of the API.
