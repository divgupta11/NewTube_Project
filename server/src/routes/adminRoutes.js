const express = require("express");
const {
  adminLogin,
  getOverview,
  getAnalytics,
  getUsers,
  toggleBlockUser,
  deleteUser,
  getVideos,
  updateVideo,
  deleteVideo,
  getComments,
  deleteComment
} = require("../controllers/adminController");
const { adminProtect } = require("../middleware/adminMiddleware");

const router = express.Router();

router.post("/auth/login", adminLogin);

router.get("/overview", adminProtect, getOverview);
router.get("/analytics", adminProtect, getAnalytics);

router.get("/users", adminProtect, getUsers);
router.patch("/users/:id/block", adminProtect, toggleBlockUser);
router.delete("/users/:id", adminProtect, deleteUser);

router.get("/videos", adminProtect, getVideos);
router.patch("/videos/:id", adminProtect, updateVideo);
router.delete("/videos/:id", adminProtect, deleteVideo);

router.get("/comments", adminProtect, getComments);
router.delete("/comments/:id", adminProtect, deleteComment);

module.exports = router;
