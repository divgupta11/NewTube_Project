const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const authRoutes = require("./routes/authRoutes");
const videoRoutes = require("./routes/videoRoutes");
const commentRoutes = require("./routes/commentRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const notebookRoutes = require("./routes/notebookRoutes");
const publicProfileRoutes = require("./routes/publicProfileRoutes");

const app = express();
const uploadsDir = path.join(__dirname, "..", "uploads");
const clientDistDir = path.join(__dirname, "..", "dist");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [
        process.env.CLIENT_URL
      ].filter(Boolean);
      const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
      const renderPattern = /^https?:\/\/([a-z0-9-]+\.)?onrender\.com$/i;

      if (allowedOrigins.includes(origin) || localhostPattern.test(origin) || renderPattern.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for this origin"));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
}

app.get("/api/health", (req, res) => {
  res.json({ message: "API running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/user", publicProfileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/notebook", notebookRoutes);

if (fs.existsSync(clientDistDir)) {
  app.use((req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }

    return res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Server Error",
    details: err.details || null
  });
});

module.exports = app;
