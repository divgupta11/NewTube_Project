const fs = require("fs");
const path = require("path");

const UPLOADS_DIR = process.env.VERCEL
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
};

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const requestPath = decodeURIComponent(url.pathname.replace(/^\/api\/uploads\/?/, ""));
  const segments = requestPath.split("/").filter(Boolean);
  const filePath = path.normalize(path.join(UPLOADS_DIR, ...segments));

  if (!filePath.startsWith(path.normalize(UPLOADS_DIR))) {
    return res.status(400).json({ message: "Invalid file path" });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  res.setHeader("Content-Type", getContentType(filePath));
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  fs.createReadStream(filePath).pipe(res);
};
