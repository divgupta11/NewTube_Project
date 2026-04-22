import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import VideoCard from "../components/VideoCard";
import { resolvePublicUrl } from "../utils/publicUrl";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const History = ({ user, onOpenLogin }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${apiBase}/users/history`, { headers: authHeaders() });
      setVideos(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load watch history.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [user]);

  const removeHistory = async (videoId) => {
    await axios.delete(`${apiBase}/users/history/${videoId}`, { headers: authHeaders() });
    setVideos((prev) => prev.filter((video) => (video.historyKey || video._id) !== videoId));
  };

  const clearHistory = async () => {
    const confirmed = window.confirm("Are you sure you want to clear your watch history?");
    if (!confirmed) return;

    try {
      setClearing(true);
      await axios.delete(`${apiBase}/users/history`, { headers: authHeaders() });
      setVideos([]);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to clear watch history.");
    } finally {
      setClearing(false);
    }
  };

  if (!user) {
    return (
      <section>
        <p className="empty-text">Login to view your watch history.</p>
        <button type="button" className="profile-primary-btn" onClick={onOpenLogin}>Login</button>
      </section>
    );
  }

  if (loading) return <p className="empty-text">Loading history...</p>;
  if (error) return <p className="empty-text">{error}</p>;

  return (
    <section>
      <div className="history-header">
        <h1 className="section-title">Watch History</h1>
        <button
          type="button"
          className="profile-primary-btn history-clear-btn"
          onClick={clearHistory}
          disabled={clearing || !videos.length}
        >
          {clearing ? "Clearing..." : "Clear History"}
        </button>
      </div>
      {!videos.length ? (
        <p className="empty-text">Your watch history is empty.</p>
      ) : (
        <div className="profile-video-grid">
          {videos.map((video) => {
            const url = resolvePublicUrl(video.videoUrl || video.url);
            return (
              <article key={video._id} className="profile-video-cell">
                <VideoCard video={video} />
                <div className="profile-video-actions">
                  <button type="button" onClick={() => removeHistory(video.historyKey || video._id)}>Remove History</button>
                  <Link to={`/watch/${video._id}`}>Watch</Link>
                  <a href={url} download target="_blank" rel="noreferrer">Download Video</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default History;
