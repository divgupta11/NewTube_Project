const bcrypt = require("bcryptjs");
const Video = require("../models/Video");
const Comment = require("../models/Comment");
const User = require("../models/User");
const ExternalVideoInteraction = require("../models/ExternalVideoInteraction");
const {
  fetchTrendingFromPexels,
  fetchShortsFromPexels,
  fetchPexelsVideoById,
  checkPexelsHealth
} = require("../services/pexelsService");
const {
  generateAndStoreVideoInsights,
  askQuestionAboutVideo,
  isGeminiConfigured,
  checkGeminiHealth
} = require("../services/aiService");

const hasUser = (arr, userId) => (arr || []).some((id) => id.toString() === userId);
const maxHistoryItems = 300;
const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const createVideo = async (req, res) => {
  try {
    const { title, description, tags, transcript, isShort } = req.body;

    if (!title || !req.files?.video || !req.files?.thumbnail) {
      return res.status(400).json({ message: "Title, video, and thumbnail are required" });
    }

    const parsedTags = tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
    const shortFlag = String(isShort || "").toLowerCase() === "true" || parsedTags.some((tag) => tag.toLowerCase() === "shorts");
    const videoPath = `/uploads/videos/${req.files.video[0].filename}`;
    const thumbnailPath = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;

    const video = await Video.create({
      user: req.user._id,
      title,
      description,
      transcript: typeof transcript === "string" ? transcript.trim() : "",
      tags: parsedTags,
      isShort: shortFlag,
      isTrending: false,
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

const getTrendingVideos = async (req, res) => {
  try {
    try {
      const pexelsVideos = await fetchTrendingFromPexels();
      if (pexelsVideos.length) {
        return res.json(pexelsVideos);
      }
    } catch (pexelsError) {
      console.warn("Pexels trending fallback to MongoDB:", pexelsError.message);
    }

    const trending = await Video.aggregate([
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          score: {
            $add: [
              { $multiply: [{ $ifNull: ["$views", 0] }, 1] },
              { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 50] },
              { $cond: [{ $eq: ["$isTrending", true] }, 200, 0] }
            ]
          }
        }
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: 16 }
    ]);

    const ids = trending.map((v) => v._id);
    const populated = await Video.find({ _id: { $in: ids } }).populate("user", "username avatar subscribers");
    const byId = new Map(populated.map((v) => [String(v._id), v]));

    return res.json(ids.map((id) => byId.get(String(id))).filter(Boolean));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch trending videos", error: error.message });
  }
};

const getShortVideos = async (req, res) => {
  try {
    try {
      const pexelsVideos = await fetchShortsFromPexels();
      if (pexelsVideos.length) {
        return res.json(pexelsVideos);
      }
    } catch (pexelsError) {
      console.warn("Pexels shorts fallback to MongoDB:", pexelsError.message);
    }

    const videos = await Video.find({
      $or: [
        { isShort: true },
        { tags: { $regex: "^shorts$", $options: "i" } }
      ]
    })
      .populate("user", "username avatar subscribers")
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json(videos);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch shorts", error: error.message });
  }
};

const getVideoById = async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const isPexelsId = String(req.params.id || "").startsWith("pexels-");

    if (isPexelsId) {
      const rawId = String(req.params.id).replace("pexels-", "");
      const pexelsVideo = await fetchPexelsVideoById(rawId);

      if (!pexelsVideo) {
        return res.status(404).json({ message: "Video not found" });
      }

      if (userId) {
        try {
          await User.updateOne(
            { _id: req.user._id },
            {
              $pull: { watchHistoryExternal: { source: "pexels", videoId: String(pexelsVideo._id) } }
            }
          );
          await User.updateOne(
            { _id: req.user._id },
            {
              $push: {
                watchHistoryExternal: {
                  $each: [{
                    source: "pexels",
                    videoId: String(pexelsVideo._id),
                    title: pexelsVideo.title || "",
                    thumbnailUrl: pexelsVideo.thumbnailUrl || "",
                    videoUrl: pexelsVideo.videoUrl || "",
                    channelName: pexelsVideo.user?.username || "Pexels Creator",
                    isShort: Boolean(pexelsVideo.isShort),
                    watchedAt: new Date()
                  }],
                  $position: 0,
                  $slice: maxHistoryItems
                }
              }
            }
          );
        } catch (historyError) {
          console.error("Watch history update failed:", historyError.message);
        }
      }

      return res.json({
        ...pexelsVideo,
        isExternal: true,
        source: "pexels",
        likes: [],
        dislikes: [],
        isLiked: false,
        isDisliked: false
      });
    }

    const video = await Video.findById(req.params.id).populate("user", "username avatar subscribers");
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    await Video.updateOne({ _id: video._id }, { $inc: { views: 1 } });

    const payload = video.toObject();
    payload.views = Number(payload.views || 0) + 1;
    payload.isLiked = userId ? hasUser(payload.likes, userId) : false;
    payload.isDisliked = userId ? hasUser(payload.dislikes, userId) : false;

    if (userId) {
      try {
        await User.updateOne({ _id: req.user._id }, { $pull: { watchHistory: video._id } });
        await User.updateOne(
          { _id: req.user._id },
          { $push: { watchHistory: { $each: [video._id], $position: 0, $slice: maxHistoryItems } } }
        );

        await User.updateOne(
          { _id: req.user._id },
          {
            $pull: { watchHistoryExternal: { source: "internal", videoId: String(video._id) } }
          }
        );
        await User.updateOne(
          { _id: req.user._id },
          {
            $push: {
              watchHistoryExternal: {
                $each: [{
                  source: "internal",
                  videoId: String(video._id),
                  title: payload.title || "",
                  thumbnailUrl: payload.thumbnailUrl || "",
                  videoUrl: payload.videoUrl || "",
                  channelName: payload.user?.username || "",
                  isShort: Boolean(payload.isShort),
                  watchedAt: new Date()
                }],
                $position: 0,
                $slice: maxHistoryItems
              }
            }
          }
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

const getGeminiAIHealth = async (req, res) => {
  try {
    const health = await checkGeminiHealth();
    return res.json(health);
  } catch (error) {
    return res.status(500).json({ message: "Failed to check Gemini health", error: error.message });
  }
};

const getPexelsAPIHealth = async (req, res) => {
  try {
    const health = await checkPexelsHealth();
    return res.json(health);
  } catch (error) {
    return res.status(500).json({ message: "Failed to check Pexels health", error: error.message });
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

const getShortMeta = async (req, res) => {
  try {
    const shortId = String(req.params.id || "");
    const userId = req.user?._id?.toString();

    if (isMongoId(shortId)) {
      const video = await Video.findById(shortId).select("title description likes dislikes");
      if (!video) return res.status(404).json({ message: "Short video not found" });

      const likes = video.likes || [];
      const dislikes = video.dislikes || [];

      return res.json({
        description: video.description || "",
        likesCount: likes.length,
        dislikesCount: dislikes.length,
        commentsCount: await Comment.countDocuments({ video: video._id }),
        liked: userId ? hasUser(likes, userId) : false,
        disliked: userId ? hasUser(dislikes, userId) : false
      });
    }

    const interaction = await ExternalVideoInteraction.findOne({ videoId: shortId });
    return res.json({
      description: interaction?.description || "",
      likesCount: (interaction?.likes || []).length,
      dislikesCount: (interaction?.dislikes || []).length,
      commentsCount: (interaction?.comments || []).length,
      liked: userId ? hasUser(interaction?.likes || [], userId) : false,
      disliked: userId ? hasUser(interaction?.dislikes || [], userId) : false
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch short details", error: error.message });
  }
};

const toggleShortLike = async (req, res) => {
  try {
    const shortId = String(req.params.id || "");
    const userId = req.user._id.toString();

    if (isMongoId(shortId)) {
      req.params.id = shortId;
      return toggleLikeVideo(req, res);
    }

    const interaction = await ExternalVideoInteraction.findOneAndUpdate(
      { videoId: shortId },
      { $setOnInsert: { source: "pexels", title: String(req.body?.title || "").trim(), description: String(req.body?.description || "").trim() } },
      { upsert: true, new: true }
    );

    const likes = interaction.likes || [];
    const disliked = hasUser(interaction.dislikes || [], userId);
    const liked = hasUser(likes, userId);

    if (liked) {
      interaction.likes = likes.filter((id) => id.toString() !== userId);
    } else {
      interaction.likes = likes.concat(req.user._id);
      if (disliked) {
        interaction.dislikes = (interaction.dislikes || []).filter((id) => id.toString() !== userId);
      }
    }

    await interaction.save();
    return res.json({
      likesCount: (interaction.likes || []).length,
      dislikesCount: (interaction.dislikes || []).length,
      liked: !liked,
      disliked: false
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to like short", error: error.message });
  }
};

const toggleShortDislike = async (req, res) => {
  try {
    const shortId = String(req.params.id || "");
    const userId = req.user._id.toString();

    if (isMongoId(shortId)) {
      req.params.id = shortId;
      return toggleDislikeVideo(req, res);
    }

    const interaction = await ExternalVideoInteraction.findOneAndUpdate(
      { videoId: shortId },
      { $setOnInsert: { source: "pexels", title: String(req.body?.title || "").trim(), description: String(req.body?.description || "").trim() } },
      { upsert: true, new: true }
    );

    const dislikes = interaction.dislikes || [];
    const liked = hasUser(interaction.likes || [], userId);
    const disliked = hasUser(dislikes, userId);

    if (disliked) {
      interaction.dislikes = dislikes.filter((id) => id.toString() !== userId);
    } else {
      interaction.dislikes = dislikes.concat(req.user._id);
      if (liked) {
        interaction.likes = (interaction.likes || []).filter((id) => id.toString() !== userId);
      }
    }

    await interaction.save();
    return res.json({
      likesCount: (interaction.likes || []).length,
      dislikesCount: (interaction.dislikes || []).length,
      liked: false,
      disliked: !disliked
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to dislike short", error: error.message });
  }
};

const getShortComments = async (req, res) => {
  try {
    const shortId = String(req.params.id || "");

    if (isMongoId(shortId)) {
      const comments = await Comment.find({ video: shortId })
        .populate("user", "username avatar")
        .sort({ createdAt: -1 })
        .limit(200);
      return res.json(comments.map((item) => ({
        _id: item._id,
        text: item.text,
        user: item.user,
        createdAt: item.createdAt
      })));
    }

    const interaction = await ExternalVideoInteraction.findOne({ videoId: shortId }).populate("comments.user", "username avatar");
    const comments = (interaction?.comments || []).slice().reverse().map((item) => ({
      _id: item._id,
      text: item.text,
      user: item.user,
      createdAt: item.createdAt
    }));
    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch short comments", error: error.message });
  }
};

const addShortComment = async (req, res) => {
  try {
    const shortId = String(req.params.id || "");
    const text = String(req.body?.text || "").trim();

    if (!text) return res.status(400).json({ message: "Comment text is required" });

    if (isMongoId(shortId)) {
      const video = await Video.findById(shortId);
      if (!video) return res.status(404).json({ message: "Short video not found" });

      const comment = await Comment.create({
        video: video._id,
        user: req.user._id,
        text
      });
      await comment.populate("user", "username avatar");
      return res.status(201).json(comment);
    }

    const interaction = await ExternalVideoInteraction.findOneAndUpdate(
      { videoId: shortId },
      { $setOnInsert: { source: "pexels", title: String(req.body?.title || "").trim(), description: String(req.body?.description || "").trim() } },
      { upsert: true, new: true }
    );

    interaction.comments.push({ user: req.user._id, text });
    await interaction.save();
    await interaction.populate("comments.user", "username avatar");

    const latest = interaction.comments[interaction.comments.length - 1];
    return res.status(201).json({
      _id: latest._id,
      text: latest.text,
      user: latest.user,
      createdAt: latest.createdAt
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add short comment", error: error.message });
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

const seedSampleVideos = async (req, res) => {
  try {
    const marker = "sample-seed-v1";
    const existing = await Video.find({ tags: marker }).limit(1);
    if (existing.length) {
      return res.json({ message: "Sample videos already seeded" });
    }

    let owner = await User.findOne().sort({ createdAt: 1 });

    if (!owner) {
      const hashed = await bcrypt.hash("demo123456", 10);
      owner = await User.create({
        username: "newtube_demo",
        email: "demo@newtube.local",
        password: hashed
      });
    }

    const samples = [
      {
        title: "NewTube Trending: JavaScript in 10 Minutes",
        description: "Quick overview of modern JavaScript concepts.",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        thumbnailUrl: "https://picsum.photos/seed/trending-1/1280/720",
        tags: [marker, "trending", "javascript"],
        isTrending: true,
        isShort: false,
        views: 9800
      },
      {
        title: "NewTube Trending: React Hooks Crash Course",
        description: "Understand useState and useEffect with examples.",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        thumbnailUrl: "https://picsum.photos/seed/trending-2/1280/720",
        tags: [marker, "trending", "react"],
        isTrending: true,
        isShort: false,
        views: 12400
      },
      {
        title: "NewTube Shorts: CSS Trick #1",
        description: "A super quick CSS trick for responsive layouts.",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        thumbnailUrl: "https://picsum.photos/seed/short-1/540/960",
        tags: [marker, "shorts", "css"],
        isTrending: false,
        isShort: true,
        views: 2500
      },
      {
        title: "NewTube Shorts: Git Tip in 20 Seconds",
        description: "Use stash smartly while switching branches.",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        thumbnailUrl: "https://picsum.photos/seed/short-2/540/960",
        tags: [marker, "shorts", "git"],
        isTrending: false,
        isShort: true,
        views: 1800
      }
    ];

    const docs = samples.map((item) => ({
      user: owner._id,
      title: item.title,
      description: item.description,
      transcript: "",
      videoUrl: item.videoUrl,
      thumbnailUrl: item.thumbnailUrl,
      tags: item.tags,
      isShort: item.isShort,
      isTrending: item.isTrending,
      views: item.views,
      likes: [],
      dislikes: [],
      aiStatus: "pending"
    }));

    await Video.insertMany(docs);

    return res.status(201).json({ message: "Sample trending and shorts videos created" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to seed sample videos", error: error.message });
  }
};

module.exports = {
  createVideo,
  getVideos,
  getTrendingVideos,
  getShortVideos,
  getVideoById,
  getVideoAI,
  getGeminiAIHealth,
  getPexelsAPIHealth,
  analyzeVideoAI,
  askVideoAI,
  toggleLikeVideo,
  toggleDislikeVideo,
  getShortMeta,
  toggleShortLike,
  toggleShortDislike,
  getShortComments,
  addShortComment,
  getChannelVideos,
  updateVideo,
  deleteVideo,
  seedSampleVideos
};
