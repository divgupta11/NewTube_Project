import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { MdMenu, MdSearch, MdVideoCall, MdNotifications, MdLightMode, MdDarkMode } from "react-icons/md";
import { AiOutlineUser } from "react-icons/ai";
import { FaYoutube } from "react-icons/fa";

const Navbar = ({ user, theme, onToggleTheme, onMenuClick, onOpenLogin, onOpenSignup, onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

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
        <button className="nav-icon-btn" type="button" aria-label="Notifications">
          <MdNotifications size={24} />
        </button>

        {user ? (
          <>
            <button
              className="profile-chip"
              type="button"
              aria-label="Profile"
              onClick={() => navigate("/profile")}
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.username || user.name || "User"} className="profile-chip-avatar" />
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
