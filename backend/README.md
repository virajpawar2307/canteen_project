# Canteen Backend (MERN)

Node.js + Express + MongoDB backend scaffold for the canteen project.

## Installed dependencies

- express
- mongoose
- cors
- dotenv
- bcryptjs
- jsonwebtoken
- cookie-parser
- morgan
- helmet
- express-validator
- nodemon (dev)

## Project structure

backend/
  src/
    app.js
    server.js
    config/
      db.js
    routes/
      health.routes.js
    controllers/
    models/
    middlewares/
    utils/

## Setup

1. Create an environment file from `.env.example`:
   - Windows PowerShell: `Copy-Item .env.example .env`
2. Update environment values in `.env`.
3. Run dev server:
   - `npm run dev`

## Scripts

- `npm run dev` - start with nodemon
- `npm start` - start with node
