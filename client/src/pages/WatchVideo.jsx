import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { MdThumbUpOffAlt, MdThumbDownOffAlt, MdShare } from "react-icons/md";
import VideoCard from "../components/VideoCard";
import { resolvePublicUrl } from "../utils/publicUrl";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const countValue = (value) => {
  if (Array.isArray(value)) return value.length;
  return Number(value || 0);
};

const getVideoMimeType = (url) => {
  const lower = (url || "").toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "";
};

const WatchVideo = ({ user }) => {
  const navigate = useNavigate();
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [videoError, setVideoError] = useState("");
  const [recommended, setRecommended] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [likesCount, setLikesCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeError, setLikeError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [disliked, setDisliked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [manageMessage, setManageMessage] = useState("");
  const [playerError, setPlayerError] = useState("");

  const isOwner = useMemo(() => {
    if (!user || !video) return false;
    const ownerId = video.user?._id || video.owner;
    return ownerId?.toString() === user._id?.toString();
  }, [user, video]);

  const isExternalVideo = useMemo(() => Boolean(video?.isExternal), [video]);

  useEffect(() => {
    const loadData = async () => {
      setLoadingVideo(true);
      setVideoError("");
      const headers = authHeaders();

      try {
        const videoRes = await axios.get(`${apiBase}/videos/${videoId}`, { headers });
        const videoData = videoRes.data;
        setVideo(videoData);
        setEditTitle(videoData.title || "");
        setEditDescription(videoData.description || "");
        setLikesCount(countValue(videoData?.likes));
        setLiked(Boolean(videoData?.isLiked));
        setDislikesCount(countValue(videoData?.dislikes));
        setDisliked(Boolean(videoData?.isDisliked));
        setLikeError("");
        setSubscribeMessage("");
        setManageMessage("");
        setSubscribersCount(countValue(videoData?.user?.subscribers));

        const channelId = videoData?.user?._id || videoData?.owner?._id || videoData?.owner;
        if (channelId && headers.Authorization && !videoData?.isExternal) {
          try {
            const { data: channelData } = await axios.get(`${apiBase}/users/channel/${channelId}`, { headers });
            setSubscribed(Boolean(channelData.isSubscribed));
          } catch {
            setSubscribed(false);
          }
        } else {
          setSubscribed(false);
        }
      } catch (error) {
        setVideo(null);
        setRecommended([]);
        setComments([]);
        const status = error?.response?.status;
        if (status === 404) {
          setVideoError("Video not found.");
        } else if (!error?.response) {
          setVideoError("Network error. Please ensure backend is running.");
        } else {
          setVideoError(error?.response?.data?.message || "Unable to load this video.");
        }
        setLoadingVideo(false);
        return;
      }

      const [listRes, commentRes] = await Promise.allSettled([
        axios.get(`${apiBase}/videos`, { headers }),
        axios.get(`${apiBase}/comments/${videoId}`)
      ]);

      if (listRes.status === "fulfilled") {
        setRecommended((listRes.value.data || []).filter((item) => item._id !== videoId).slice(0, 8));
      } else {
        setRecommended([]);
      }

      if (commentRes.status === "fulfilled") {
        setComments(commentRes.value.data || []);
      } else {
        setComments([]);
      }

      setLoadingVideo(false);
    };

    loadData();
  }, [videoId, user?._id]);

  const submitComment = async (event) => {
    event.preventDefault();
    if (isExternalVideo) {
      setLikeError("Comments are not available for external videos.");
      return;
    }
    if (!newComment.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setLikeError("Login required to comment.");
      return;
    }

    try {
      const { data } = await axios.post(
        `${apiBase}/comments/${videoId}`,
        { commentText: newComment.trim() },
        { headers: authHeaders() }
      );

      setComments((prev) => [data, ...prev]);
      setNewComment("");
    } catch {
      setLikeError("Unable to post comment.");
    }
  };

  const handleLike = async () => {
    setLikeError("");
    if (isExternalVideo) {
      setLikeError("Likes are not available for external videos.");
      return;
    }
    const token = localStorage.getItem("token");

    if (!token) {
      setLikeError("Login with backend auth to save likes.");
      return;
    }

    try {
      const { data } = await axios.post(`${apiBase}/videos/${videoId}/like`, {}, { headers: authHeaders() });
      setLiked(Boolean(data.liked));
      setDisliked(Boolean(data.disliked));
      setLikesCount(Number(data.likesCount || 0));
      setDislikesCount(Number(data.dislikesCount || 0));
    } catch (error) {
      const message =
        error.response?.status === 401
          ? "Session expired. Please login again."
          : "Unable to like this video right now.";
      setLikeError(message);
    }
  };

  const handleDislike = async () => {
    setLikeError("");
    if (isExternalVideo) {
      setLikeError("Dislikes are not available for external videos.");
      return;
    }
    const token = localStorage.getItem("token");

    if (!token) {
      setLikeError("Login with backend auth to save dislikes.");
      return;
    }

    try {
      const { data } = await axios.post(`${apiBase}/videos/${videoId}/dislike`, {}, { headers: authHeaders() });
      setLiked(Boolean(data.liked));
      setDisliked(Boolean(data.disliked));
      setLikesCount(Number(data.likesCount || 0));
      setDislikesCount(Number(data.dislikesCount || 0));
    } catch (error) {
      const message = error.response?.data?.message
        || (error.response?.status === 401
          ? "Session expired. Please login again."
          : "Unable to dislike this video right now.");
      setLikeError(message);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/watch/${videoId}`;
    setShareMessage("");

    try {
      if (navigator.share) {
        await navigator.share({
          title: video?.title || "Watch this video",
          text: "Check out this video",
          url: shareUrl
        });
        setShareMessage("Shared successfully.");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("Video link copied to clipboard.");
        return;
      }

      setShareMessage(`Copy this link: ${shareUrl}`);
    } catch {
      setShareMessage("Unable to share right now. Please try again.");
    }
  };

  const handleSubscribe = async () => {
    setSubscribeMessage("");
    if (isExternalVideo) {
      setSubscribeMessage("Subscriptions are not available for external videos.");
      return;
    }
    const channelId = video?.user?._id || video?.owner?._id || video?.owner;
    const token = localStorage.getItem("token");

    if (!channelId) {
      setSubscribeMessage("Channel information is unavailable.");
      return;
    }

    if (!token) {
      setSubscribeMessage("Login with backend auth to subscribe.");
      return;
    }

    try {
      const { data } = await axios.post(`${apiBase}/users/subscribe/${channelId}`, {}, { headers: authHeaders() });
      setSubscribed(Boolean(data.subscribed));
      setSubscribersCount(Number(data.subscribersCount || 0));
    } catch (error) {
      const message =
        error.response?.status === 401
          ? "Session expired. Please login again."
          : error.response?.data?.message || "Unable to subscribe right now.";
      setSubscribeMessage(message);
    }
  };

  const handleSaveEdit = async () => {
    setManageMessage("");
    const token = localStorage.getItem("token");

    if (!token) {
      setManageMessage("Login required to edit video.");
      return;
    }

    if (!editTitle.trim()) {
      setManageMessage("Title cannot be empty.");
      return;
    }

    try {
      const { data } = await axios.patch(
        `${apiBase}/videos/${videoId}`,
        { title: editTitle.trim(), description: editDescription },
        { headers: authHeaders() }
      );

      setVideo((prev) => ({ ...prev, ...data, title: data.title, description: data.description }));
      setIsEditing(false);
      setManageMessage("Video updated successfully.");
    } catch (error) {
      setManageMessage(error.response?.data?.message || "Unable to update video.");
    }
  };

  const handleDeleteVideo = async () => {
    setManageMessage("");
    const token = localStorage.getItem("token");

    if (!token) {
      setManageMessage("Login required to delete video.");
      return;
    }

    const confirmDelete = window.confirm("Delete this video permanently?");
    if (!confirmDelete) return;

    try {
      await axios.delete(`${apiBase}/videos/${videoId}`, { headers: authHeaders() });
      navigate("/");
    } catch (error) {
      setManageMessage(error.response?.data?.message || "Unable to delete video.");
    }
  };

  if (loadingVideo) {
    return <p className="empty-text">Loading video...</p>;
  }

  if (!video) {
    return <p className="empty-text">{videoError || "Video not found."}</p>;
  }

  const rawVideoUrl = video.videoUrl || video.playbackUrl || video.url || "";
  const videoUrl = resolvePublicUrl(rawVideoUrl);
  const videoMimeType = getVideoMimeType(rawVideoUrl);
  const channelName = video.user?.username || video.user?.name || video.owner?.username || "Channel";

  return (
    <section className="watch-layout">
      <div className="watch-main">
        {!rawVideoUrl ? (
          <p className="empty-text">Video source is missing for this upload.</p>
        ) : (
          <video
            key={videoUrl}
            className="watch-player"
            controls
            preload="metadata"
            poster={resolvePublicUrl(video.thumbnailUrl || video.thumbnail || "")}
            onError={() => setPlayerError("This video format/codec is not supported by your browser. Upload MP4 (H.264) or WEBM.")}
            onLoadedData={() => setPlayerError("")}
          >
            <source src={videoUrl} type={videoMimeType} />
            <source src={videoUrl} />
          </video>
        )}
        {playerError && (
          <p className="empty-text">
            {playerError}{" "}
            <a href={videoUrl} target="_blank" rel="noreferrer">Open file</a>
          </p>
        )}

        {isEditing ? (
          <div className="edit-panel">
            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} placeholder="Video title" />
            <textarea
              rows="4"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              placeholder="Video description"
            />
            <div className="owner-actions">
              <button className="ripple edit-save-btn" onClick={handleSaveEdit} type="button">Save</button>
              <button className="ripple edit-cancel-btn" onClick={() => setIsEditing(false)} type="button">Cancel</button>
            </div>
          </div>
        ) : (
          <h1>{video.title}</h1>
        )}

        <div className="channel-row">
          <div>
            <p className="channel-name">{channelName}</p>
            <span className="channel-count">{subscribersCount} subscribers</span>
          </div>
          <div className="channel-actions">
            {!isOwner && (
              <button className={`subscribe-btn ${subscribed ? "subscribed" : ""}`} onClick={handleSubscribe} type="button">
                {subscribed ? "Subscribed" : "Subscribe"}
              </button>
            )}
          </div>
        </div>

        {!isEditing && <p className="video-description-text">{video.description}</p>}

        <div className="watch-actions">
          <span>{video.views || 0} views</span>
          <div>
            {!isExternalVideo && (
              <>
                <button className={`ripple ${liked ? "active-like" : ""}`} onClick={handleLike} type="button">
                  <MdThumbUpOffAlt size={18} /> {likesCount}
                </button>
                <button className={`ripple ${disliked ? "active-dislike" : ""}`} onClick={handleDislike} type="button">
                  <MdThumbDownOffAlt size={18} /> {dislikesCount}
                </button>
              </>
            )}
            <button className="ripple" onClick={handleShare} type="button"><MdShare size={18} /> Share</button>
          </div>
        </div>
        {likeError && <p className="empty-text">{likeError}</p>}
        {shareMessage && <p className="empty-text">{shareMessage}</p>}
        {subscribeMessage && <p className="empty-text">{subscribeMessage}</p>}
        {manageMessage && <p className="empty-text">{manageMessage}</p>}

        {isOwner && (
          <div className="owner-video-controls">
            <p className="owner-video-controls-title">Video Management</p>
            <div className="owner-video-controls-actions">
              <button className="ripple owner-edit-btn" onClick={() => setIsEditing((prev) => !prev)} type="button">
                {isEditing ? "Close Editor" : "Edit Video"}
              </button>
              <button className="ripple owner-delete-btn" onClick={handleDeleteVideo} type="button">Delete Video</button>
            </div>
          </div>
        )}

        {!isExternalVideo && (
          <div className="comment-section">
            <h3>Comments</h3>
            <form onSubmit={submitComment} className="comment-form">
              <input
                placeholder="Add a comment"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
              />
              <button className="ripple" type="submit">Post</button>
            </form>
            <div className="comment-list">
              {comments.map((comment) => (
                <article key={comment._id} className="comment-item">
                  <p className="comment-name">{comment.user?.username || comment.user?.name || "User"}</p>
                  <p>{comment.commentText || comment.text}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="watch-side">
        <h3>Recommended</h3>
        <div className="watch-recommend-list">
          {recommended.map((item) => (
            <VideoCard key={item._id} video={item} />
          ))}
        </div>
      </aside>
    </section>
  );
};

export default WatchVideo;




