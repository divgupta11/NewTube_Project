const express = require("express");
const {
  addComment,
  getCommentsByVideo,
  toggleLikeComment
} = require("../controllers/commentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:videoId", getCommentsByVideo);
router.post("/:videoId", protect, addComment);
router.patch("/like/:commentId", protect, toggleLikeComment);

module.exports = router;
