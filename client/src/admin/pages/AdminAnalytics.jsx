import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";
import { fetchAnalytics } from "../adminApi";

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const data = await fetchAnalytics();
      setAnalytics(data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch analytics");
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>Advanced Analytics</h2>
        <p>Platform growth, engagement, channels, and watch trends.</p>
      </div>
      {error && <p className="admin-error-text">{error}</p>}

      <div className="admin-chart-grid">
        <section className="admin-chart-card">
          <h3>Subscriber Growth</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={analytics?.subscriberGrowth || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ff0033" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-chart-card">
          <h3>Engagement Rate %</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics?.engagementRate || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#111827" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <div className="admin-two-col">
        <section className="admin-list-card">
          <h3>Most Popular Channels</h3>
          <ul>
            {(analytics?.mostPopularChannels || []).map((channel) => (
              <li key={channel._id}>
                <strong>{channel.username}</strong>
                <span>{channel.subscribers} subscribers</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="admin-list-card">
          <h3>Most Watched Videos</h3>
          <ul>
            {(analytics?.mostWatchedVideos || []).map((video) => (
              <li key={video._id}>
                <strong>{video.title}</strong>
                <span>{video.views} views</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AdminAnalytics;
