const mongoose = require("mongoose");

const notebookMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, trim: true },
    mode: { type: String, default: "qa", trim: true },
    keyTakeaway: { type: String, default: "" },
    sources: [
      {
        label: { type: String, default: "" },
        seconds: { type: Number, default: 0 },
        quote: { type: String, default: "" },
        chunkIndex: { type: Number, default: 0 }
      }
    ],
    timestampHints: [
      {
        label: { type: String, default: "" },
        seconds: { type: Number, default: 0 },
        reason: { type: String, default: "" }
      }
    ],
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const notebookNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    source: { type: String, enum: ["user", "ai"], default: "user" },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const notebookSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    clientId: { type: String, default: "", index: true },
    video: { type: mongoose.Schema.Types.ObjectId, ref: "Video", default: null, index: true },
    externalVideoId: { type: String, default: "", index: true },
    videoUrl: { type: String, default: "" },
    videoTitle: { type: String, default: "" },
    transcriptSnapshot: { type: String, default: "" },
    transcriptHash: { type: String, default: "", index: true },
    transcriptChunkCount: { type: Number, default: 0 },
    descriptionSnapshot: { type: String, default: "" },
    summaryShort: { type: String, default: "" },
    summaryDetailed: { type: String, default: "" },
    keyPoints: [{ type: String }],
    aiNotes: [{ type: String }],
    highlights: [
      {
        label: { type: String, default: "" },
        seconds: { type: Number, default: 0 },
        reason: { type: String, default: "" }
      }
    ],
    messages: [notebookMessageSchema],
    notes: [notebookNoteSchema],
    lastMode: { type: String, default: "summary" },
    lastProcessedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

notebookSessionSchema.index(
  { video: 1, user: 1 },
  { unique: false, partialFilterExpression: { user: { $type: "objectId" } } }
);

notebookSessionSchema.index(
  { video: 1, clientId: 1 },
  { unique: false, partialFilterExpression: { clientId: { $type: "string" } } }
);

notebookSessionSchema.index({ externalVideoId: 1, user: 1 }, { unique: false });
notebookSessionSchema.index({ externalVideoId: 1, clientId: 1 }, { unique: false });

module.exports = mongoose.model("NotebookSession", notebookSessionSchema);
