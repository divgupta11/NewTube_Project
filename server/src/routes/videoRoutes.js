const express = require("express");
const {
  createVideo,
  getVideos,
  getVideoById,
  getVideoAI,
  analyzeVideoAI,
  askVideoAI,
  toggleLikeVideo,
  toggleDislikeVideo,
  getChannelVideos,
  updateVideo,
  deleteVideo
} = require("../controllers/videoController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", optionalProtect, getVideos);
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
