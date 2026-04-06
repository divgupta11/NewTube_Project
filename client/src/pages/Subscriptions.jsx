import { useEffect, useState } from "react";
import axios from "axios";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const Subscriptions = ({ user, onOpenLogin }) => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${apiBase}/users/subscriptions`, { headers: authHeaders() });
      setChannels(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load subscriptions.");
      setChannels([]);
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
  }, [user?._id]);

  const unsubscribe = async (channelId) => {
    await axios.post(`${apiBase}/users/subscribe/${channelId}`, {}, { headers: authHeaders() });
    setChannels((prev) => prev.filter((channel) => channel._id !== channelId));
  };

  if (!user) {
    return (
      <section>
        <p className="empty-text">Login to view your subscriptions.</p>
        <button type="button" className="profile-primary-btn" onClick={onOpenLogin}>Login</button>
      </section>
    );
  }

  if (loading) return <p className="empty-text">Loading subscriptions...</p>;
  if (error) return <p className="empty-text">{error}</p>;

  return (
    <section>
      <h1 className="section-title">Subscriptions</h1>
      <div className="subscription-grid">
        {channels.map((channel) => (
          <article key={channel._id} className="subscription-card">
            <img src={channel.avatar || "https://i.pravatar.cc/120?img=5"} alt={channel.username} />
            <div>
              <h3>{channel.username}</h3>
              <p>{channel.subscribersCount || 0} subscribers</p>
              <p>{channel.totalVideosUploaded || 0} uploaded videos</p>
            </div>
            <button type="button" onClick={() => unsubscribe(channel._id)}>Unsubscribe</button>
          </article>
        ))}
        {!channels.length && <p className="empty-text">You have not subscribed to any channels yet.</p>}
      </div>
    </section>
  );
};

export default Subscriptions;
