import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const UploadPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ title: "", description: "", tags: "" });
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setFormData((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!videoFile || !thumbnailFile) return;

    setSubmitting(true);

    const payload = new FormData();
    payload.append("title", formData.title);
    payload.append("description", formData.description);
    payload.append("tags", formData.tags);
    payload.append("video", videoFile);
    payload.append("thumbnail", thumbnailFile);

    try {
      const { data } = await api.post("/videos/upload", payload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      navigate(`/watch/${data._id}`);
    } catch (error) {
      alert(error.response?.data?.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell upload-shell">
      <h1>Upload Video</h1>
      <form className="auth-card" onSubmit={handleSubmit}>
        <input name="title" placeholder="Video title" onChange={handleChange} required />
        <textarea name="description" placeholder="Description" onChange={handleChange} rows="4" />
        <input name="tags" placeholder="Tags (comma separated)" onChange={handleChange} />

        <label>Video file</label>
        <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} required />

        <label>Thumbnail image</label>
        <input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files[0])} required />

        <button className="solid-btn" type="submit" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload"}
        </button>
      </form>
    </section>
  );
};

export default UploadPage;

