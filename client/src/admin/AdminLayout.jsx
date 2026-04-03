import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  MdDashboard,
  MdPeople,
  MdOndemandVideo,
  MdComment,
  MdAnalytics,
  MdSettings,
  MdMenu,
  MdDarkMode,
  MdLightMode,
  MdLogout
} from "react-icons/md";
import { clearAdminToken } from "./adminApi";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: MdDashboard },
  { to: "/admin/users", label: "Users", icon: MdPeople },
  { to: "/admin/videos", label: "Videos", icon: MdOndemandVideo },
  { to: "/admin/comments", label: "Comments", icon: MdComment },
  { to: "/admin/analytics", label: "Analytics", icon: MdAnalytics },
  { to: "/admin/settings", label: "Settings", icon: MdSettings }
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("newtube_admin_theme") || "dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", theme);
    localStorage.setItem("newtube_admin_theme", theme);
  }, [theme]);

  const logout = () => {
    clearAdminToken();
    localStorage.removeItem("newtube_admin_user");
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className={`admin-root ${collapsed ? "collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <button onClick={() => setCollapsed((prev) => !prev)} className="icon-btn" type="button">
            <MdMenu size={20} />
          </button>
          <h1>NewTube Admin</h1>
        </div>

        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `admin-nav-link ${isActive ? "active" : ""}`}>
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="admin-main-shell">
        <header className="admin-topbar">
          <button className="icon-btn" type="button" onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}>
            {theme === "dark" ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
          </button>
          <button className="icon-btn danger" type="button" onClick={logout}>
            <MdLogout size={20} />
          </button>
        </header>

        <div className="admin-content-area">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
