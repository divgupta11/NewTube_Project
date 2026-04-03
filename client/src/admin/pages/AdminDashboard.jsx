import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { MdPeople, MdOndemandVideo, MdThumbUp, MdThumbDown, MdComment, MdSubscriptions, MdVisibility } from "react-icons/md";
import { fetchOverview, fetchAnalytics } from "../adminApi";

const numberFormat = (value) => Number(value || 0).toLocaleString();

const DASH_COLORS = ["#ff0033", "#1f2937"];

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [overviewData, analyticsData] = await Promise.all([fetchOverview(), fetchAnalytics()]);
      setOverview(overviewData.totals);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const likesPieData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: "Likes", value: analytics.likesVsDislikes.likes || 0 },
      { name: "Dislikes", value: analytics.likesVsDislikes.dislikes || 0 }
    ];
  }, [analytics]);

  const cards = [
    { title: "Total Users", value: overview?.totalUsers, icon: MdPeople },
    { title: "Total Videos", value: overview?.totalVideos, icon: MdOndemandVideo },
    { title: "Total Likes", value: overview?.totalLikes, icon: MdThumbUp },
    { title: "Total Dislikes", value: overview?.totalDislikes, icon: MdThumbDown },
    { title: "Total Comments", value: overview?.totalComments, icon: MdComment },
    { title: "Total Subscribers", value: overview?.totalSubscribers, icon: MdSubscriptions },
    { title: "Total Views", value: overview?.totalViews, icon: MdVisibility }
  ];

  if (loading) {
    return <div className="admin-page"><p>Loading dashboard...</p></div>;
  }

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>Dashboard Overview</h2>
        <p>Live platform metrics for NewTube.</p>
      </div>

      {error && <p className="admin-error-text">{error}</p>}

      <div className="admin-cards-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="admin-stat-card">
              <div>
                <p>{card.title}</p>
                <strong>{numberFormat(card.value)}</strong>
              </div>
              <span><Icon size={24} /></span>
            </article>
          );
        })}
      </div>

      <div className="admin-chart-grid">
        <section className="admin-chart-card">
          <h3>Daily Active Users</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={analytics?.dailyActiveUsers || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#ff0033" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-chart-card">
          <h3>Video Upload Growth</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics?.videoUploads || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#ff0033" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-chart-card">
          <h3>Likes vs Dislikes</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={likesPieData} dataKey="value" nameKey="name" outerRadius={90} label>
                {likesPieData.map((_, index) => (
                  <Cell key={index} fill={DASH_COLORS[index % DASH_COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-chart-card">
          <h3>Video Views Growth</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics?.videoViewsGrowth || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" hide />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#ff0033" fill="rgba(255,0,51,0.2)" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
