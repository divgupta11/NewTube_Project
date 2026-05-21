import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { MdMenu, MdSearch, MdVideoCall, MdNotifications, MdLightMode, MdDarkMode } from "react-icons/md";
import { AiOutlineUser } from "react-icons/ai";
import api from "../api/client";
import NotificationDropdown from "./NotificationDropdown";
import { resolvePublicUrl } from "../utils/publicUrl";

const NewTubeMark = () => (
  <span className="newtube-mark" aria-hidden="true">
    <svg viewBox="0 0 64 64" role="presentation" focusable="false">
      <defs>
        <linearGradient id="newtube-body" x1="10" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff6a5f" />
          <stop offset="46%" stopColor="#ff2d2d" />
          <stop offset="100%" stopColor="#c40000" />
        </linearGradient>
        <linearGradient id="newtube-glow" x1="12" y1="10" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#7fe6ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="newtube-side" x1="20" y1="32" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7b0000" />
          <stop offset="100%" stopColor="#320000" />
        </linearGradient>
      </defs>
      <path
        d="M14 18.5C14 15.4624 16.4624 13 19.5 13H41.2C42.7131 13 44.1667 13.5712 45.272 14.5964L54.072 22.752C55.3885 23.9725 56.1343 25.6877 56.1343 27.4842V44.5C56.1343 47.5376 53.6719 50 50.6343 50H19.5C16.4624 50 14 47.5376 14 44.5V18.5Z"
        fill="url(#newtube-side)"
        opacity="0.95"
      />
      <path
        d="M11 14.5C11 11.4624 13.4624 9 16.5 9H38.2C39.7131 9 41.1667 9.57118 42.272 10.5964L51.072 18.752C52.3885 19.9725 53.1343 21.6877 53.1343 23.4842V40.5C53.1343 43.5376 50.6719 46 47.6343 46H16.5C13.4624 46 11 43.5376 11 40.5V14.5Z"
        fill="url(#newtube-body)"
      />
      <path
        d="M13.4 13.4C13.4 11.9545 14.5545 10.8 16 10.8H37.6C38.4 10.8 39.1743 11.0982 39.7714 11.6391L48.5714 19.5948C49.2969 20.2526 49.7143 21.1847 49.7143 22.1631V24.1C49.7143 26.2 48.0143 27.9 45.9143 27.9H18.9C15.8437 27.9 13.4 25.4563 13.4 22.4V13.4Z"
        fill="#ffffff"
        opacity="0.14"
      />
      <path
        d="M18.5 18.1C18.5 16.4275 19.8642 15.0667 21.5344 15.1L37.1 15.4C37.6994 15.412 38.2715 15.6503 38.705 16.0678L43.8 20.9796C44.282 21.4442 44.55 22.0834 44.55 22.7486V37.4C44.55 39.0725 43.1858 40.4333 41.5156 40.4L21.4156 40.0C19.7454 39.9667 18.5 38.606 18.5 36.9343V18.1Z"
        fill="url(#newtube-glow)"
      />
      <path d="M30.5 22.5L39.5 28L30.5 33.5V22.5Z" fill="#ffffff" />
      <path
        d="M11 14.5C11 11.4624 13.4624 9 16.5 9H38.2C39.7131 9 41.1667 9.57118 42.272 10.5964L51.072 18.752C52.3885 19.9725 53.1343 21.6877 53.1343 23.4842V40.5C53.1343 43.5376 50.6719 46 47.6343 46H16.5C13.4624 46 11 43.5376 11 40.5V14.5Z"
        fill="none"
        stroke="#f7fbff"
        strokeOpacity="0.22"
        strokeWidth="1.2"
      />
    </svg>
  </span>
);

const Navbar = ({ user, theme, onToggleTheme, onMenuClick, onOpenLogin, onOpenSignup, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) {
        setUnreadCount(0);
        return;
      }
      try {
        const { data } = await api.get("/notifications");
        // Count unread from the items
        const count = Array.isArray(data) ? data.filter(n => !n.isRead).length : 0;
        setUnreadCount(count);
      } catch (err) {
        console.warn("Failed to fetch notification count", err);
      }
    };

    fetchUnreadCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSearch = (event) => {
    event.preventDefault();
    navigate(`/?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="nav-icon-btn" onClick={onMenuClick} type="button" aria-label="Toggle menu">
          <MdMenu size={24} />
        </button>
        <Link to="/" className="brand-logo">
          <NewTubeMark />
          <span className="brand-wordmark">
            <strong>NewTube</strong>
            <span className="brand-badge">LM</span>
          </span>
        </Link>
      </div>

      <form className="navbar-search" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
        />
        <button type="submit" aria-label="Search">
          <MdSearch size={22} />
        </button>
      </form>

      <div className="navbar-right">
        <button className="nav-icon-btn" onClick={onToggleTheme} type="button" aria-label="Toggle theme">
          {theme === "dark" ? <MdLightMode size={22} /> : <MdDarkMode size={22} />}
        </button>
        <Link className="nav-icon-btn" to="/upload" aria-label="Upload">
          <MdVideoCall size={24} />
        </Link>

        {user && (
          <div className="notifications-container">
            <button
              className={`nav-icon-btn notification-trigger ${notificationsOpen ? "active" : ""}`}
              type="button"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <MdNotifications size={24} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <NotificationDropdown
                onClose={() => setNotificationsOpen(false)}
                onUnreadChange={setUnreadCount}
              />
            )}
          </div>
        )}

        {user ? (
          <>
            <button
              className="profile-chip"
              type="button"
              aria-label="Profile"
              onClick={() => navigate("/profile")}
            >
              {user.avatar ? (
                <img
                  src={resolvePublicUrl(user.avatar)}
                  alt={user.username || user.name || "User"}
                  className="profile-chip-avatar"
                />
              ) : (
                <AiOutlineUser size={18} />
              )}
              <span>{user.username?.split(" ")[0] || user.name?.split(" ")[0] || "User"}</span>
            </button>
            <button className="auth-btn" type="button" onClick={onLogout}>Logout</button>
          </>
        ) : (
          <>
            <button className="auth-btn" type="button" onClick={onOpenLogin}>Login</button>
            <button className="auth-btn auth-btn-primary" type="button" onClick={onOpenSignup}>Signup</button>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
