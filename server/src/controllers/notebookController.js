const NotebookSession = require("../models/NotebookSession");
const NotebookChunk = require("../models/NotebookChunk");
const Video = require("../models/Video");
const { summarizeVideo, answerQuestion, buildNotebookSource } = require("../services/notebookAiService");
const { hashText } = require("../services/notebookRagService");
const { fetchPexelsVideoById } = require("../services/pexelsService");

const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const getClientId = (req) => {
  const raw = String(req.headers["x-notebook-client-id"] || "").trim();
  return raw;
};

const getNotebookOwnerQuery = (req) => {
  if (req.user?._id) {
    return { user: req.user._id, clientId: "" };
  }

  const clientId = getClientId(req);
  if (!clientId) {
    return { clientId: "anonymous" };
  }

  return { clientId };
};

const resolveNotebookVideo = async (videoId) => {
  if (isMongoObjectId(videoId)) {
    const video = await Video.findById(videoId).populate("user", "username avatar subscribers");
    if (video) {
      return {
        video,
        sessionVideoQuery: { video: video._id, externalVideoId: "" },
        sessionVideoUpdate: { video: video._id, externalVideoId: "" },
        canPersistToVideo: true
      };
    }
  }

  if (String(videoId || "").startsWith("pexels-")) {
    const rawId = String(videoId).replace("pexels-", "");
    const externalVideo = await fetchPexelsVideoById(rawId);
    if (externalVideo) {
      return {
        video: externalVideo,
        sessionVideoQuery: { video: null, externalVideoId: externalVideo._id },
        sessionVideoUpdate: { video: null, externalVideoId: externalVideo._id },
        canPersistToVideo: false
      };
    }
  }

  return null;
};

const getNotebookSession = async (req, res) => {
  try {
    const { videoId } = req.params;
    const resolved = await resolveNotebookVideo(videoId);

    if (!resolved) {
      return res.status(404).json({ message: "Video not found" });
    }

    const { video, sessionVideoQuery } = resolved;
    const ownerQuery = getNotebookOwnerQuery(req);
    const session = await NotebookSession.findOne({ ...sessionVideoQuery, ...ownerQuery }).lean();
    const { transcript } = buildNotebookSource(video);

    return res.json({
      video: {
        _id: video._id,
        title: video.title,
        description: video.description,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
      transcriptAvailable: Boolean(transcript),
      transcriptChunkCount: Number(session?.transcriptChunkCount || 0),
      aiStatus: video.aiStatus || "pending",
      aiSummary: video.aiSummary || "",
        aiLearningMode: video.aiLearningMode || "",
        aiKeyPoints: video.aiKeyPoints || [],
        aiNotes: video.aiNotes || [],
        aiError: video.aiError || ""
      },
      session: session || {
        messages: [],
        notes: [],
        keyPoints: [],
        highlights: [],
        summaryShort: video.aiLearningMode || "",
        summaryDetailed: video.aiSummary || "",
        aiNotes: video.aiNotes || [],
        transcriptChunkCount: 0
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load notebook session", error: error.message });
  }
};

const saveSummaryToVideo = async (videoId, summary) => {
  await Video.updateOne(
    { _id: videoId },
    {
      $set: {
        aiStatus: "ready",
        aiProvider: summary?.__provider === "gemini"
          ? (process.env.GEMINI_MODEL || "gemini-2.5-flash")
          : summary?.__provider === "openai"
            ? (process.env.OPENAI_MODEL || "gpt-4.1-mini")
            : "local",
        aiSummary: summary.detailedSummary || "",
        aiLearningMode: summary.shortSummary || "",
        aiKeyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints.slice(0, 8) : [],
        aiNotes: Array.isArray(summary.aiNotes) ? summary.aiNotes.slice(0, 8) : [],
        aiLastProcessedAt: new Date(),
        aiError: ""
      }
    }
  );
};

const generateSummary = async (req, res) => {
  try {
    const { videoId } = req.params;
    const resolved = await resolveNotebookVideo(videoId);

    if (!resolved) {
      return res.status(404).json({ message: "Video not found" });
    }

    const { video, sessionVideoQuery, sessionVideoUpdate, canPersistToVideo } = resolved;
    const ownerQuery = getNotebookOwnerQuery(req);
    const transcriptHash = hashText(video.transcript || "");
    const session = await NotebookSession.findOne({ ...sessionVideoQuery, ...ownerQuery });
    const summary = await summarizeVideo({
      video,
      session: session ? session.toObject() : null,
      mode: String(req.body?.mode || "detailed")
    });
    const transcriptChunkCount = canPersistToVideo
      ? await NotebookChunk.countDocuments({ video: video._id, ...ownerQuery, transcriptHash })
      : 0;

    const nextSession = await NotebookSession.findOneAndUpdate(
      { ...sessionVideoQuery, ...ownerQuery },
      {
        $set: {
          ...sessionVideoUpdate,
          videoUrl: video.videoUrl || "",
          videoTitle: video.title || "",
          transcriptSnapshot: video.transcript || "",
          transcriptHash,
          transcriptChunkCount,
          descriptionSnapshot: video.description || "",
          summaryShort: summary.shortSummary || "",
          summaryDetailed: summary.detailedSummary || "",
          keyPoints: Array.isArray(summary.keyPoints) ? summary.keyPoints : [],
          aiNotes: Array.isArray(summary.aiNotes) ? summary.aiNotes : [],
          highlights: Array.isArray(summary.highlights) ? summary.highlights : [],
          lastMode: "summary",
          lastProcessedAt: new Date()
        },
        $setOnInsert: {
          messages: [],
          notes: [],
          user: req.user?._id || null,
          clientId: req.user?._id ? "" : (getClientId(req) || "anonymous")
        }
      },
      { upsert: true, returnDocument: "after" }
    ).lean();

    if (canPersistToVideo) {
      await saveSummaryToVideo(video._id, summary);
    }

    return res.json({
      summary,
      session: nextSession,
      video: {
        _id: video._id,
        title: video.title,
        videoUrl: video.videoUrl,
        transcriptAvailable: Boolean(video.transcript)
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to generate notebook summary",
      error: error.message
    });
  }
};

const askQuestion = async (req, res) => {
  try {
    const { videoId } = req.params;
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    const resolved = await resolveNotebookVideo(videoId);
    if (!resolved) {
      return res.status(404).json({ message: "Video not found" });
    }

    const { video, sessionVideoQuery, sessionVideoUpdate, canPersistToVideo } = resolved;
    const ownerQuery = getNotebookOwnerQuery(req);
    const transcriptHash = hashText(video.transcript || "");
    const existingSession = await NotebookSession.findOne({ ...sessionVideoQuery, ...ownerQuery });

    const answer = await answerQuestion({
      video,
      session: existingSession ? existingSession.toObject() : null,
      question
    });
    const transcriptChunkCount = canPersistToVideo
      ? await NotebookChunk.countDocuments({
          video: video._id,
          ...ownerQuery,
          transcriptHash
        })
      : 0;

    const nextSession = await NotebookSession.findOneAndUpdate(
      { ...sessionVideoQuery, ...ownerQuery },
      {
        $set: {
          ...sessionVideoUpdate,
          videoUrl: video.videoUrl || "",
          videoTitle: video.title || "",
          transcriptSnapshot: video.transcript || "",
          transcriptHash,
          transcriptChunkCount,
          descriptionSnapshot: video.description || "",
          lastMode: "qa",
          lastProcessedAt: new Date()
        },
        $setOnInsert: {
          notes: [],
          user: req.user?._id || null,
          clientId: req.user?._id ? "" : (getClientId(req) || "anonymous")
        },
        $push: {
          messages: {
            $each: [
              { role: "user", content: question, mode: "qa", createdAt: new Date() },
              {
                role: "assistant",
                content: answer.answer || "",
                mode: "qa",
                keyTakeaway: answer.keyTakeaway || "",
                sources: Array.isArray(answer.sources) ? answer.sources : [],
                timestampHints: Array.isArray(answer.timestampHints) ? answer.timestampHints : [],
                createdAt: new Date()
              }
            ],
            $slice: -40
          }
        }
      },
      { upsert: true, returnDocument: "after" }
    ).lean();

    return res.json({
      answer,
      session: nextSession
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to answer notebook question",
      error: error.message
    });
  }
};

const addNote = async (req, res) => {
  try {
    const { videoId } = req.params;
    const text = String(req.body?.text || "").trim();

    if (!text) {
      return res.status(400).json({ message: "Note text is required" });
    }

    const resolved = await resolveNotebookVideo(videoId);
    if (!resolved) {
      return res.status(404).json({ message: "Video not found" });
    }

    const { video, sessionVideoQuery, sessionVideoUpdate } = resolved;
    const ownerQuery = getNotebookOwnerQuery(req);
    const note = {
      text,
      source: "user",
      createdAt: new Date()
    };

    const session = await NotebookSession.findOneAndUpdate(
      { ...sessionVideoQuery, ...ownerQuery },
      {
        $set: {
          ...sessionVideoUpdate,
          videoUrl: video.videoUrl || "",
          videoTitle: video.title || "",
          transcriptSnapshot: video.transcript || "",
          descriptionSnapshot: video.description || "",
          lastMode: "notes",
          lastProcessedAt: new Date()
        },
        $setOnInsert: {
          messages: [],
          user: req.user?._id || null,
          clientId: req.user?._id ? "" : (getClientId(req) || "anonymous")
        },
        $push: {
          notes: { $each: [note], $slice: -80 }
        }
      },
      { upsert: true, returnDocument: "after" }
    ).lean();

    return res.status(201).json({
      note,
      session
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add note", error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { videoId, noteId } = req.params;
    const resolved = await resolveNotebookVideo(videoId);
    if (!resolved) {
      return res.status(404).json({ message: "Video not found" });
    }

    const { sessionVideoQuery } = resolved;
    const ownerQuery = getNotebookOwnerQuery(req);
    const session = await NotebookSession.findOneAndUpdate(
      { ...sessionVideoQuery, ...ownerQuery },
      {
        $pull: {
          notes: { _id: noteId }
        }
      },
      { returnDocument: "after" }
    ).lean();

    return res.json({ session });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete note", error: error.message });
  }
};

module.exports = {
  getNotebookSession,
  generateSummary,
  askQuestion,
  addNote,
  deleteNote
};
