const fs = require("fs");
const multer = require("multer");
const path = require("path");

const baseUploadsDir = process.env.VERCEL
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");
const videosDir = path.join(baseUploadsDir, "videos");
const thumbnailsDir = path.join(baseUploadsDir, "thumbnails");

fs.mkdirSync(videosDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "video") {
      cb(null, videosDir);
    } else {
      cb(null, thumbnailsDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "video") {
    // Keep formats browser players handle reliably for direct playback.
    const videoTypes = /mp4|webm/;
    const ext = videoTypes.test(path.extname(file.originalname).toLowerCase());
    if (!ext) {
      return cb(new Error("Only MP4 or WEBM video files are allowed"));
    }
    return cb(null, true);
  }

  const imageTypes = /jpg|jpeg|png|webp/;
  const ext = imageTypes.test(path.extname(file.originalname).toLowerCase());
  if (!ext) {
    return cb(new Error("Only image files are allowed for thumbnail"));
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }
});

module.exports = upload;
