import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SUPPORTED_VIDEO_TYPES = ["video/mp4", "video/webm"];

const UploadVideo = ({ user, onOpenLogin }) => {
  const navigate = useNavigate();
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const videoLabel = useMemo(() => (videoFile ? videoFile.name : "Drag and drop video or click to browse"), [videoFile]);
  const thumbLabel = useMemo(() => (thumbFile ? thumbFile.name : "Choose thumbnail image"), [thumbFile]);

  const handleUpload = async () => {
    setMessage("");

    if (!title.trim()) {
      setMessage("Please enter a video title.");
      return;
    }

    if (!videoFile || !thumbFile) {
      setMessage("Please select both video and thumbnail files.");
      return;
    }

    const byMime = SUPPORTED_VIDEO_TYPES.includes(videoFile.type);
    const byExt = /\.(mp4|webm)$/i.test(videoFile.name);
    if (!byMime && !byExt) {
      setMessage("Please upload a supported video: MP4 (H.264) or WEBM.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Please login again to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("transcript", transcript.trim());
    formData.append("video", videoFile);
    formData.append("thumbnail", thumbFile);

    try {
      setUploading(true);
      const { data } = await axios.post(`${apiBase}/videos/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      const uploadedId = data?._id || data?.video?._id || data?.id;
      if (!uploadedId) {
        setMessage("Upload succeeded but video link is missing. Please open it from Home.");
        return;
      }

      setMessage("Upload successful. Redirecting to video...");
      setTimeout(() => {
        navigate(`/watch/${uploadedId}`, { replace: true });
      }, 600);
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Upload failed. Please try again.";
      setMessage(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <section className="upload-shell">
        <h1>Upload Video</h1>
        <p className="empty-text">Please login to upload videos.</p>
        <button className="auth-btn auth-btn-primary ripple" type="button" onClick={onOpenLogin}>Open Login</button>
      </section>
    );
  }

  return (
    <section className="upload-shell">
      <h1>Upload Video</h1>
      <div className="upload-card">
        <label className="drop-zone">
          <input type="file" accept=".mp4,.webm,video/mp4,video/webm" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} />
          <span>{videoLabel}</span>
        </label>

        <label className="thumb-zone">
          <input type="file" accept="image/*" onChange={(event) => setThumbFile(event.target.files?.[0] || null)} />
          <span>{thumbLabel}</span>
        </label>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Video title"
        />

        <textarea
          rows="5"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
        />

        <textarea
          rows="5"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder="Optional transcript for better AI summary and Q&A"
        />

        <button className="upload-btn ripple" type="button" onClick={handleUpload} disabled={uploading}>
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {message && <p className="empty-text">{message}</p>}
      </div>
    </section>
  );
};

export default UploadVideo;

