import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const SignupPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const { data } = await api.post("/auth/signup", formData);
      login(data);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    }
  };

  return (
    <section className="auth-shell">
      <h1>Create Account</h1>
      <form className="auth-card" onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={formData.username}
          onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
          required
        />
        {error && <p className="form-error">{error}</p>}
        <button className="solid-btn" type="submit">Sign up</button>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </section>
  );
};

export default SignupPage;

