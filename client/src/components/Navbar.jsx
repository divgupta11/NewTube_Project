import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { MdMenu, MdSearch, MdVideoCall, MdNotifications, MdLightMode, MdDarkMode } from "react-icons/md";
import { AiOutlineUser } from "react-icons/ai";
import { FaYoutube } from "react-icons/fa";
import api from "../api/client";
import NotificationDropdown from "./NotificationDropdown";
import { resolvePublicUrl } from "../utils/publicUrl";

const Navbar = ({ user, theme, onToggleTheme, onMenuClick, onOpenLogin, onOpenSignup, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
          <FaYoutube className="yt-logo-icon" />
          <span>NewTube</span>
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
          <div className="notifications-container" ref={dropdownRef}>
            <button
              className="nav-icon-btn"
              type="button"
              aria-label="Notifications"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                if (!notificationsOpen) setUnreadCount(0); // Optimistic clear
              }}
            >
              <MdNotifications size={24} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {notificationsOpen && (
              <NotificationDropdown onClose={() => setNotificationsOpen(false)} />
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
