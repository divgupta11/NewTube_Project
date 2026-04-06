const express = require("express");
const {
  createVideo,
  getVideos,
  getTrendingVideos,
  getShortVideos,
  getVideoById,
  getVideoAI,
  getGeminiAIHealth,
  getPexelsAPIHealth,
  analyzeVideoAI,
  askVideoAI,
  toggleLikeVideo,
  toggleDislikeVideo,
  getShortMeta,
  toggleShortLike,
  toggleShortDislike,
  getShortComments,
  addShortComment,
  getChannelVideos,
  updateVideo,
  deleteVideo,
  seedSampleVideos
} = require("../controllers/videoController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", optionalProtect, getVideos);
router.get("/trending", optionalProtect, getTrendingVideos);
router.get("/shorts", optionalProtect, getShortVideos);
router.get("/ai/health", optionalProtect, getGeminiAIHealth);
router.get("/pexels/health", optionalProtect, getPexelsAPIHealth);
router.get("/shorts/:id/meta", optionalProtect, getShortMeta);
router.get("/shorts/:id/comments", optionalProtect, getShortComments);
router.post("/shorts/:id/comments", protect, addShortComment);
router.post("/shorts/:id/like", protect, toggleShortLike);
router.post("/shorts/:id/dislike", protect, toggleShortDislike);
router.post("/seed-samples", optionalProtect, seedSampleVideos);
router.get("/channel/:channelId", optionalProtect, getChannelVideos);
router.get("/:id/ai", optionalProtect, getVideoAI);
router.post("/:id/ai/analyze", protect, analyzeVideoAI);
router.post("/:id/ai/ask", optionalProtect, askVideoAI);
router.get("/:id", optionalProtect, getVideoById);
router.post(
  "/upload",
  protect,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]),
  createVideo
);
router.post("/:id/like", protect, toggleLikeVideo);
router.patch("/:id/like", protect, toggleLikeVideo);
router.post("/:id/dislike", protect, toggleDislikeVideo);
router.patch("/:id/dislike", protect, toggleDislikeVideo);
router.patch("/:id", protect, updateVideo);
router.delete("/:id", protect, deleteVideo);

module.exports = router;
