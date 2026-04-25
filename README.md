# DevCollab

DevCollab is now structured as a TypeScript-first full-stack collaboration app.

## Stack

- Frontend: React 18, TypeScript, Zustand, Axios, Socket.IO client, custom Rollup/Tailwind build pipeline
- Backend: Node.js, Express, TypeScript, Socket.IO, JWT access tokens + refresh tokens
- Data: MongoDB with Mongoose, wrapped behind repository and service layers
- Validation: Zod DTO validation on the server
- Tooling: ESLint, Prettier, Husky, Docker, Docker Compose, Node-based client smoke tests

## What Changed

- Converted the client entry points to `TSX`
- Added a shared domain contract in [`shared/types.ts`](./shared/types.ts)
- Moved backend code into `server/src` with:
  - repository pattern
  - service layer
  - typed route factories
  - centralized error handling
  - JWT refresh-token flow
  - resource-level RBAC via room ownership
- Added a typed Axios API client and a Zustand store on the frontend
- Replaced the Vite/Vitest client path with a deterministic in-process Rollup + Tailwind compiler pipeline that works in this Windows workspace
- Added strict TypeScript configs for both workspaces

## Folder Structure

```text
DevCollab/
  client/
    src/
      App.tsx
      main.tsx
      components/
      hooks/
      lib/
      screens/
      store/
    tsconfig.json
  server/
    src/
      app.ts
      index.ts
      config/
      lib/
      middleware/
      models/
      repositories/
      routes/
      services/
      validation/
    tsconfig.json
  shared/
    types.ts
  docker-compose.yml
  Dockerfile
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure the backend environment:

```bash
cp server/.env.example server/.env
```

3. Start both workspaces:

```bash
npm run dev
```

- Client: `http://localhost:5173`
- API: `http://localhost:5000`

## Environment Variables

Backend:

- `PORT` default `5000`
- `MONGODB_URI` MongoDB connection string
- `JWT_SECRET` signing secret for access and refresh tokens
- `CLIENT_URL` allowed browser origin for CORS and Socket.IO
- `ACCESS_TOKEN_TTL` defaults to `15m`
- `REFRESH_TOKEN_TTL` defaults to `7d`

## Production Build

Build both workspaces:

```bash
npm run build
```

Start the server:

```bash
npm run start --workspace server
```

The backend serves the built client from `client/dist` when available. The client build writes compiled Tailwind CSS, vendor scripts, and the app bundle into `client/dist/assets`.

## Docker

Build the image:

```bash
docker build -t devcollab:latest .
```

Run the stack with MongoDB:

```bash
docker compose up --build
```

## Notes

- The persistence layer still uses MongoDB, but it is isolated behind repositories and service interfaces so a future Prisma or TypeORM migration is localized.
- Authentication is token-based with refresh rotation.
- Room access is enforced at the resource level, which acts as RBAC for this domain.
- Frontend realtime updates are handled through a typed Socket.IO hook.
- Client tests now run as a Node smoke test instead of a browser worker pool, which avoids the process-spawn limitations in this environment.

## Validation

See [`FINAL_TESTING_CHECKLIST.md`](./FINAL_TESTING_CHECKLIST.md) for end-to-end checks.
