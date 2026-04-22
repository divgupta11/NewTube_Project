# YouTube Clone (MERN)

Full stack YouTube Clone built with React + Node/Express + MongoDB.

## Features

- JWT authentication (signup/login)
- Responsive frontend (mobile/tablet/desktop)
- Sticky navbar + sidebar layout
- Home video feed with search
- Watch page with likes and comments
- Upload page (video + thumbnail via multer)
- Channel page with subscribe/unsubscribe
- REST APIs for auth, videos, comments, likes, and subscriptions

## Project Structure

- `client/` React frontend (Vite)
- `server/` Express backend + MongoDB (Mongoose)

## Environment Setup

### Backend (`server/.env`)

Copy `server/.env.example` to `server/.env` and update values:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/youtube_clone
JWT_SECRET=replace_with_strong_secret
CLIENT_URL=http://localhost:5173
PEXELS_API_KEY=your_pexels_api_key_here
```

### Frontend (`client/.env`)

Copy `client/.env.example` to `client/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SERVER_URL=http://localhost:5000
```

## Run Locally

### 1) Start backend

```bash
cd server
npm install
npm run dev
```

### 2) Start frontend

```bash
cd client
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:5000`

## Deploy On Vercel

Deploy from the repository root (`Youtube_clone`).

### Project layout expected by Vercel

- `client/` contains the Vite frontend
- `server/` contains the Express app
- `api/[...all].js` exposes the Express app as a serverless function

### Build configuration

- Install command: `npm run install:all`
- Build command: `npm run build`
- Output directory: `client/dist`

### Required Vercel settings

Add these in the Vercel dashboard under Project Settings > Environment Variables:

Required Vercel environment variables:

- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL` (set to your deployed frontend URL, for example `https://your-app.vercel.app`)
- `PEXELS_API_KEY`

Optional environment variables:

- `ADMIN_EMAIL`
- `VITE_API_URL` (leave empty to use same-origin `/api`)
- `VITE_SERVER_URL` (leave empty to use same-origin URLs for uploads)

### Deploy steps

1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Set the root directory to the repository root.
4. Add the environment variables above.
5. Deploy.

### Useful commands

```bash
npm run install:all
npm run build
npm start
```

For local frontend development:

```bash
cd client
npm run dev
```

For local backend development:

```bash
cd server
npm run dev
```

### Important note

This project serves uploaded files from the app runtime. That works for the deployed demo flow, but for long-term persistent uploads you should move media storage to a cloud service such as Cloudinary, S3, or Vercel Blob.

## API Endpoints

### Auth
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me` (protected)

### Videos
- `GET /api/videos`
- `GET /api/videos?search=query`
- `GET /api/videos/:id`
- `GET /api/videos/channel/:channelId`
- `POST /api/videos/upload` (protected, multipart: `video`, `thumbnail`)
- `PATCH /api/videos/:id/like` (protected)

### Comments
- `GET /api/comments/:videoId`
- `POST /api/comments/:videoId` (protected)
- `PATCH /api/comments/like/:commentId` (protected)

### Users / Channel
- `GET /api/users/channel/:channelId`
- `PATCH /api/users/subscribe/:channelId` (protected)
