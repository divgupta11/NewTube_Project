import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import VideoCard from "../components/VideoCard";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const Home = () => {
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const query = (searchParams.get("q") || "").trim();
        const videoUrl = query
          ? `${apiBase}/videos?search=${encodeURIComponent(query)}`
          : `${apiBase}/videos`;

        const [videosRes, trendingRes] = await Promise.all([
          axios.get(videoUrl, { headers }),
          axios.get(`${apiBase}/videos/trending`, { headers })
        ]);

        setVideos(Array.isArray(videosRes.data) ? videosRes.data : []);
        setTrending(Array.isArray(trendingRes.data) ? trendingRes.data : []);
      } catch {
        setVideos([]);
        setTrending([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [searchParams]);

  return (
    <section>
      <h1 className="section-title">Recommended Videos</h1>

      {loading ? (
        <div className="video-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div className="video-skeleton" key={idx}>
              <div className="sk-thumb" />
              <div className="sk-line" />
              <div className="sk-line short" />
            </div>
          ))}
        </div>
      ) : (
        <div className="video-grid">
          {videos.map((video) => (
            <VideoCard key={video._id} video={video} />
          ))}
        </div>
      )}

      <h2 className="section-title section-title-spaced">Trending Now</h2>
      {!trending.length ? (
        <p className="empty-text">No trending videos available right now.</p>
      ) : (
        <div className="video-grid">
          {trending.map((video) => (
            <VideoCard key={`trend-${video._id}`} video={video} />
          ))}
        </div>
      )}
    </section>
  );
};

export default Home;
