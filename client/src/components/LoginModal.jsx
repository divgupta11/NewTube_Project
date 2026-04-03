import { useState } from "react";
import axios from "axios";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const LoginModal = ({ onClose, onSwitch, onLogin }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${apiBase}/auth/login`, form);
      onLogin(data);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2>Login</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="modal-submit ripple" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="social-row">
          <button type="button" className="social-btn ripple">Google</button>
          <button type="button" className="social-btn ripple">GitHub</button>
        </div>

        <p className="switch-line">
          Don&apos;t have an account? <button onClick={onSwitch} type="button">Signup</button>
        </p>
      </div>
    </div>
  );
};

export default LoginModal;
