import { Link } from "react-router-dom";
import { AiOutlineUser } from "react-icons/ai";

const serverUrl = import.meta.env.VITE_SERVER_URL || "";

const formatViews = (views) => {
  const number = Number(views || 0);
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M views`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K views`;
  return `${number} views`;
};

const resolveChannel = (video) => {
  if (video.user && typeof video.user === "object") return video.user;
  if (video.owner && typeof video.owner === "object") return video.owner;
  return null;
};

const VideoCard = ({ video }) => {
  const thumbnail = video.thumbnailUrl || video.thumbnail || "";
  const thumb = thumbnail.startsWith("http") ? thumbnail : `${serverUrl}${thumbnail}`;
  const channel = resolveChannel(video);
  const channelName = channel?.username || channel?.name || video.channelName || "Channel";

  return (
    <Link to={`/watch/${video._id}`} className="video-card">
      <div className="video-thumb-wrap">
        <img className="video-thumb" src={thumb || "https://picsum.photos/640/360"} alt={video.title} />
      </div>
      <div className="video-card-content">
        <span className="channel-avatar" aria-hidden="true">
          <AiOutlineUser size={18} />
        </span>
        <div className="video-meta">
          <h3>{video.title}</h3>
          <p>{channelName}</p>
          <span>{formatViews(video.views)} | {new Date(video.createdAt || Date.now()).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
};

export default VideoCard;
