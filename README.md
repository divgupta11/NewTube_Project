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
npm run dev
```

### 2) Start frontend

```bash
cd client
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:5000`

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
