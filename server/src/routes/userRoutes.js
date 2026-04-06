const express = require("express");
const {
  toggleSubscribe,
  getChannelById,
  getMyProfile,
  updateProfileDetails,
  createPlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  toggleSavedVideo,
  recordWatchHistory,
  removeHistoryVideo,
  clearHistory,
  getMyHistory,
  getMySubscriptions
} = require("../controllers/userController");
const { protect, optionalProtect } = require("../middleware/authMiddleware");
const profileUpload = require("../middleware/profileUploadMiddleware");

const router = express.Router();

router.get("/profile", protect, getMyProfile);
router.patch("/profile", protect, profileUpload.single("avatar"), updateProfileDetails);
router.post("/playlists", protect, createPlaylist);
router.post("/playlists/:playlistId/videos/:videoId", protect, addVideoToPlaylist);
router.delete("/playlists/:playlistId/videos/:videoId", protect, removeVideoFromPlaylist);
router.post("/saved/:videoId", protect, toggleSavedVideo);
router.get("/history", protect, getMyHistory);
router.post("/history/watch", protect, recordWatchHistory);
router.delete("/history", protect, clearHistory);
router.delete("/history/:videoId", protect, removeHistoryVideo);
router.get("/subscriptions", protect, getMySubscriptions);

router.get("/channel/:channelId", optionalProtect, getChannelById);
router.patch("/subscribe/:channelId", protect, toggleSubscribe);
router.post("/subscribe/:channelId", protect, toggleSubscribe);

module.exports = router;
