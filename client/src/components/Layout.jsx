import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const Layout = ({ children }) => {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="shell-body">
        <Sidebar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;

