import axios from "axios";

const apiBase = import.meta.env.VITE_API_URL || "/api";
const adminTokenKey = "newtube_admin_token";

export const getAdminToken = () => localStorage.getItem(adminTokenKey);
export const setAdminToken = (token) => localStorage.setItem(adminTokenKey, token);
export const clearAdminToken = () => localStorage.removeItem(adminTokenKey);

export const adminApi = axios.create({
  baseURL: `${apiBase}/admin`
});

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const adminLoginRequest = async (payload) => {
  const { data } = await adminApi.post("/auth/login", payload);
  return data;
};

export const fetchOverview = async () => {
  const { data } = await adminApi.get("/overview");
  return data;
};

export const fetchAnalytics = async () => {
  const { data } = await adminApi.get("/analytics");
  return data;
};

export const fetchUsers = async (params) => {
  const { data } = await adminApi.get("/users", { params });
  return data;
};

export const updateUserBlock = async (id, blocked) => {
  const { data } = await adminApi.patch(`/users/${id}/block`, { blocked });
  return data;
};

export const deleteUserById = async (id) => {
  const { data } = await adminApi.delete(`/users/${id}`);
  return data;
};

export const fetchVideos = async (params) => {
  const { data } = await adminApi.get("/videos", { params });
  return data;
};

export const updateVideoById = async (id, payload) => {
  const { data } = await adminApi.patch(`/videos/${id}`, payload);
  return data;
};

export const deleteVideoById = async (id) => {
  const { data } = await adminApi.delete(`/videos/${id}`);
  return data;
};

export const fetchComments = async (params) => {
  const { data } = await adminApi.get("/comments", { params });
  return data;
};

export const deleteCommentById = async (id) => {
  const { data } = await adminApi.delete(`/comments/${id}`);
  return data;
};
