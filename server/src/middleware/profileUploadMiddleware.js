const fs = require("fs");
const multer = require("multer");
const path = require("path");

const baseUploadsDir = path.join(process.cwd(), "uploads");
const avatarsDir = path.join(baseUploadsDir, "avatars");

fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const imageTypes = /jpg|jpeg|png|webp/;
  const ext = imageTypes.test(path.extname(file.originalname).toLowerCase());

  if (!ext) {
    return cb(new Error("Only JPG, PNG, or WEBP image files are allowed for avatar"));
  }

  return cb(null, true);
};

const profileUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = profileUpload;
