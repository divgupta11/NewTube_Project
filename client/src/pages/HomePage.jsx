import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/client";
import VideoCard from "../components/VideoCard";

const HomePage = () => {
  const { query } = useParams();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const endpoint = query ? `/videos?search=${query}` : "/videos";
        const { data } = await api.get(endpoint);
        setVideos(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [query]);

  if (loading) return <p className="state-message">Loading videos...</p>;

  return (
    <section>
      <h1 className="page-title">{query ? `Search: ${query}` : "Recommended"}</h1>
      {videos.length === 0 ? (
        <p className="state-message">No videos found.</p>
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

export default HomePage;

