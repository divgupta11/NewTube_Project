import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MdArrowBack, MdDelete, MdEdit, MdSave } from "react-icons/md";
import { deleteUserById, fetchUserById, updateUserById } from "../adminApi";
import { resolvePublicUrl } from "../../utils/publicUrl";

const AdminUserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    username: "",
    email: "",
    channelDescription: ""
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await fetchUserById(userId);
        setProfile(data);
        setDraft({
          username: data?.user?.username || "",
          email: data?.user?.email || "",
          channelDescription: data?.user?.channelDescription || ""
        });
        setAvatarFile(null);
        setAvatarPreview("");
        setEditing(false);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const joinedDate = useMemo(() => {
    const value = profile?.user?.createdAt;
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  }, [profile?.user?.createdAt]);

  if (loading) {
    return <p className="empty-text">Loading profile...</p>;
  }

  if (error) {
    return <p className="admin-error-text">{error}</p>;
  }

  if (!profile?.user) {
    return <p className="empty-text">User not found.</p>;
  }

  const { user, stats, uploadedVideos } = profile;

  const saveProfile = async () => {
    try {
      const formData = new FormData();
      formData.append("username", draft.username);
      formData.append("email", draft.email);
      formData.append("channelDescription", draft.channelDescription);
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const updated = await updateUserById(userId, formData);
      setProfile(updated);
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update user profile");
    }
  };

  const removeUser = async () => {
    const ok = window.confirm("Delete this user and all of their content?");
    if (!ok) return;

    try {
      await deleteUserById(userId);
      navigate("/admin/users");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head split">
        <div>
          <button className="admin-back-btn" type="button" onClick={() => navigate("/admin/users")}>
            <MdArrowBack size={18} />
            Back to users
          </button>
          <h2>{user.username}</h2>
          <p>Complete admin view of this account.</p>
        </div>
      </div>

      <div className="admin-profile-hero">
        <div className="admin-profile-avatar">
          {editing ? (
            <label className="admin-avatar-upload-shell" htmlFor="admin-profile-avatar">
              <input
                id="admin-profile-avatar"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  if (avatarPreview) {
                    URL.revokeObjectURL(avatarPreview);
                  }
                  setAvatarFile(file);
                  setAvatarPreview(file ? URL.createObjectURL(file) : "");
                }}
              />
              {(avatarPreview || user.avatar) ? (
                <img src={avatarPreview || resolvePublicUrl(user.avatar)} alt={user.username} />
              ) : (
                <span>{(user.username || "U").slice(0, 1).toUpperCase()}</span>
              )}
            </label>
          ) : user.avatar ? (
            <img src={resolvePublicUrl(user.avatar)} alt={user.username} />
          ) : (
            <span>{(user.username || "U").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="admin-profile-summary">
          <div className="admin-profile-title-row">
            <h3>{user.fullName || user.username}</h3>
            <span className={`pill ${user.isBlocked ? "bad" : "good"}`}>{user.isBlocked ? "Blocked" : "Active"}</span>
          </div>
          {editing ? (
            <div className="edit-stack">
              <input value={draft.username} onChange={(e) => setDraft((p) => ({ ...p, username: e.target.value }))} placeholder="Username" />
              <input value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} placeholder="Email" />
              <textarea
                rows="3"
                value={draft.channelDescription}
                onChange={(e) => setDraft((p) => ({ ...p, channelDescription: e.target.value }))}
                placeholder="Channel description"
              />
            </div>
          ) : (
            <>
              <p>{user.channelDescription || "No bio available."}</p>
              <div className="admin-profile-meta">
                <span>Username: {user.username}</span>
                <span>Email: {user.email}</span>
                {joinedDate && <span>Joined: {joinedDate}</span>}
                <span>Subscribers: {user.subscribersCount || 0}</span>
                <span>{user.isAdmin ? "Admin account" : "Regular account"}</span>
              </div>
            </>
          )}
          <div className="action-row">
            {editing ? (
              <>
                <button className="admin-primary-btn" type="button" onClick={saveProfile}>
                  <MdSave size={18} />
                  Save changes
                </button>
                <button type="button" className="icon-btn" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="icon-btn" type="button" onClick={() => setEditing(true)} title="Edit user">
                  <MdEdit size={18} />
                </button>
                <button className="icon-btn danger" type="button" onClick={removeUser} title="Delete user">
                  <MdDelete size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="admin-cards-grid">
        <div className="admin-stat-card">
          <div>
            <p>Total videos</p>
            <strong>{stats?.totalVideosUploaded || 0}</strong>
          </div>
          <span>Content</span>
        </div>
        <div className="admin-stat-card">
          <div>
            <p>Saved videos</p>
            <strong>{stats?.totalSavedVideos || 0}</strong>
          </div>
          <span>Library</span>
        </div>
        <div className="admin-stat-card">
          <div>
            <p>Playlists</p>
            <strong>{stats?.totalPlaylists || 0}</strong>
          </div>
          <span>Collections</span>
        </div>
        <div className="admin-stat-card">
          <div>
            <p>Watch history</p>
            <strong>{stats?.totalWatchHistory || 0}</strong>
          </div>
          <span>Activity</span>
        </div>
      </div>

      <div className="admin-two-col">
        <div className="admin-list-card">
          <h3>Recent uploads</h3>
          {uploadedVideos?.length ? (
            <ul className="admin-profile-video-list">
              {uploadedVideos.slice(0, 8).map((video) => (
                <li key={video._id}>
                  <div>
                    <strong>{video.title}</strong>
                    <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                  </div>
                  <Link className="admin-secondary-link" to={`/watch/${video._id}`}>
                    View
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-line">No uploads yet.</p>
          )}
        </div>

        <div className="admin-list-card">
          <h3>Activity</h3>
          <ul className="admin-profile-activity-list">
            <li>
              <span>Recent uploads</span>
              <strong>{uploadedVideos?.slice(0, 6).length || 0}</strong>
            </li>
            <li>
              <span>Liked videos</span>
              <strong>{stats?.totalLikedVideos || 0}</strong>
            </li>
            <li>
              <span>Watch history items</span>
              <strong>{stats?.totalHistoryItems || 0}</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AdminUserProfile;
