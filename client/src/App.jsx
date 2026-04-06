import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import axios from "axios";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import LoginModal from "./components/LoginModal";
import SignupModal from "./components/SignupModal";
import Home from "./pages/Home";
import WatchVideo from "./pages/WatchVideo";
import UploadVideo from "./pages/UploadVideo";
import Profile from "./pages/Profile";
import History from "./pages/History";
import Subscriptions from "./pages/Subscriptions";
import Shorts from "./pages/Shorts";
import Trending from "./pages/Trending";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import AdminLayout from "./admin/AdminLayout";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminUsers from "./admin/pages/AdminUsers";
import AdminVideos from "./admin/pages/AdminVideos";
import AdminComments from "./admin/pages/AdminComments";
import AdminAnalytics from "./admin/pages/AdminAnalytics";
import AdminSettings from "./admin/pages/AdminSettings";
import "./styles/admin.css";

const MOBILE_BREAKPOINT = 768;
const apiBase = import.meta.env.VITE_API_URL || "/api";

const UserAppShell = ({
  user,
  theme,
  collapsed,
  mobileSidebarOpen,
  onToggleTheme,
  onMenuClick,
  onOpenLogin,
  onOpenSignup,
  onLogout,
  onCloseMobileSidebar,
  onUserUpdated
}) => (
  <div className="app-container">
    <Navbar
      user={user}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onMenuClick={onMenuClick}
      onOpenLogin={onOpenLogin}
      onOpenSignup={onOpenSignup}
      onLogout={onLogout}
    />

    <div className="layout-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={onCloseMobileSidebar}
      />

      <main className="main-content" onClick={() => mobileSidebarOpen && onCloseMobileSidebar()}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shorts" element={<Shorts />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/history" element={<History user={user} onOpenLogin={onOpenLogin} />} />
          <Route path="/subscriptions" element={<Subscriptions user={user} onOpenLogin={onOpenLogin} />} />
          <Route path="/watch/:videoId" element={<WatchVideo user={user} />} />
          <Route path="/upload" element={<UploadVideo user={user} onOpenLogin={onOpenLogin} />} />
          <Route
            path="/profile"
            element={<Profile user={user} onOpenLogin={onOpenLogin} onUserUpdated={onUserUpdated} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  </div>
);

const App = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("yt_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem("yt_user");
    return cached ? JSON.parse(cached) : null;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("yt_theme", theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || user) return;

    const hydrateUser = async () => {
      try {
        const { data } = await axios.get(`${apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(data);
        localStorage.setItem("yt_user", JSON.stringify(data));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("yt_user");
      }
    };

    hydrateUser();
  }, [user]);

  const handleMenuClick = () => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setMobileSidebarOpen((prev) => !prev);
      return;
    }

    setCollapsed((prev) => !prev);
  };

  const openLogin = () => {
    setShowSignup(false);
    setShowLogin(true);
  };

  const openSignup = () => {
    setShowLogin(false);
    setShowSignup(true);
  };

  const closeModals = () => {
    setShowLogin(false);
    setShowSignup(false);
  };

  const loginUser = (payload) => {
    setUser(payload.user);
    localStorage.setItem("token", payload.token);
    localStorage.setItem("yt_user", JSON.stringify(payload.user));
    closeModals();
  };

  const logoutUser = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("yt_user");
  };

  const updateUserProfile = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("yt_user", JSON.stringify(updatedUser));
  };

  return (
    <>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="videos" element={<AdminVideos />} />
          <Route path="comments" element={<AdminComments />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
        <Route
          path="*"
          element={
            <UserAppShell
              user={user}
              theme={theme}
              collapsed={collapsed}
              mobileSidebarOpen={mobileSidebarOpen}
              onToggleTheme={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              onMenuClick={handleMenuClick}
              onOpenLogin={openLogin}
              onOpenSignup={openSignup}
              onLogout={logoutUser}
              onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
              onUserUpdated={updateUserProfile}
            />
          }
        />
      </Routes>
      {showLogin && <LoginModal onClose={closeModals} onSwitch={openSignup} onLogin={loginUser} />}
      {showSignup && <SignupModal onClose={closeModals} onSwitch={openLogin} onSignup={loginUser} />}
    </>
  );
};

export default App;
