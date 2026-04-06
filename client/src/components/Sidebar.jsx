import { NavLink } from "react-router-dom";
import { MdHome, MdSubscriptions, MdVideoLibrary, MdHistory, MdOutlineWhatshot, MdOutlineVideoLibrary } from "react-icons/md";

const links = [
  { to: "/", icon: MdHome, label: "Home" },
  { to: "/shorts", icon: MdOutlineVideoLibrary, label: "Shorts" },
  { to: "/subscriptions", icon: MdSubscriptions, label: "Subscriptions" },
  { to: "/profile", icon: MdVideoLibrary, label: "Library" },
  { to: "/history", icon: MdHistory, label: "History" },
  { to: "/trending", icon: MdOutlineWhatshot, label: "Trending" }
];

const Sidebar = ({ collapsed, mobileOpen, onCloseMobile }) => {
  return (
    <>
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "open" : ""}`}>
        <nav className="sidebar-links">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `side-link${isActive ? " active" : ""}`}
                onClick={onCloseMobile}
              >
                <span className="side-icon-wrap"><Icon className="side-icon" size={22} /></span>
                <span className="side-text">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className={`sidebar-overlay ${mobileOpen ? "show" : ""}`} onClick={onCloseMobile} />
    </>
  );
};

export default Sidebar;
