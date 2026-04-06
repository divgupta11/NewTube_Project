const mongoose = require("mongoose");
const User = require("../models/User");
const Video = require("../models/Video");

const subscribersCount = (subscribers) => {
  if (Array.isArray(subscribers)) return subscribers.length;
  return Number(subscribers || 0);
};

const normalizeVideoOwner = (videoDoc) => {
  if (!videoDoc) return null;
  const video = videoDoc.toObject ? videoDoc.toObject() : videoDoc;

  if (video.user && typeof video.user === "object") {
    video.user.subscribersCount = subscribersCount(video.user.subscribers);
  }

  return video;
};

const toObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(String(id));
};

const maxHistoryItems = 300;

const normalizeExternalHistoryItem = (item) => ({
  _id: item.videoId,
  historyKey: `external:${item._id}`,
  title: item.title || "External Video",
  description: item.source === "internal" ? "Watched video" : `Source: ${item.source || "external"}`,
  transcript: "",
  videoUrl: item.videoUrl || "",
  thumbnailUrl: item.thumbnailUrl || "",
  tags: [item.source || "external", item.isShort ? "shorts" : ""].filter(Boolean),
  isShort: Boolean(item.isShort),
  isTrending: false,
  views: 0,
  createdAt: item.watchedAt || new Date(),
  watchedAt: item.watchedAt || new Date(),
  isExternal: true,
  source: item.source || "external",
  user: {
    _id: `history-${item.source || "external"}`,
    username: item.channelName || "Channel",
    avatar: "",
    subscribers: []
  }
});

const buildCombinedHistory = (user, internalVideos = []) => {
  const internalMap = new Map((internalVideos || []).map((video) => [String(video._id), normalizeVideoOwner(video)]));
  const externalTimeline = Array.isArray(user.watchHistoryExternal) ? user.watchHistoryExternal : [];

  const combined = externalTimeline
    .map((entry) => {
      if (entry.source === "internal") {
        const internal = internalMap.get(String(entry.videoId));
        if (!internal) return null;
        return {
          ...internal,
          historyKey: `external:${entry._id}`,
          watchedAt: entry.watchedAt || null,
          isExternal: false,
          source: "internal"
        };
      }

      return normalizeExternalHistoryItem(entry);
    })
    .filter(Boolean);

  if (combined.length) {
    return combined;
  }

  // Legacy fallback for users without watchHistoryExternal timeline yet.
  return (internalVideos || []).map((video) => ({
    ...normalizeVideoOwner(video),
    historyKey: `internal:${video._id}`,
    watchedAt: null,
    isExternal: false,
    source: "internal"
  }));
};

const toggleSubscribe = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.channelId);
    const currentUser = await User.findById(req.user._id);

    if (!targetUser) {
      return res.status(404).json({ message: "Channel not found" });
    }

    if (targetUser._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ message: "You cannot subscribe to yourself" });
    }

    const subscribedChannels = Array.isArray(currentUser.subscribedChannels) ? currentUser.subscribedChannels : [];
    const subscribed = subscribedChannels.some((id) => id.toString() === targetUser._id.toString());

    if (subscribed) {
      currentUser.subscribedChannels = subscribedChannels.filter(
        (id) => id.toString() !== targetUser._id.toString()
      );

      if (Array.isArray(targetUser.subscribers)) {
        targetUser.subscribers = targetUser.subscribers.filter(
          (id) => id.toString() !== currentUser._id.toString()
        );
      } else {
        targetUser.subscribers = Math.max(0, Number(targetUser.subscribers || 0) - 1);
      }
    } else {
      currentUser.subscribedChannels = subscribedChannels.concat(targetUser._id);

      if (Array.isArray(targetUser.subscribers)) {
        targetUser.subscribers = targetUser.subscribers.concat(currentUser._id);
      } else {
        targetUser.subscribers = Number(targetUser.subscribers || 0) + 1;
      }
    }

    await currentUser.save();
    await targetUser.save();

    return res.json({
      subscribed: !subscribed,
      subscribersCount: subscribersCount(targetUser.subscribers)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to subscribe", error: error.message });
  }
};

const getChannelById = async (req, res) => {
  try {
    const channel = await User.findById(req.params.channelId).select("username avatar subscribers createdAt");

    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    const isSubscribed = Boolean(
      req.user && Array.isArray(req.user.subscribedChannels)
      && req.user.subscribedChannels.some((id) => id.toString() === channel._id.toString())
    );

    return res.json({
      _id: channel._id,
      username: channel.username,
      avatar: channel.avatar,
      subscribersCount: subscribersCount(channel.subscribers),
      createdAt: channel.createdAt,
      isSubscribed
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch channel", error: error.message });
  }
};

const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("username email avatar subscribers channelDescription subscribedChannels playlists likedVideos savedVideos watchHistory watchHistoryExternal")
      .populate({ path: "likedVideos", populate: { path: "user", select: "username avatar subscribers" } })
      .populate({ path: "savedVideos", populate: { path: "user", select: "username avatar subscribers" } })
      .populate({ path: "watchHistory", populate: { path: "user", select: "username avatar subscribers" } })
      .populate({ path: "playlists.videos", populate: { path: "user", select: "username avatar subscribers" } })
      .populate("subscribedChannels", "username avatar subscribers");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const uploadedVideos = await Video.find({ user: user._id })
      .populate("user", "username avatar subscribers")
      .sort({ createdAt: -1 });

    const subscriptions = (user.subscribedChannels || []).map((channel) => ({
      _id: channel._id,
      username: channel.username,
      avatar: channel.avatar,
      subscribersCount: subscribersCount(channel.subscribers),
      totalVideosUploaded: 0
    }));

    const subscriptionIds = subscriptions.map((item) => toObjectId(item._id)).filter(Boolean);

    if (subscriptionIds.length) {
      const uploadStats = await Video.aggregate([
        { $match: { user: { $in: subscriptionIds } } },
        { $group: { _id: "$user", total: { $sum: 1 } } }
      ]);

      const uploadsMap = new Map(uploadStats.map((item) => [String(item._id), Number(item.total || 0)]));
      subscriptions.forEach((channel) => {
        channel.totalVideosUploaded = uploadsMap.get(String(channel._id)) || 0;
      });
    }

    const playlists = (user.playlists || []).map((playlist) => ({
      _id: playlist._id,
      name: playlist.name,
      totalVideos: (playlist.videos || []).length,
      videos: (playlist.videos || []).map(normalizeVideoOwner).filter(Boolean)
    }));

    const likedVideos = (user.likedVideos || []).map(normalizeVideoOwner).filter(Boolean);
    const savedVideos = (user.savedVideos || []).map(normalizeVideoOwner).filter(Boolean);
    const watchHistory = buildCombinedHistory(user, user.watchHistory || []);

    return res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email || "",
        avatar: user.avatar,
        channelDescription: user.channelDescription || "",
        subscribersCount: subscribersCount(user.subscribers)
      },
      stats: {
        totalVideosUploaded: uploadedVideos.length,
        totalLikedVideos: likedVideos.length,
        totalSavedVideos: savedVideos.length,
        totalPlaylists: playlists.length,
        totalHistoryItems: watchHistory.length,
        totalSubscriptions: subscriptions.length
      },
      uploadedVideos: uploadedVideos.map(normalizeVideoOwner),
      likedVideos,
      playlists,
      savedVideos,
      watchHistory,
      subscriptions
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
};

const updateProfileDetails = async (req, res) => {
  try {
    const { channelDescription } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof channelDescription === "string") {
      user.channelDescription = channelDescription.trim();
    }

    if (req.file?.filename) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();

    return res.json({
      message: "Profile updated",
      channelDescription: user.channelDescription || "",
      avatar: user.avatar || ""
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
};

const createPlaylist = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.playlists.push({ name: String(name).trim(), videos: [] });
    await user.save();

    const created = user.playlists[user.playlists.length - 1];

    return res.status(201).json({
      message: "Playlist created",
      playlist: {
        _id: created._id,
        name: created.name,
        totalVideos: 0,
        videos: []
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create playlist", error: error.message });
  }
};

const addVideoToPlaylist = async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: "Invalid video id" });
    }

    const [user, video] = await Promise.all([
      User.findById(req.user._id),
      Video.findById(videoId)
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const playlist = user.playlists.id(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const exists = (playlist.videos || []).some((id) => id.toString() === videoId);
    if (!exists) {
      playlist.videos.push(video._id);
      await user.save();
    }

    return res.json({
      message: exists ? "Video already exists in playlist" : "Video added to playlist",
      playlistId: playlist._id,
      totalVideos: (playlist.videos || []).length
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update playlist", error: error.message });
  }
};

const removeVideoFromPlaylist = async (req, res) => {
  try {
    const { playlistId, videoId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const playlist = user.playlists.id(playlistId);

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    playlist.videos = (playlist.videos || []).filter((id) => id.toString() !== String(videoId));
    await user.save();

    return res.json({
      message: "Video removed from playlist",
      playlistId: playlist._id,
      totalVideos: (playlist.videos || []).length
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove video from playlist", error: error.message });
  }
};

const toggleSavedVideo = async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: "Invalid video id" });
    }

    const [user, video] = await Promise.all([
      User.findById(req.user._id),
      Video.findById(videoId)
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const savedVideos = Array.isArray(user.savedVideos) ? user.savedVideos : [];
    const alreadySaved = savedVideos.some((id) => id.toString() === video._id.toString());

    if (alreadySaved) {
      user.savedVideos = savedVideos.filter((id) => id.toString() !== video._id.toString());
    } else {
      user.savedVideos = [video._id].concat(savedVideos.filter((id) => id.toString() !== video._id.toString()));
    }

    await user.save();

    return res.json({
      saved: !alreadySaved,
      totalSavedVideos: user.savedVideos.length
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update saved videos", error: error.message });
  }
};

const recordWatchHistory = async (req, res) => {
  try {
    const {
      videoId,
      source = "external",
      title = "",
      thumbnailUrl = "",
      videoUrl = "",
      channelName = "",
      isShort = false
    } = req.body || {};

    if (!videoId || !String(videoId).trim()) {
      return res.status(400).json({ message: "videoId is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const normalizedSource = String(source || "external").trim().toLowerCase();
    const normalizedVideoId = String(videoId).trim();

    if (normalizedSource === "internal") {
      if (!mongoose.Types.ObjectId.isValid(normalizedVideoId)) {
        return res.status(400).json({ message: "Invalid internal video id" });
      }

      const internalId = new mongoose.Types.ObjectId(normalizedVideoId);
      user.watchHistory = (user.watchHistory || []).filter((id) => id.toString() !== normalizedVideoId);
      user.watchHistory.unshift(internalId);
      user.watchHistory = user.watchHistory.slice(0, maxHistoryItems);
    }

    const existingExternal = Array.isArray(user.watchHistoryExternal) ? user.watchHistoryExternal : [];
    user.watchHistoryExternal = existingExternal.filter(
      (item) => !(String(item.videoId) === normalizedVideoId && String(item.source || "external") === normalizedSource)
    );

    user.watchHistoryExternal.unshift({
      source: normalizedSource,
      videoId: normalizedVideoId,
      title: String(title || "").trim(),
      thumbnailUrl: String(thumbnailUrl || "").trim(),
      videoUrl: String(videoUrl || "").trim(),
      channelName: String(channelName || "").trim(),
      isShort: Boolean(isShort),
      watchedAt: new Date()
    });

    user.watchHistoryExternal = user.watchHistoryExternal.slice(0, maxHistoryItems);

    await user.save();

    return res.json({ message: "Watch history updated" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to record watch history", error: error.message });
  }
};

const removeHistoryVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const value = String(videoId || "");

    if (value.startsWith("external:")) {
      const externalId = value.slice("external:".length);
      user.watchHistoryExternal = (user.watchHistoryExternal || []).filter((item) => String(item._id) !== externalId);
    } else if (value.startsWith("internal:")) {
      const internalId = value.slice("internal:".length);
      user.watchHistory = (user.watchHistory || []).filter((id) => id.toString() !== internalId);
      user.watchHistoryExternal = (user.watchHistoryExternal || []).filter(
        (item) => !(String(item.source) === "internal" && String(item.videoId) === internalId)
      );
    } else {
      user.watchHistory = (user.watchHistory || []).filter((id) => id.toString() !== value);
      user.watchHistoryExternal = (user.watchHistoryExternal || []).filter(
        (item) => String(item.videoId) !== value && String(item._id) !== value
      );
    }

    await user.save();

    return res.json({ message: "Video removed from watch history" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update watch history", error: error.message });
  }
};

const clearHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.watchHistory = [];
    user.watchHistoryExternal = [];
    await user.save();

    return res.json({ message: "Watch history cleared" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear watch history", error: error.message });
  }
};

const getMyHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("watchHistory watchHistoryExternal")
      .populate({ path: "watchHistory", populate: { path: "user", select: "username avatar subscribers" } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(buildCombinedHistory(user, user.watchHistory || []));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch watch history", error: error.message });
  }
};

const getMySubscriptions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("subscribedChannels")
      .populate("subscribedChannels", "username avatar subscribers");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const subscriptions = (user.subscribedChannels || []).map((channel) => ({
      _id: channel._id,
      username: channel.username,
      avatar: channel.avatar,
      subscribersCount: subscribersCount(channel.subscribers),
      totalVideosUploaded: 0
    }));

    const subIds = subscriptions.map((item) => toObjectId(item._id)).filter(Boolean);

    if (subIds.length) {
      const uploadStats = await Video.aggregate([
        { $match: { user: { $in: subIds } } },
        { $group: { _id: "$user", total: { $sum: 1 } } }
      ]);
      const uploadsMap = new Map(uploadStats.map((item) => [String(item._id), Number(item.total || 0)]));
      subscriptions.forEach((item) => {
        item.totalVideosUploaded = uploadsMap.get(String(item._id)) || 0;
      });
    }

    return res.json(subscriptions);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch subscriptions", error: error.message });
  }
};

module.exports = {
  toggleSubscribe,
  getChannelById,
  getMyProfile,
  updateProfileDetails,
  createPlaylist,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  toggleSavedVideo,
  recordWatchHistory,
  removeHistoryVideo,
  clearHistory,
  getMyHistory,
  getMySubscriptions
};
