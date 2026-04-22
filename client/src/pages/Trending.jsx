import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import VideoCard from "../components/VideoCard";
import { resolvePublicUrl } from "../utils/publicUrl";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const Trending = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${apiBase}/videos/trending`);
        setVideos(Array.isArray(data) ? data : []);
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <p className="empty-text">Loading trending videos...</p>;

  return (
    <section>
      <h1 className="section-title">Trending Videos</h1>
      {!videos.length ? (
        <p className="empty-text">No trending videos available right now.</p>
      ) : (
        <div className="profile-video-grid">
          {videos.map((video) => {
            const videoSrc = resolvePublicUrl(video.videoUrl || video.url);
            return (
              <article key={video._id} className="profile-video-cell">
                <VideoCard video={video} />
                <div className="profile-video-actions">
                  <Link to={`/watch/${video._id}`}>Watch</Link>
                  <a href={videoSrc} download target="_blank" rel="noreferrer">Download Video</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default Trending;
