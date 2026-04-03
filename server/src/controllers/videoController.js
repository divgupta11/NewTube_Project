const Video = require("../models/Video");
const Comment = require("../models/Comment");
const User = require("../models/User");
const { generateAndStoreVideoInsights, askQuestionAboutVideo, isGeminiConfigured } = require("../services/aiService");

const hasUser = (arr, userId) => (arr || []).some((id) => id.toString() === userId);

const createVideo = async (req, res) => {
  try {
    const { title, description, tags, transcript } = req.body;

    if (!title || !req.files?.video || !req.files?.thumbnail) {
      return res.status(400).json({ message: "Title, video, and thumbnail are required" });
    }

    const videoPath = `/uploads/videos/${req.files.video[0].filename}`;
    const thumbnailPath = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;

    const video = await Video.create({
      user: req.user._id,
      title,
      description,
      transcript: typeof transcript === "string" ? transcript.trim() : "",
      tags: tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      videoUrl: videoPath,
      thumbnailUrl: thumbnailPath,
      aiStatus: "pending"
    });

    setTimeout(async () => {
      try {
        await generateAndStoreVideoInsights(video._id);
      } catch (error) {
        await Video.updateOne(
          { _id: video._id },
          { aiStatus: "error", aiError: error.message }
        );
      }
    }, 0);

    const populatedVideo = await Video.findById(video._id).populate("user", "username avatar");
    return res.status(201).json(populatedVideo);
  } catch (error) {
    return res.status(500).json({ message: "Video upload failed", error: error.message });
  }
};

const getVideos = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { tags: { $regex: search, $options: "i" } }
        ]
      };
    }

    const videos = await Video.find(query)
      .populate("user", "username avatar subscribers")
      .sort({ createdAt: -1 });

    return res.json(videos);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch videos", error: error.message });
  }
};

const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate("user", "username avatar subscribers");
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Use atomic increment to avoid validation issues on legacy documents.
    await Video.updateOne({ _id: video._id }, { $inc: { views: 1 } });

    const userId = req.user?._id?.toString();
    const payload = video.toObject();
    payload.views = Number(payload.views || 0) + 1;
    payload.isLiked = userId ? hasUser(payload.likes, userId) : false;
    payload.isDisliked = userId ? hasUser(payload.dislikes, userId) : false;

    if (userId) {
      try {
        // Avoid MongoDB update path conflict by splitting pull/push into separate operations.
        await User.updateOne(
          { _id: req.user._id },
          { $pull: { watchHistory: video._id } }
        );
        await User.updateOne(
          { _id: req.user._id },
          { $push: { watchHistory: { $each: [video._id], $position: 0, $slice: 300 } } }
        );
      } catch (historyError) {
        console.error("Watch history update failed:", historyError.message);
      }
    }

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch video", error: error.message });
  }
};

const getVideoAI = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).select(
      "aiStatus aiProvider aiSummary aiKeyPoints aiNotes aiLearningMode aiError aiLastProcessedAt"
    );
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    return res.json({
      status: video.aiStatus || "pending",
      provider: video.aiProvider || "",
      geminiConfigured: isGeminiConfigured(),
      summary: video.aiSummary || "",
      keyPoints: video.aiKeyPoints || [],
      notes: video.aiNotes || [],
      learningMode: video.aiLearningMode || "",
      error: video.aiError || "",
      updatedAt: video.aiLastProcessedAt || null
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch AI insights", error: error.message });
  }
};

const analyzeVideoAI = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    video.aiStatus = "pending";
    video.aiError = "";
    await video.save();

    const payload = await generateAndStoreVideoInsights(video._id);
    return res.json(payload);
  } catch (error) {
    await Video.updateOne(
      { _id: req.params.id },
      { aiStatus: "error", aiError: error.message }
    );
    return res.status(500).json({ message: "Failed to analyze video with AI", error: error.message });
  }
};

const askVideoAI = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !String(question).trim()) {
      return res.status(400).json({ message: "Question is required" });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const response = await askQuestionAboutVideo(video, String(question).trim());
    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: "Failed to answer question", error: error.message });
  }
};

const toggleLikeVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const userId = req.user._id.toString();
    const likes = video.likes || [];
    const dislikes = video.dislikes || [];
    const liked = hasUser(likes, userId);

    if (liked) {
      video.likes = likes.filter((id) => id.toString() !== userId);
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { likedVideos: video._id } }
      );
    } else {
      video.likes = likes.concat(req.user._id);
      video.dislikes = dislikes.filter((id) => id.toString() !== userId);
      await User.updateOne(
        { _id: req.user._id },
        {
          $addToSet: { likedVideos: video._id },
          $pull: { dislikedVideos: video._id }
        }
      );
    }

    await video.save();
    return res.json({
      likesCount: (video.likes || []).length,
      dislikesCount: (video.dislikes || []).length,
      liked: !liked,
      disliked: false
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to like video", error: error.message });
  }
};

const toggleDislikeVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const userId = req.user._id.toString();
    const likes = video.likes || [];
    const dislikes = video.dislikes || [];
    const disliked = hasUser(dislikes, userId);

    if (disliked) {
      video.dislikes = dislikes.filter((id) => id.toString() !== userId);
      await User.updateOne(
        { _id: req.user._id },
        { $pull: { dislikedVideos: video._id } }
      );
    } else {
      video.dislikes = dislikes.concat(req.user._id);
      video.likes = likes.filter((id) => id.toString() !== userId);
      await User.updateOne(
        { _id: req.user._id },
        {
          $addToSet: { dislikedVideos: video._id },
          $pull: { likedVideos: video._id }
        }
      );
    }

    await video.save();
    return res.json({
      likesCount: (video.likes || []).length,
      dislikesCount: (video.dislikes || []).length,
      liked: false,
      disliked: !disliked
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to dislike video", error: error.message });
  }
};

const getChannelVideos = async (req, res) => {
  try {
    const videos = await Video.find({ user: req.params.channelId })
      .populate("user", "username avatar subscribers")
      .sort({ createdAt: -1 });

    return res.json(videos);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch channel videos", error: error.message });
  }
};

const updateVideo = async (req, res) => {
  try {
    const { title, description, transcript } = req.body;
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    if (video.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    if (typeof title === "string" && title.trim()) {
      video.title = title.trim();
    }

    if (typeof description === "string") {
      video.description = description.trim();
    }

    if (typeof transcript === "string") {
      video.transcript = transcript.trim();
    }

    await video.save();
    const populated = await Video.findById(video._id).populate("user", "username avatar subscribers");
    return res.json(populated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update video", error: error.message });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    if (video.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await Comment.deleteMany({ video: video._id });
    await video.deleteOne();

    return res.json({ message: "Video deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete video", error: error.message });
  }
};

module.exports = {
  createVideo,
  getVideos,
  getVideoById,
  getVideoAI,
  analyzeVideoAI,
  askVideoAI,
  toggleLikeVideo,
  toggleDislikeVideo,
  getChannelVideos,
  updateVideo,
  deleteVideo
};
