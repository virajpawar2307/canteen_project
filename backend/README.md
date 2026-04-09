# Canteen Backend

Node.js + Express + MongoDB backend for the canteen project.

## Local setup

1. Create `.env` from `.env.example`.
2. Fill in required values.
3. Install packages and run:

```bash
npm install
npm run dev
```

## Environment variables

- `PORT`: backend port (Render provides this automatically)
- `MONGO_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign auth tokens
- `NODE_ENV`: `development` or `production`
- `APP_UTC_OFFSET_MINUTES`: timezone offset in minutes used for slot checks and report/order timing (`330` for IST)
- `CLIENT_URL`: single frontend origin (kept for backward compatibility)
- `CLIENT_URLS`: comma-separated list of allowed frontend origins for CORS

Example:

```env
CLIENT_URLS=https://your-app.vercel.app,https://your-preview.vercel.app
```

## Scripts

- `npm run dev`: start with nodemon
- `npm start`: start with Node.js

## Render deployment (Free plan)

1. Create a new Web Service on Render.
2. Connect your repository.
3. Use these settings:
  - Root Directory: `backend`
  - Build Command: `npm install`
  - Start Command: `npm start`
4. Add environment variables in Render dashboard:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `CLIENT_URLS=https://<your-vercel-domain>`
5. Deploy and verify health endpoint:
  - `https://<your-render-service>.onrender.com/api/health`
