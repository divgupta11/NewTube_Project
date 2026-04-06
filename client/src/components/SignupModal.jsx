import { useState } from "react";
import axios from "axios";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const SignupModal = ({ onClose, onSwitch, onSignup }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, password: form.password };
      const { data } = await axios.post(`${apiBase}/auth/signup`, payload);
      onSignup(data);
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose} type="button">&times;</button>
        <h2>Signup</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            type="text"
            placeholder="Name"
            required
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
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
          <input
            type="password"
            placeholder="Confirm password"
            required
            value={form.confirmPassword}
            onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
          />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="modal-submit ripple" disabled={loading}>
            {loading ? "Creating account..." : "Signup"}
          </button>
        </form>
        <div className="social-row">
          <button
            type="button"
            className="social-btn ripple social-btn-disabled"
            title="Google signup is not configured yet"
            onClick={() => setError("Google signup is not configured yet.")}
          >
            Google (Coming Soon)
          </button>
          <button
            type="button"
            className="social-btn ripple social-btn-disabled"
            title="GitHub signup is not configured yet"
            onClick={() => setError("GitHub signup is not configured yet.")}
          >
            GitHub (Coming Soon)
          </button>
        </div>
        <p className="switch-line">
          Already have an account? <button onClick={onSwitch} type="button">Login</button>
        </p>
      </div>
    </div>
  );
};

export default SignupModal;

