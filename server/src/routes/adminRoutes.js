const express = require("express");
const {
  adminLogin,
  getOverview,
  getAnalytics,
  getUsers,
  getUserById,
  updateUserProfile,
  toggleBlockUser,
  deleteUser,
  getVideos,
  updateVideo,
  deleteVideo,
  getComments,
  deleteComment
} = require("../controllers/adminController");
const { adminProtect } = require("../middleware/adminMiddleware");
const profileUpload = require("../middleware/profileUploadMiddleware");

const router = express.Router();

router.post("/auth/login", adminLogin);

router.get("/overview", adminProtect, getOverview);
router.get("/analytics", adminProtect, getAnalytics);

router.get("/users", adminProtect, getUsers);
router.get("/user/:id", adminProtect, getUserById);
router.patch("/users/:id", adminProtect, profileUpload.single("avatar"), updateUserProfile);
router.patch("/users/:id/block", adminProtect, toggleBlockUser);
router.delete("/users/:id", adminProtect, deleteUser);

router.get("/videos", adminProtect, getVideos);
router.patch("/videos/:id", adminProtect, updateVideo);
router.delete("/videos/:id", adminProtect, deleteVideo);

router.get("/comments", adminProtect, getComments);
router.delete("/comments/:id", adminProtect, deleteComment);

module.exports = router;
