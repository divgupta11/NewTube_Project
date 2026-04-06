import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  MdThumbUpOffAlt,
  MdThumbDown,
  MdModeComment,
  MdShare,
  MdBookmarkBorder,
  MdDescription
} from "react-icons/md";

const apiBase = import.meta.env.VITE_API_URL || "/api";
const serverUrl = import.meta.env.VITE_SERVER_URL || "";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const resolveVideoUrl = (video) => {
  if (!video) return "";
  if (video.videoUrl) {
    return video.videoUrl.startsWith("http") ? video.videoUrl : `${serverUrl}${video.videoUrl}`;
  }

  const files = Array.isArray(video.video_files) ? video.video_files : [];
  const mp4 = files
    .filter((file) => String(file.file_type || "").toLowerCase() === "video/mp4" && file.link)
    .sort((a, b) => Number(b.width || 0) - Number(a.width || 0));

  if (!mp4.length) return "";
  return mp4[0].link;
};

const Shorts = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [savedState, setSavedState] = useState({});
  const [metaMap, setMetaMap] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [commentDraft, setCommentDraft] = useState({});
  const [openCommentsId, setOpenCommentsId] = useState("");
  const [openDescriptionId, setOpenDescriptionId] = useState("");

  const preparedVideos = useMemo(
    () => videos.map((video) => ({ ...video, playableUrl: resolveVideoUrl(video) })).filter((video) => video.playableUrl),
    [videos]
  );

  const activeVideo = preparedVideos[activeIndex];

  const loadShortMeta = async (video) => {
    if (!video) return;
    if (metaMap[video._id]) return;

    try {
      const { data } = await axios.get(`${apiBase}/videos/shorts/${video._id}/meta`, { headers: authHeaders() });
      setMetaMap((prev) => ({ ...prev, [video._id]: data }));
    } catch {
      setMetaMap((prev) => ({
        ...prev,
        [video._id]: { likesCount: 0, dislikesCount: 0, commentsCount: 0, liked: false, disliked: false, description: video.description || "" }
      }));
    }
  };

  const loadComments = async (videoId) => {
    try {
      const { data } = await axios.get(`${apiBase}/videos/shorts/${videoId}/comments`, { headers: authHeaders() });
      setCommentsMap((prev) => ({ ...prev, [videoId]: Array.isArray(data) ? data : [] }));
    } catch {
      setCommentsMap((prev) => ({ ...prev, [videoId]: [] }));
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${apiBase}/videos/shorts`);
        setVideos(Array.isArray(data) ? data : []);
      } catch {
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!activeVideo) return;
    loadShortMeta(activeVideo);
  }, [activeVideo?._id]);

  useEffect(() => {
    if (!preparedVideos.length) return undefined;

    const players = document.querySelectorAll(".short-video-player");
    const observed = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = Number(entry.target.getAttribute("data-index") || 0);
          const player = entry.target;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.72) {
            setActiveIndex(idx);
            if (player && typeof player.play === "function") {
              player.play().catch(() => {});
            }

            const video = preparedVideos[idx];
            if (video && !observed.has(video._id)) {
              observed.add(video._id);
              axios.post(
                `${apiBase}/users/history/watch`,
                {
                  videoId: String(video._id),
                  source: String(video._id).startsWith("pexels-") ? "pexels" : "internal",
                  title: video.title,
                  thumbnailUrl: video.thumbnailUrl,
                  videoUrl: video.playableUrl,
                  channelName: video.user?.username || "Channel",
                  isShort: true
                },
                { headers: authHeaders() }
              ).catch(() => {});
            }
          } else if (player && typeof player.pause === "function") {
            player.pause();
          }
        });
      },
      { threshold: [0.72] }
    );

    players.forEach((player) => observer.observe(player));

    return () => {
      players.forEach((player) => observer.unobserve(player));
      observer.disconnect();
    };
  }, [preparedVideos]);

  const applyReaction = async (video, type) => {
    try {
      const { data } = await axios.post(
        `${apiBase}/videos/shorts/${video._id}/${type}`,
        { title: video.title, description: video.description || "" },
        { headers: authHeaders() }
      );
      setMetaMap((prev) => ({
        ...prev,
        [video._id]: {
          ...(prev[video._id] || {}),
          likesCount: data.likesCount || 0,
          dislikesCount: data.dislikesCount || 0,
          liked: Boolean(data.liked),
          disliked: Boolean(data.disliked),
          commentsCount: prev[video._id]?.commentsCount || 0,
          description: prev[video._id]?.description || video.description || ""
        }
      }));
    } catch {
      setMessage("Login required for this action.");
    }
  };

  const submitComment = async (video) => {
    const text = String(commentDraft[video._id] || "").trim();
    if (!text) return;

    try {
      const { data } = await axios.post(
        `${apiBase}/videos/shorts/${video._id}/comments`,
        { text, title: video.title, description: video.description || "" },
        { headers: authHeaders() }
      );
      setCommentsMap((prev) => ({ ...prev, [video._id]: [data, ...(prev[video._id] || [])] }));
      setCommentDraft((prev) => ({ ...prev, [video._id]: "" }));
      setMetaMap((prev) => ({
        ...prev,
        [video._id]: {
          ...(prev[video._id] || {}),
          commentsCount: Number(prev[video._id]?.commentsCount || 0) + 1
        }
      }));
    } catch {
      setMessage("Login required to comment.");
    }
  };

  const toggleSave = async (video) => {
    const isExternal = String(video._id || "").startsWith("pexels-");

    if (isExternal) {
      const key = "newtube_saved_external_shorts";
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      const exists = current.some((item) => item._id === video._id);
      const next = exists
        ? current.filter((item) => item._id !== video._id)
        : [{ _id: video._id, title: video.title, videoUrl: video.playableUrl, thumbnailUrl: video.thumbnailUrl, isShort: true }, ...current].slice(0, 100);
      localStorage.setItem(key, JSON.stringify(next));
      setSavedState((prev) => ({ ...prev, [video._id]: !exists }));
      setMessage(exists ? "Removed from saved list" : "Saved in local list");
      return;
    }

    try {
      await axios.post(`${apiBase}/users/saved/${video._id}`, {}, { headers: authHeaders() });
      setSavedState((prev) => ({ ...prev, [video._id]: !prev[video._id] }));
      setMessage("Saved videos updated");
    } catch {
      setMessage("Login required to save");
    }
  };

  const shareVideo = async (video) => {
    const shareUrl = `${window.location.origin}/watch/${video._id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, text: "Check this short", url: shareUrl });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setMessage("Link copied");
        return;
      }

      setMessage(`Share link: ${shareUrl}`);
    } catch {
      setMessage("Unable to share right now");
    }
  };

  const openComments = async (videoId) => {
    const next = openCommentsId === videoId ? "" : videoId;
    setOpenCommentsId(next);
    if (next && !commentsMap[videoId]) {
      await loadComments(videoId);
    }
  };

  if (loading) return <p className="empty-text">Loading shorts...</p>;

  return (
    <section className="shorts-page">
      {!preparedVideos.length ? (
        <p className="empty-text">No shorts available right now.</p>
      ) : (
        <>
          <div className="shorts-scroll-area">
            {preparedVideos.map((video, index) => {
              const meta = metaMap[video._id] || { likesCount: 0, dislikesCount: 0, commentsCount: 0, liked: false, disliked: false, description: video.description || "" };
              const saved = Boolean(savedState[video._id]);
              const comments = commentsMap[video._id] || [];
              const isCommentOpen = openCommentsId === video._id;
              const isDescOpen = openDescriptionId === video._id;

              return (
                <article key={video._id} className="shorts-slide">
                  <div className="shorts-video-shell">
                    <video
                      data-index={index}
                      className="short-video-player"
                      muted
                      loop
                      playsInline
                      controls
                      preload="metadata"
                      poster={video.thumbnailUrl}
                      src={video.playableUrl}
                    />

                    <div className="shorts-overlay-left">
                      <div className="shorts-author-row">
                        <img
                          className="shorts-author-avatar"
                          src={video.user?.avatar || `https://i.pravatar.cc/80?u=${encodeURIComponent(video.user?.username || video._id)}`}
                          alt={video.user?.username || "Creator"}
                        />
                        <p className="shorts-channel">{video.user?.username || "Channel"}</p>
                      </div>
                      <h3>{video.title}</h3>
                      <Link to={`/watch/${video._id}`} className="shorts-open-link">Open Full Player</Link>
                    </div>

                    <div className="shorts-overlay-right">
                      <button type="button" onClick={() => applyReaction(video, "like")} aria-label="Like">
                        <MdThumbUpOffAlt size={24} />
                        <span>{meta.likesCount}</span>
                      </button>
                      <button type="button" onClick={() => applyReaction(video, "dislike")} aria-label="Dislike">
                        <MdThumbDown size={24} />
                        <span>{meta.dislikesCount}</span>
                      </button>
                      <button type="button" onClick={() => openComments(video._id)} aria-label="Comment">
                        <MdModeComment size={24} />
                        <span>{meta.commentsCount}</span>
                      </button>
                      <button type="button" onClick={() => shareVideo(video)} aria-label="Share">
                        <MdShare size={24} />
                        <span>Share</span>
                      </button>
                      <button type="button" onClick={() => toggleSave(video)} aria-label="Save">
                        <MdBookmarkBorder size={24} />
                        <span>{saved ? "Saved" : "Save"}</span>
                      </button>
                      <button type="button" onClick={() => setOpenDescriptionId(isDescOpen ? "" : video._id)} aria-label="Description">
                        <MdDescription size={24} />
                        <span>Desc</span>
                      </button>
                    </div>

                    {isDescOpen && (
                      <div className="shorts-description-panel">
                        <h4>Description</h4>
                        <p>{meta.description || "No description available."}</p>
                      </div>
                    )}

                    {isCommentOpen && (
                      <div className="shorts-comments-panel">
                        <h4>Comments</h4>
                        <div className="shorts-comments-list">
                          {comments.length ? comments.map((comment) => (
                            <article key={comment._id}>
                              <strong>{comment.user?.username || "User"}</strong>
                              <p>{comment.text}</p>
                            </article>
                          )) : <p className="empty-text">No comments yet.</p>}
                        </div>
                        <div className="shorts-comment-form">
                          <input
                            value={commentDraft[video._id] || ""}
                            onChange={(event) => setCommentDraft((prev) => ({ ...prev, [video._id]: event.target.value }))}
                            placeholder="Add a comment"
                          />
                          <button type="button" onClick={() => submitComment(video)}>Post</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="shorts-footer-note">
            <span>{activeIndex + 1} / {preparedVideos.length}</span>
            {message && <span>{message}</span>}
          </div>
          {activeVideo && <p className="shorts-hint">Scroll up/down to move between shorts</p>}
        </>
      )}
    </section>
  );
};

export default Shorts;
