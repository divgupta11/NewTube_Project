const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Video = require("../models/Video");
const Comment = require("../models/Comment");
const { buildProfilePayload } = require("./userController");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "divyanshi15@gmail.com").toLowerCase();

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
};

const subscribersCount = (subscribers) => {
  if (Array.isArray(subscribers)) return subscribers.length;
  return Number(subscribers || 0);
};

const parsePage = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

const normalizeDailySeries = (map, days = 14) => {
  const now = new Date();
  const output = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    output.push({ date: key, value: map.get(key) || 0 });
  }
  return output;
};

const groupByDate = async (Model, dateField, match = {}, metricExpr = { $sum: 1 }) => {
  const rows = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: `$${dateField}`
          }
        },
        value: metricExpr
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const m = new Map(rows.map((row) => [row._id, Number(row.value || 0)]));
  return normalizeDailySeries(m, 14);
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ message: "Only configured admin email can access admin panel" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Admin account not found. Signup first with admin email." });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Admin account is blocked" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isAdmin) {
      user.isAdmin = true;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      token,
      admin: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Admin login failed", error: error.message });
  }
};

const getOverview = async (req, res) => {
  try {
    const [users, videos, comments] = await Promise.all([
      User.find({}, "subscribers subscribedChannels updatedAt").lean(),
      Video.find({}, "likes dislikes views createdAt").lean(),
      Comment.countDocuments()
    ]);

    const totalUsers = users.length;
    const totalVideos = videos.length;
    const totalComments = comments;
    const totalLikes = videos.reduce((sum, v) => sum + (Array.isArray(v.likes) ? v.likes.length : 0), 0);
    const totalDislikes = videos.reduce((sum, v) => sum + (Array.isArray(v.dislikes) ? v.dislikes.length : 0), 0);
    const totalViews = videos.reduce((sum, v) => sum + Number(v.views || 0), 0);
    const totalSubscribers = users.reduce((sum, u) => sum + subscribersCount(u.subscribers), 0);
    const totalSubscriptions = users.reduce(
      (sum, u) => sum + (Array.isArray(u.subscribedChannels) ? u.subscribedChannels.length : 0),
      0
    );

    return res.json({
      totals: {
        totalUsers,
        totalVideos,
        totalLikes,
        totalDislikes,
        totalComments,
        totalSubscribers,
        totalViews,
        totalSubscriptions
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch admin overview", error: error.message });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const [dailyUsers, videoUploads, viewsByDay, commentsByDay, users, videos] = await Promise.all([
      groupByDate(User, "updatedAt"),
      groupByDate(Video, "createdAt"),
      groupByDate(Video, "createdAt", {}, { $sum: "$views" }),
      groupByDate(Comment, "createdAt"),
      User.find({}, "username subscribers subscribedChannels").lean(),
      Video.find({}, "title views likes dislikes user createdAt").populate("user", "username").lean()
    ]);

    const likesVsDislikes = {
      likes: videos.reduce((sum, v) => sum + (Array.isArray(v.likes) ? v.likes.length : 0), 0),
      dislikes: videos.reduce((sum, v) => sum + (Array.isArray(v.dislikes) ? v.dislikes.length : 0), 0)
    };

    let runningViews = 0;
    const videoViewsGrowth = viewsByDay.map((item) => {
      runningViews += item.value;
      return { date: item.date, value: runningViews };
    });

    const subscriberMap = new Map();
    users.forEach((u) => {
      subscriberMap.set(String(u._id), subscribersCount(u.subscribers));
    });

    const mostPopularChannels = users
      .map((u) => ({
        _id: u._id,
        username: u.username,
        subscribers: subscribersCount(u.subscribers),
        subscriptions: Array.isArray(u.subscribedChannels) ? u.subscribedChannels.length : 0
      }))
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 8);

    const mostWatchedVideos = videos
      .map((v) => ({
        _id: v._id,
        title: v.title,
        views: Number(v.views || 0),
        likes: Array.isArray(v.likes) ? v.likes.length : 0,
        dislikes: Array.isArray(v.dislikes) ? v.dislikes.length : 0,
        uploader: v.user?.username || "Unknown"
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8);

    const engagementRate = videoUploads.map((item, index) => {
      const commentsToday = commentsByDay[index]?.value || 0;
      const uploadsToday = item.value || 1;
      return {
        date: item.date,
        value: Number(((commentsToday / uploadsToday) * 100).toFixed(2))
      };
    });

    return res.json({
      dailyActiveUsers: dailyUsers,
      videoUploads,
      subscriberGrowth: dailyUsers,
      videoViewsGrowth,
      engagementRate,
      likesVsDislikes,
      mostPopularChannels,
      mostWatchedVideos,
      subscriptionsByChannel: Array.from(subscriberMap.entries()).slice(0, 20)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = parsePage(req.query.page, 1);
    const limit = Math.min(parsePage(req.query.limit, 10), 50);

    const query = search
      ? {
          $or: [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("username email createdAt subscribedChannels subscribers isBlocked isAdmin")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const userIds = users.map((u) => u._id);
    const uploads = await Video.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } }
    ]);
    const uploadsMap = new Map(uploads.map((row) => [String(row._id), row.count]));

    const rows = users.map((u) => ({
      ...u,
      totalVideosUploaded: uploadsMap.get(String(u._id)) || 0,
      totalSubscriptions: Array.isArray(u.subscribedChannels) ? u.subscribedChannels.length : 0,
      subscribersCount: subscribersCount(u.subscribers)
    }));

    return res.json({
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const profile = await buildProfilePayload(req.params.id, req.user, { includeEmail: true });

    if (!profile) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      ...profile,
      user: {
        ...profile.user,
        email: profile.user.email || "",
        isAdmin: true
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user profile", error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { username, email, channelDescription } = req.body || {};

    if (typeof username === "string" && username.trim()) {
      user.username = username.trim();
    }

    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).select("_id");
      if (existing) {
        return res.status(409).json({ message: "Email already in use" });
      }
      user.email = normalizedEmail;
    }

    if (typeof channelDescription === "string") {
      user.channelDescription = channelDescription.trim();
    }

    if (req.file?.filename) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    const profile = await buildProfilePayload(user._id, req.user, { includeEmail: true });

    return res.json({
      message: "User profile updated",
      ...profile
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user profile", error: error.message });
  }
};

const toggleBlockUser = async (req, res) => {
  try {
    const { blocked } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    user.isBlocked = Boolean(blocked);
    await user.save();

    return res.json({
      _id: user._id,
      isBlocked: user.isBlocked
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user block status", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = toObjectId(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid user id" });

    if (String(userId) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete yourself" });
    }

    const videos = await Video.find({ user: userId }).select("_id").lean();
    const videoIds = videos.map((v) => v._id);

    await Promise.all([
      Comment.deleteMany({ user: userId }),
      videoIds.length ? Comment.deleteMany({ video: { $in: videoIds } }) : Promise.resolve(),
      Video.deleteMany({ user: userId }),
      User.updateMany({}, { $pull: { subscribedChannels: userId } }),
      User.deleteOne({ _id: userId })
    ]);

    return res.json({ message: "User deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
};

const getVideos = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = parsePage(req.query.page, 1);
    const limit = Math.min(parsePage(req.query.limit, 10), 50);

    const query = search
      ? {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } }
          ]
        }
      : {};

    const [total, videos] = await Promise.all([
      Video.countDocuments(query),
      Video.find(query)
        .populate("user", "username email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    const videoIds = videos.map((v) => v._id);
    const comments = await Comment.aggregate([
      { $match: { video: { $in: videoIds } } },
      { $group: { _id: "$video", count: { $sum: 1 } } }
    ]);
    const commentsMap = new Map(comments.map((row) => [String(row._id), row.count]));

    const rows = videos.map((v) => ({
      ...v,
      likesCount: Array.isArray(v.likes) ? v.likes.length : 0,
      dislikesCount: Array.isArray(v.dislikes) ? v.dislikes.length : 0,
      commentsCount: commentsMap.get(String(v._id)) || 0
    }));

    return res.json({
      items: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch videos", error: error.message });
  }
};

const updateVideo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ message: "Video not found" });

    if (typeof title === "string" && title.trim()) video.title = title.trim();
    if (typeof description === "string") video.description = description.trim();

    await video.save();
    const populated = await Video.findById(video._id).populate("user", "username email").lean();
    return res.json(populated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update video", error: error.message });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const videoId = toObjectId(req.params.id);
    if (!videoId) return res.status(400).json({ message: "Invalid video id" });

    await Promise.all([
      Comment.deleteMany({ video: videoId }),
      Video.deleteOne({ _id: videoId }),
      User.updateMany({}, { $pull: { likedVideos: videoId, dislikedVideos: videoId, watchHistory: videoId } })
    ]);

    return res.json({ message: "Video deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete video", error: error.message });
  }
};

const getComments = async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = parsePage(req.query.page, 1);
    const limit = Math.min(parsePage(req.query.limit, 10), 50);

    const baseQuery = search
      ? { text: { $regex: search, $options: "i" } }
      : {};

    const [total, comments] = await Promise.all([
      Comment.countDocuments(baseQuery),
      Comment.find(baseQuery)
        .populate("user", "username email")
        .populate("video", "title")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    return res.json({
      items: comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch comments", error: error.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    await Comment.deleteOne({ _id: req.params.id });
    return res.json({ message: "Comment deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete comment", error: error.message });
  }
};

module.exports = {
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
};
