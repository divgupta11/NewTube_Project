const Notification = require("../models/Notification");
const User = require("../models/User");

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate("channel", "username avatar")
      .populate("video", "title thumbnailUrl isShort")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json(notifications);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.json(notification);
  } catch (error) {
    return res.status(500).json({ message: "Failed to mark notification as read", error: error.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to mark all as read", error: error.message });
  }
};

const clearMyNotifications = async (req, res) => {
  try {
    const [notificationResult, userResult] = await Promise.all([
      Notification.deleteMany({ user: req.user._id }),
      User.updateOne({ _id: req.user._id }, { $set: { notifications: [] } })
    ]);

    return res.json({
      message: "Notifications cleared",
      deletedCount: notificationResult.deletedCount || 0,
      embeddedCleared: userResult.modifiedCount > 0
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear notifications", error: error.message });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  markAllAsRead,
  clearMyNotifications
};
