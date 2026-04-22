import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import VideoCard from "../components/VideoCard";
import { downloadAndStoreVideo, getDownloadedVideos, removeDownloadedVideo } from "../utils/downloads";
import { resolvePublicUrl } from "../utils/publicUrl";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const TABS = [
  { key: "videos", label: "Videos" },
  { key: "shorts", label: "Shorts" },
  { key: "liked", label: "Liked Videos" },
  { key: "playlists", label: "Playlists" },
  { key: "history", label: "History" },
  { key: "saved", label: "Saved" },
  { key: "downloaded", label: "Downloaded" },
  { key: "notifications", label: "Notifications" },
  { key: "subscriptions", label: "Subscriptions" }
];

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const resolveAsset = (url) => {
  return resolvePublicUrl(url);
};

const Profile = ({ user, onOpenLogin, onUserUpdated }) => {
  const [activeTab, setActiveTab] = useState("videos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [profileUser, setProfileUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [likedVideos, setLikedVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [savedVideos, setSavedVideos] = useState([]);
  const [downloadedVideos, setDownloadedVideos] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [playlistName, setPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const savedSet = useMemo(() => new Set((savedVideos || []).map((video) => video._id)), [savedVideos]);
  const regularUploadedVideos = useMemo(
    () => (uploadedVideos || []).filter((video) => !video?.isShort),
    [uploadedVideos]
  );
  const uploadedShorts = useMemo(
    () => (uploadedVideos || []).filter((video) => Boolean(video?.isShort)),
    [uploadedVideos]
  );

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist._id === selectedPlaylistId) || playlists[0] || null,
    [playlists, selectedPlaylistId]
  );

  const hydrateDownloaded = async () => {
    try {
      const rows = await getDownloadedVideos();
      setDownloadedVideos(rows);
    } catch {
      setDownloadedVideos([]);
    }
  };

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login to open your profile.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.get(`${apiBase}/users/profile`, { headers: authHeaders() });
      setProfileUser(data.user || null);
      setStats(data.stats || null);
      setUploadedVideos(Array.isArray(data.uploadedVideos) ? data.uploadedVideos : []);
      setLikedVideos(Array.isArray(data.likedVideos) ? data.likedVideos : []);
      setPlaylists(Array.isArray(data.playlists) ? data.playlists : []);
      setSavedVideos(Array.isArray(data.savedVideos) ? data.savedVideos : []);
      setWatchHistory(Array.isArray(data.watchHistory) ? data.watchHistory : []);
      setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : []);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setDescriptionDraft(data.user?.channelDescription || "");
      setAvatarFile(null);
      setAvatarPreview("");
      setSelectedPlaylistId((prev) => prev || data.playlists?.[0]?._id || "");
      setError("");

      if (typeof onUserUpdated === "function" && data.user) {
        onUserUpdated({
          ...data.user,
          name: data.user.username,
          subscribersCount: data.user.subscribersCount
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [onUserUpdated]);

  useEffect(() => {
    fetchProfile();
    hydrateDownloaded();
  }, [fetchProfile]);

  useEffect(() => () => {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
  }, [avatarPreview]);

  const saveDescription = async () => {
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("channelDescription", descriptionDraft);
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const { data } = await axios.patch(`${apiBase}/users/profile`, formData, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data"
        }
      });

      setMessage(avatarFile ? "Profile updated." : "Channel description updated.");
      const nextUser = {
        ...(profileUser || user || {}),
        channelDescription: descriptionDraft.trim(),
        avatar: data?.avatar || profileUser?.avatar || user?.avatar || ""
      };

      setProfileUser((prev) => ({
        ...prev,
        ...nextUser
      }));

      if (typeof onUserUpdated === "function") {
        onUserUpdated(nextUser);
      }

      setAvatarFile(null);
      setAvatarPreview("");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update profile.");
    }
  };

  const createPlaylist = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!playlistName.trim()) {
      setMessage("Playlist name is required.");
      return;
    }

    try {
      const { data } = await axios.post(
        `${apiBase}/users/playlists`,
        { name: playlistName.trim() },
        { headers: authHeaders() }
      );
      const created = data.playlist;
      setPlaylists((prev) => [created, ...prev]);
      setSelectedPlaylistId(created._id);
      setPlaylistName("");
      setMessage("Playlist created.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to create playlist.");
    }
  };

  const addVideoToPlaylist = async (playlistId, videoId) => {
    if (!playlistId) {
      setMessage("Create or select a playlist first.");
      return;
    }

    setMessage("");
    try {
      await axios.post(`${apiBase}/users/playlists/${playlistId}/videos/${videoId}`, {}, { headers: authHeaders() });
      await fetchProfile();
      setActiveTab("playlists");
      setSelectedPlaylistId(playlistId);
      setMessage("Video added to playlist.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to add video to playlist.");
    }
  };

  const removeVideoFromPlaylist = async (playlistId, videoId) => {
    setMessage("");
    try {
      await axios.delete(`${apiBase}/users/playlists/${playlistId}/videos/${videoId}`, { headers: authHeaders() });
      await fetchProfile();
      setSelectedPlaylistId(playlistId);
      setMessage("Video removed from playlist.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to remove video from playlist.");
    }
  };

  const toggleSaveVideo = async (videoId) => {
    setMessage("");
    try {
      await axios.post(`${apiBase}/users/saved/${videoId}`, {}, { headers: authHeaders() });
      await fetchProfile();
      setMessage("Saved videos updated.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update saved videos.");
    }
  };

  const removeHistoryVideo = async (videoId) => {
    setMessage("");
    try {
      await axios.delete(`${apiBase}/users/history/${videoId}`, { headers: authHeaders() });
      await fetchProfile();
      setMessage("Video removed from history.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update history.");
    }
  };

  const toggleSubscribe = async (channelId) => {
    setMessage("");
    try {
      await axios.post(`${apiBase}/users/subscribe/${channelId}`, {}, { headers: authHeaders() });
      await fetchProfile();
      setMessage("Subscriptions updated.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update subscription.");
    }
  };

  const markAllNotificationsRead = async () => {
    setMessage("");
    try {
      const { data } = await axios.patch(`${apiBase}/users/notifications/read`, {}, { headers: authHeaders() });
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setStats((prev) => ({
        ...(prev || {}),
        unreadNotifications: Number(data.unreadCount || 0)
      }));
      setMessage("Notifications marked as read.");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update notifications.");
    }
  };

  const handleDownloadVideo = async (video) => {
    setMessage("");
    try {
      await downloadAndStoreVideo(video, window.location.origin);
      await hydrateDownloaded();
      setMessage("Video downloaded and added to Downloaded Videos.");
    } catch (err) {
      setMessage(err.message || "Failed to download video.");
    }
  };

  const handleRemoveDownloaded = async (videoId) => {
    setMessage("");
    try {
      await removeDownloadedVideo(videoId);
      await hydrateDownloaded();
      setMessage("Downloaded video removed.");
    } catch {
      setMessage("Failed to remove downloaded video.");
    }
  };

  const renderVideoGrid = (videos, options = {}) => {
    if (!videos.length) {
      return <p className="empty-text">No videos found in this section.</p>;
    }

    return (
      <div className="profile-video-grid">
        {videos.map((video) => {
          const isSaved = savedSet.has(video._id);
          const videoUrl = resolveAsset(video.videoUrl || video.url);

          return (
            <article key={`${options.playlistId || "section"}-${video._id}`} className="profile-video-cell">
              {options.downloadedMode ? (
                <a className="video-card" href={videoUrl} target="_blank" rel="noreferrer">
                  <div className="video-thumb-wrap">
                    <img className="video-thumb" src={resolveAsset(video.thumbnailUrl)} alt={video.title} />
                  </div>
                  <div className="video-card-content">
                    <span className="channel-avatar" aria-hidden="true">D</span>
                    <div className="video-meta">
                      <h3>{video.title}</h3>
                      <p>{video.user?.username || "Downloaded"}</p>
                      <span>Downloaded</span>
                    </div>
                  </div>
                </a>
              ) : (
                <VideoCard video={video} />
              )}
              <div className="profile-video-actions">
                {!options.downloadedMode && (
                  <button type="button" onClick={() => toggleSaveVideo(video._id)}>
                    {isSaved ? "Remove Saved" : "Save"}
                  </button>
                )}
                {!options.disablePlaylistAction && !options.downloadedMode && (
                  <button
                    type="button"
                    onClick={() => addVideoToPlaylist(selectedPlaylist?._id, video._id)}
                  >
                    Add To Playlist
                  </button>
                )}
                {options.playlistId && (
                  <button type="button" onClick={() => removeVideoFromPlaylist(options.playlistId, video._id)}>
                    Remove
                  </button>
                )}
                {options.historyMode && (
                  <button type="button" onClick={() => removeHistoryVideo(video.historyKey || video._id)}>
                    Remove History
                  </button>
                )}
                {options.downloadedMode ? (
                  <button type="button" onClick={() => handleRemoveDownloaded(video._id)}>Remove Downloaded</button>
                ) : (
                  <button type="button" onClick={() => handleDownloadVideo({ ...video, videoUrl })}>Download Video</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  if (!user) {
    return (
      <section className="profile-page">
        <p className="empty-text">Please login to access your profile.</p>
        <button className="profile-primary-btn" type="button" onClick={onOpenLogin}>Login</button>
      </section>
    );
  }

  if (loading) {
    return <p className="empty-text">Loading profile...</p>;
  }

  if (error) {
    return <p className="empty-text">{error}</p>;
  }

  return (
    <section className="profile-page">
      <header className="profile-header-card">
        <label className="profile-avatar-upload-shell" htmlFor="profile-avatar-input">
          <input
            id="profile-avatar-input"
            className="profile-avatar-input"
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
          {(avatarPreview || profileUser?.avatar) ? (
            <img
              className="profile-cover-avatar"
              src={avatarPreview || resolveAsset(profileUser?.avatar)}
              alt={profileUser?.username || "Profile"}
            />
          ) : (
            <div className="profile-avatar-placeholder">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 4.5 10.5 3h3L15 4.5h2.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17V7a2.5 2.5 0 0 1 2.5-2.5H9Zm3 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
              </svg>
              <span>Upload Photo</span>
            </div>
          )}
        </label>
        <div className="profile-header-main">
          <h1>{profileUser?.username || "My Channel"}</h1>
          {profileUser?.email && <p className="profile-sub-line">{profileUser.email}</p>}
          <div className="profile-stat-row">
            <span>{profileUser?.subscribersCount || 0} subscribers</span>
            <span>{stats?.totalVideosUploaded || 0} videos</span>
            <span>{stats?.totalLikedVideos || 0} liked</span>
            <span>{stats?.totalPlaylists || 0} playlists</span>
          </div>
          <div className="profile-description-box">
            <textarea
              rows="2"
              placeholder="Add your channel description"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
            />
            <button type="button" className="profile-primary-btn profile-compact-btn" onClick={saveDescription}>
              {avatarFile ? "Save Profile" : "Save Description"}
            </button>
          </div>
        </div>
      </header>

      <nav className="profile-tabs" aria-label="Profile Tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {message && <p className="empty-text">{message}</p>}

      {activeTab === "videos" && (
        <div>
          <h2 className="section-title">Your Uploaded Videos</h2>
          {renderVideoGrid(regularUploadedVideos)}
        </div>
      )}

      {activeTab === "shorts" && (
        <div>
          <h2 className="section-title">Your Shorts</h2>
          {renderVideoGrid(uploadedShorts)}
        </div>
      )}

      {activeTab === "liked" && (
        <div>
          <h2 className="section-title">Liked Videos</h2>
          {renderVideoGrid(likedVideos, { disablePlaylistAction: true })}
        </div>
      )}

      {activeTab === "playlists" && (
        <div className="playlist-layout">
          <aside className="playlist-side">
            <h2 className="section-title">Playlists</h2>
            <form className="playlist-create-form" onSubmit={createPlaylist}>
              <input
                type="text"
                placeholder="Create new playlist"
                value={playlistName}
                onChange={(event) => setPlaylistName(event.target.value)}
              />
              <button className="profile-primary-btn" type="submit">Create</button>
            </form>
            <div className="playlist-list">
              {playlists.map((playlist) => (
                <button
                  key={playlist._id}
                  type="button"
                  className={`playlist-item ${selectedPlaylist?._id === playlist._id ? "active" : ""}`}
                  onClick={() => setSelectedPlaylistId(playlist._id)}
                >
                  <strong>{playlist.name}</strong>
                  <span>{playlist.totalVideos || playlist.videos?.length || 0} videos</span>
                </button>
              ))}
              {!playlists.length && <p className="empty-text">No playlists yet. Create your first playlist.</p>}
            </div>
          </aside>
          <section className="playlist-main">
            <h2 className="section-title">{selectedPlaylist?.name || "Select a playlist"}</h2>
            {selectedPlaylist
              ? renderVideoGrid(selectedPlaylist.videos || [], { playlistId: selectedPlaylist._id })
              : <p className="empty-text">Select a playlist to view its videos.</p>}
          </section>
        </div>
      )}

      {activeTab === "history" && (
        <div>
          <h2 className="section-title">Watch History (Latest First)</h2>
          {renderVideoGrid(watchHistory, { historyMode: true })}
        </div>
      )}

      {activeTab === "saved" && (
        <div>
          <h2 className="section-title">Saved / Watch Later</h2>
          {renderVideoGrid(savedVideos, { disablePlaylistAction: true })}
        </div>
      )}

      {activeTab === "downloaded" && (
        <div>
          <h2 className="section-title">Downloaded Videos</h2>
          {renderVideoGrid(downloadedVideos, { downloadedMode: true, disablePlaylistAction: true })}
        </div>
      )}

      {activeTab === "subscriptions" && (
        <div>
          <h2 className="section-title">Subscribed Channels</h2>
          <div className="subscription-grid">
            {subscriptions.map((channel) => (
              <article key={channel._id} className="subscription-card">
                <img
                  src={resolveAsset(channel.avatar) || "https://i.pravatar.cc/120?img=4"}
                  alt={channel.username}
                />
                <div>
                  <h3>{channel.username}</h3>
                  <p>{channel.subscribersCount || 0} subscribers</p>
                  <p>{channel.totalVideosUploaded || 0} videos uploaded</p>
                </div>
                <button type="button" onClick={() => toggleSubscribe(channel._id)}>Unsubscribe</button>
              </article>
            ))}
            {!subscriptions.length && <p className="empty-text">No subscriptions yet.</p>}
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div>
          <div className="history-header">
            <h2 className="section-title">Upload Notifications</h2>
            <button
              className="profile-primary-btn profile-compact-btn history-clear-btn"
              type="button"
              onClick={markAllNotificationsRead}
              disabled={!notifications.some((item) => !item.isRead)}
            >
              Mark all read
            </button>
          </div>
          <div className="notification-grid">
            {notifications.map((item) => (
              <article key={item._id} className={`notification-card ${item.isRead ? "read" : "unread"}`}>
                <img src={resolveAsset(item.thumbnailUrl)} alt={item.videoTitle} />
                <div>
                  <p className="notification-label">{item.channelName} uploaded a new video</p>
                  <h3>{item.videoTitle}</h3>
                  <a href={item.watchUrl}>Watch now</a>
                </div>
              </article>
            ))}
            {!notifications.length && <p className="empty-text">No notifications yet.</p>}
          </div>
        </div>
      )}
    </section>
  );
};

export default Profile;
