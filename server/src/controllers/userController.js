const User = require("../models/User");

const subscribersCount = (subscribers) => {
  if (Array.isArray(subscribers)) return subscribers.length;
  return Number(subscribers || 0);
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

    return res.json({
      _id: channel._id,
      username: channel.username,
      avatar: channel.avatar,
      subscribersCount: subscribersCount(channel.subscribers),
      createdAt: channel.createdAt,
      isSubscribed: false
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch channel", error: error.message });
  }
};

module.exports = { toggleSubscribe, getChannelById };
