const Comment = require("../models/Comment");

const addComment = async (req, res) => {
  try {
    const { text, commentText } = req.body;
    const value = text || commentText;

    if (!value) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const comment = await Comment.create({
      video: req.params.videoId,
      user: req.user._id,
      text: value
    });

    const populated = await comment.populate("user", "username avatar");
    return res.status(201).json(populated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
};

const getCommentsByVideo = async (req, res) => {
  try {
    const comments = await Comment.find({ video: req.params.videoId })
      .populate("user", "username avatar")
      .sort({ createdAt: -1 });

    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch comments", error: error.message });
  }
};

const toggleLikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const userId = req.user._id.toString();
    const liked = comment.likes.some((id) => id.toString() === userId);

    if (liked) {
      comment.likes = comment.likes.filter((id) => id.toString() !== userId);
    } else {
      comment.likes.push(req.user._id);
    }

    await comment.save();
    return res.json({ likesCount: comment.likes.length, liked: !liked });
  } catch (error) {
    return res.status(500).json({ message: "Failed to like comment", error: error.message });
  }
};

module.exports = { addComment, getCommentsByVideo, toggleLikeComment };
