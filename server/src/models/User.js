const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }]
  },
  { _id: true, timestamps: true }
);

const externalHistorySchema = new mongoose.Schema(
  {
    source: { type: String, default: "external", trim: true },
    videoId: { type: String, required: true, trim: true },
    title: { type: String, default: "", trim: true },
    thumbnailUrl: { type: String, default: "", trim: true },
    videoUrl: { type: String, default: "", trim: true },
    channelName: { type: String, default: "", trim: true },
    isShort: { type: Boolean, default: false },
    watchedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const notificationSchema = new mongoose.Schema(
  {
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" },
    channelName: { type: String, default: "", trim: true },
    videoTitle: { type: String, default: "", trim: true },
    thumbnailUrl: { type: String, default: "", trim: true },
    watchUrl: { type: String, default: "", trim: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date, default: null }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3 },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: {
      type: String,
      default: "https://i.pravatar.cc/150?img=12"
    },
    // Keep backward compatibility with legacy records where subscribers was stored as a number.
    subscribers: { type: mongoose.Schema.Types.Mixed, default: [] },
    channelDescription: { type: String, default: "", trim: true },
    subscribedChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    dislikedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    savedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    watchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    watchHistoryExternal: [externalHistorySchema],
    notifications: [notificationSchema],
    playlists: [playlistSchema],
    isAdmin: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
