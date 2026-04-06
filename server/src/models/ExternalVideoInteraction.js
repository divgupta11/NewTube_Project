const mongoose = require("mongoose");

const externalCommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

const externalVideoInteractionSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true, unique: true, index: true },
    source: { type: String, default: "pexels", trim: true },
    title: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [externalCommentSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExternalVideoInteraction", externalVideoInteractionSchema);

