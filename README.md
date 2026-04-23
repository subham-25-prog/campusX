# JISphere Backend (Twitter/X-style for JIS Group)

## App Name Suggestions
1. `JISphere` (recommended, implemented in this backend)
2. `JIS Pulse`
3. `JIS ConnectX`
4. `JIS Loop`
5. `Campus JIS`

## What You Now Have
- Full Node.js + TypeScript backend API.
- PostgreSQL database schema with Prisma.
- JWT auth + refresh session management.
- Social features: post, reply, like, repost, bookmark, follow.
- Notifications system.
- Chat system with REST + Socket.IO realtime events.
- Receipt-based verification flow (PDF/image upload + admin approval/rejection).
- Institutes API for login dropdown population.
- Trending hashtags.
- Your existing frontend is kept unchanged and served from `public/campusx.html`.

## Project Structure
- `public/campusx.html`: your unchanged frontend.
- `src/server.ts`: server entry + Socket.IO bootstrap.
- `src/app.ts`: middleware + API + static frontend serving.
- `src/routes/*.routes.ts`: feature routes.
- `src/socket/index.ts`: realtime chat events.
- `prisma/schema.prisma`: full database design.
- `prisma/seed.ts`: institute list + demo users/posts.

## Local Setup
1. Copy environment file:
   - `copy .env.example .env` (PowerShell)
2. Start PostgreSQL:
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`
4. Generate Prisma client:
   - `npm run prisma:generate`
5. Run migrations:
   - `npm run prisma:migrate -- --name init`
6. Seed data:
   - `npm run prisma:seed`
7. Start app:
   - `npm run dev`

Frontend URL:
- `http://localhost:4000`

API base:
- `http://localhost:4000/api`

## Publish (Recommended: Render)
1. Push this folder to a new GitHub repository.
2. Create a new **PostgreSQL** database on Render.
3. Create a new **Web Service** on Render from your GitHub repo.
4. Set Build Command:
   - `npm install && npm run prisma:generate && npm run build`
5. Set Start Command:
   - `npm run prisma:deploy && npm run start`
6. Add environment variables in Render:
   - `NODE_ENV=production`
   - `PORT=10000` (or leave Render default)
   - `DATABASE_URL=<from render postgres connection string>`
   - `JWT_ACCESS_SECRET=<long random secret>`
   - `JWT_REFRESH_SECRET=<long random secret>`
   - `ACCESS_TOKEN_TTL=15m`
   - `REFRESH_TOKEN_TTL_DAYS=30`
   - `CORS_ORIGIN=*` (or your final domain URL)
7. Deploy and open your Render URL.

## Publish Notes
- `uploads/` is local disk storage. On many cloud platforms this can be temporary.
- For long-term production uploads, switch receipt files to cloud storage (Cloudinary/S3/R2).

## Seed Login (after seeding)
- Email: `admin@jisphere.app`
- Password: `Password@123`

Other seeded users also use password `Password@123`.

## Main API Endpoints
- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Institutes:
  - `GET /api/institutes`
- Posts:
  - `GET /api/posts/feed?tab=for-you|following|campus|all-jis`
  - `POST /api/posts`
  - `GET /api/posts/:id`
  - `DELETE /api/posts/:id`
  - `POST /api/posts/:id/like`
  - `DELETE /api/posts/:id/like`
  - `POST /api/posts/:id/repost`
  - `DELETE /api/posts/:id/repost`
  - `POST /api/posts/:id/bookmark`
  - `DELETE /api/posts/:id/bookmark`
  - `GET /api/posts/:id/replies`
- Users:
  - `GET /api/users/search?q=...`
  - `GET /api/users/:id/profile`
  - `GET /api/users/:id/posts`
  - `POST /api/users/:id/follow`
  - `DELETE /api/users/:id/follow`
  - `GET /api/users/me/bookmarks`
- Notifications:
  - `GET /api/notifications`
  - `PATCH /api/notifications/read-all`
  - `PATCH /api/notifications/:id/read`
- Chat:
  - `GET /api/chats`
  - `POST /api/chats`
  - `GET /api/chats/:id/messages`
  - `POST /api/chats/:id/messages`
  - `PATCH /api/chats/:id/read`
  - `POST /api/chats/:chatId/messages/:messageId/reactions`
  - `DELETE /api/chats/:chatId/messages/:messageId/reactions`
- Verification:
  - `POST /api/verification/submit` (multipart with `receipt`)
  - `GET /api/verification/my`
- Admin:
  - `GET /api/admin/dashboard`
  - `GET /api/admin/verifications`
  - `PATCH /api/admin/verifications/:id`
- Trends:
  - `GET /api/trends`

## Socket.IO Events
- Client emit:
  - `chat:join`
  - `chat:typing`
  - `chat:send`
  - `chat:read`
- Server emit:
  - `chat:new-message`
  - `chat:typing`
  - `chat:read`
  - `chat:conversation-created`

Auth for socket:
- Send access token in `auth.token` when connecting.

## Notes for Your Existing Frontend
- Keep your UI layout/theme exactly as-is.
- Replace demo JS data calls with these APIs incrementally.
- Login institute dropdown can be loaded from `GET /api/institutes` so all institute names come from DB.
