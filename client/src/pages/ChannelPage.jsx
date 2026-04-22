import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import VideoCard from "../components/VideoCard";
import { resolvePublicUrl } from "../utils/publicUrl";

const ChannelPage = () => {
  const { channelId } = useParams();
  const { user } = useAuth();

  const [channel, setChannel] = useState(null);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        const [channelRes, videosRes] = await Promise.all([
          api.get(`/users/channel/${channelId}`),
          api.get(`/videos/channel/${channelId}`)
        ]);
        setChannel(channelRes.data);
        setVideos(videosRes.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchChannelData();
  }, [channelId]);

  const toggleSubscribe = async () => {
    if (!user) return;

    const { data } = await api.patch(`/users/subscribe/${channelId}`);
    setChannel((prev) => ({
      ...prev,
      isSubscribed: data.subscribed,
      subscribersCount: data.subscribersCount
    }));
  };

  if (!channel) return <p className="state-message">Loading channel...</p>;

  return (
    <section>
      <div className="channel-hero">
        <img src={resolvePublicUrl(channel.avatar)} alt={channel.username} />
        <div>
          <h1>{channel.username}</h1>
          <p>{channel.subscribersCount} subscribers</p>
          {user && user._id !== channel._id && (
            <button className="solid-btn" type="button" onClick={toggleSubscribe}>
              {channel.isSubscribed ? "Subscribed" : "Subscribe"}
            </button>
          )}
        </div>
      </div>

      <h2 className="page-title">Channel Videos</h2>
      {videos.length === 0 ? (
        <p className="state-message">No videos uploaded yet.</p>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <VideoCard key={video._id} video={video} />
          ))}
        </div>
      )}
    </section>
  );
};

export default ChannelPage;

