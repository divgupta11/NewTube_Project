const mongoose = require("mongoose");

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
    subscribedChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    dislikedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    watchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
    isAdmin: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
