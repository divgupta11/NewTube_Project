import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import VideoCard from "../components/VideoCard";
import { downloadAndStoreVideo, getDownloadedVideos, removeDownloadedVideo } from "../utils/downloads";

const apiBase = import.meta.env.VITE_API_URL || "/api";
const serverUrl = import.meta.env.VITE_SERVER_URL || "";

const TABS = [
  { key: "videos", label: "Videos" },
  { key: "liked", label: "Liked Videos" },
  { key: "playlists", label: "Playlists" },
  { key: "history", label: "History" },
  { key: "saved", label: "Saved" },
  { key: "downloaded", label: "Downloaded" },
  { key: "subscriptions", label: "Subscriptions" }
];

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const resolveAsset = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${serverUrl}${url}`;
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

  const [playlistName, setPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const savedSet = useMemo(() => new Set((savedVideos || []).map((video) => video._id)), [savedVideos]);

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

  const fetchProfile = async () => {
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
      setDescriptionDraft(data.user?.channelDescription || "");
      setSelectedPlaylistId((prev) => prev || data.playlists?.[0]?._id || "");
      setError("");

      if (typeof onUserUpdated === "function" && data.user) {
        const cached = {
          ...(user || {}),
          ...data.user,
          name: data.user.username,
          subscribersCount: data.user.subscribersCount
        };
        onUserUpdated(cached);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    hydrateDownloaded();
  }, []);

  const saveDescription = async () => {
    setMessage("");
    try {
      await axios.patch(
        `${apiBase}/users/profile`,
        { channelDescription: descriptionDraft },
        { headers: authHeaders() }
      );
      setMessage("Channel description updated.");
      setProfileUser((prev) => ({ ...prev, channelDescription: descriptionDraft.trim() }));
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to update description.");
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

  const handleDownloadVideo = async (video) => {
    setMessage("");
    try {
      await downloadAndStoreVideo(video, serverUrl);
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
        <img
          className="profile-cover-avatar"
          src={profileUser?.avatar || "https://i.pravatar.cc/200?img=12"}
          alt={profileUser?.username || "Profile"}
        />
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
            <button type="button" className="profile-primary-btn profile-compact-btn" onClick={saveDescription}>Save Description</button>
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
          {renderVideoGrid(uploadedVideos)}
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
                <img src={channel.avatar || "https://i.pravatar.cc/120?img=4"} alt={channel.username} />
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
    </section>
  );
};

export default Profile;
