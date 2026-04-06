const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    transcript: { type: String, default: "" },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    tags: [{ type: String }],
    durationSeconds: { type: Number, default: 0, min: 0 },
    isShort: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    aiStatus: { type: String, enum: ["pending", "ready", "error"], default: "pending" },
    aiProvider: { type: String, default: "" },
    aiSummary: { type: String, default: "" },
    aiKeyPoints: [{ type: String }],
    aiNotes: [{ type: String }],
    aiLearningMode: { type: String, default: "" },
    aiError: { type: String, default: "" },
    aiLastProcessedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
