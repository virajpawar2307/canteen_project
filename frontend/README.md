# Canteen Frontend

React + Vite frontend for the canteen system.

## Local setup

1. Create `.env` from `.env.example`.
2. Set `VITE_API_BASE_URL`.
3. Install and run:

```bash
npm install
npm run dev
```

## Environment variable

- `VITE_API_BASE_URL`: full backend API base URL (must include `/api`)

Example:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

## Build

```bash
npm run build
```

## Vercel deployment (Free plan)

1. Create a new Vercel project from this repository.
2. Set project Root Directory to `frontend`.
3. Add environment variable:
	- `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`
4. Deploy.

This project includes `vercel.json` with SPA rewrites so browser refresh works on nested routes.
