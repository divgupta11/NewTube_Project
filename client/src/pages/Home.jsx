import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import VideoCard from "../components/VideoCard";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const Home = () => {
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setLoading(true);
        const q = searchParams.get("q") || "";
        const endpoint = q ? `${apiBase}/videos?search=${encodeURIComponent(q)}` : `${apiBase}/videos`;
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { data } = await axios.get(endpoint, { headers });
        setVideos(Array.isArray(data) ? data : []);
      } catch {
        setVideos([]);
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
    </section>
  );
};

export default Home;
