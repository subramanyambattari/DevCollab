# DevCollab

DevCollab is a full-stack collaboration app with:

- React frontend
- Node.js + Express backend
- MongoDB via Mongoose
- Socket.IO chat
- JWT authentication
- Room, task, and shared note management

## Project Structure

```text
DevCollab/
  client/
  server/
  Dockerfile
  package.json
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables for the backend:

Edit `server/.env` and set your values there.

3. Start the app:

```bash
npm run dev
```

The client runs on `http://localhost:5173` and the API runs on `http://localhost:5000`.

## UI Stack

- The frontend uses Tailwind CSS via Vite.
- `client/src/index.css` contains a small set of shared utility classes for the glassy dashboard look.

## Environment Variables

Backend:

- `PORT` - server port, defaults to `5000`
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - secret used to sign auth tokens
- `CLIENT_URL` - optional client origin for CORS and sockets

## Docker

Build the image:

```bash
docker build -t yourdockerhubusername/devcollab:latest .
```

Push to Docker Hub:

```bash
docker login
docker push yourdockerhubusername/devcollab:latest
```

Run locally:

```bash
docker run -p 5000:5000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="change-me" \
  -e PORT=5000 \
  yourdockerhubusername/devcollab:latest
```

## Deploying on Render

1. Create a new **Web Service** on Render.
2. Choose **Deploy an existing image** and point it at your Docker Hub image, or connect the repo and let Render build the Dockerfile.
3. Set these environment variables in Render:

- `MONGODB_URI`
- `JWT_SECRET`
- `PORT` set to `5000`
- `CLIENT_URL` can be left blank when the app is served from the same container

4. Render will expose the app on its public URL. The backend serves the built React app from `client/dist`, so no separate frontend deployment is needed.

## Final Testing

- See [FINAL_TESTING_CHECKLIST.md](./FINAL_TESTING_CHECKLIST.md) for the end-to-end verification steps after deployment.

## Notes

- Use the same MongoDB database across deployments to keep rooms, tasks, notes, and chat history.
- Socket.IO connects from the browser to the same origin in production, which keeps deployment simple.
