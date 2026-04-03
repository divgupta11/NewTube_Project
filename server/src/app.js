const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const videoRoutes = require("./routes/videoRoutes");
const commentRoutes = require("./routes/commentRoutes");
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);
      const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

      if (allowedOrigins.includes(origin) || localhostPattern.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for this origin"));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ message: "API running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message || "Server Error" });
});

module.exports = app;
