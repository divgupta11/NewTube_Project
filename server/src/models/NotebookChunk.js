const mongoose = require("mongoose");

const notebookChunkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    clientId: { type: String, default: "", index: true },
    video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true, index: true },
    transcriptHash: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true, min: 0 },
    startSeconds: { type: Number, default: 0, min: 0 },
    endSeconds: { type: Number, default: 0, min: 0 },
    text: { type: String, required: true, trim: true },
    embedding: [{ type: Number }]
  },
  { timestamps: true }
);

notebookChunkSchema.index({ video: 1, user: 1, chunkIndex: 1 }, { unique: false });
notebookChunkSchema.index({ video: 1, clientId: 1, chunkIndex: 1 }, { unique: false });

module.exports = mongoose.model("NotebookChunk", notebookChunkSchema);
