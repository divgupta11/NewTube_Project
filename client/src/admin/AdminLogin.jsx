import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MdLockOutline } from "react-icons/md";
import { adminLoginRequest, setAdminToken } from "./adminApi";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "divyanshi15@gmail.com", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = await adminLoginRequest(form);
      setAdminToken(payload.token);
      localStorage.setItem("newtube_admin_user", JSON.stringify(payload.admin));
      const destination = location.state?.from || "/admin/dashboard";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-head">
          <span className="admin-logo-dot">N</span>
          <div>
            <h1>NewTube Admin</h1>
            <p>Secure dashboard access</p>
          </div>
        </div>

        <label>Email</label>
        <input
          value={form.email}
          onChange={(event) => onChange("email", event.target.value)}
          type="email"
          required
          placeholder="Admin email"
        />

        <label>Password</label>
        <input
          value={form.password}
          onChange={(event) => onChange("password", event.target.value)}
          type="password"
          required
          placeholder="Enter password"
        />

        {error && <p className="admin-error-text">{error}</p>}

        <button className="admin-primary-btn" type="submit" disabled={loading}>
          <MdLockOutline size={18} />
          {loading ? "Signing in..." : "Login as Admin"}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
