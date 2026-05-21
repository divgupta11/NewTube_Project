const express = require("express");
const { 
  getMyNotifications, 
  markNotificationAsRead, 
  markAllAsRead,
  clearMyNotifications
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getMyNotifications);
router.delete("/", protect, clearMyNotifications);
router.patch("/read-all", protect, markAllAsRead);
router.patch("/:id/read", protect, markNotificationAsRead);

module.exports = router;
