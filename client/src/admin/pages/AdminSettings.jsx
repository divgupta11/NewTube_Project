const AdminSettings = () => {
  const adminUser = JSON.parse(localStorage.getItem("newtube_admin_user") || "null");

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <h2>Settings</h2>
        <p>Admin preferences and system info.</p>
      </div>

      <section className="admin-list-card">
        <h3>Admin Account</h3>
        <ul>
          <li>
            <strong>Name</strong>
            <span>{adminUser?.username || "Admin"}</span>
          </li>
          <li>
            <strong>Email</strong>
            <span>{adminUser?.email || "divyanshi15@gmail.com"}</span>
          </li>
          <li>
            <strong>Theme</strong>
            <span>You can toggle light/dark mode from the topbar.</span>
          </li>
          <li>
            <strong>Realtime Refresh</strong>
            <span>Dashboard and analytics auto-refresh every 30 seconds.</span>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default AdminSettings;
