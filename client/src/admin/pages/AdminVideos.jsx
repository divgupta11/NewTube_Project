import { useEffect, useState } from "react";
import { MdDelete, MdEdit } from "react-icons/md";
import { deleteVideoById, fetchVideos, updateVideoById } from "../adminApi";

const AdminVideos = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({ title: "", description: "" });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchVideos({ page, limit: 10, search });
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch videos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const onSearch = (event) => {
    event.preventDefault();
    setPage(1);
    load();
  };

  const startEdit = (video) => {
    setEditId(video._id);
    setDraft({ title: video.title || "", description: video.description || "" });
  };

  const saveEdit = async () => {
    try {
      const updated = await updateVideoById(editId, draft);
      setItems((prev) => prev.map((item) => (item._id === editId ? { ...item, ...updated } : item)));
      setEditId(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update video");
    }
  };

  const onDelete = async (id) => {
    const ok = window.confirm("Delete this video?");
    if (!ok) return;

    try {
      await deleteVideoById(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete video");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head split">
        <div>
          <h2>Video Management</h2>
          <p>Edit or remove uploaded videos with analytics context.</p>
        </div>
        <form className="admin-search" onSubmit={onSearch}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search videos" />
          <button type="submit">Search</button>
        </form>
      </div>

      {error && <p className="admin-error-text">{error}</p>}
      {loading ? <p>Loading videos...</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Uploader</th>
              <th>Views</th>
              <th>Likes</th>
              <th>Dislikes</th>
              <th>Comments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((video) => (
              <tr key={video._id}>
                <td>
                  {editId === video._id ? (
                    <div className="edit-stack">
                      <input
                        value={draft.title}
                        onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Title"
                      />
                      <textarea
                        rows="2"
                        value={draft.description}
                        onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Description"
                      />
                      <div className="action-row">
                        <button type="button" onClick={saveEdit}>Save</button>
                        <button type="button" onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <span>{video.title}</span>
                  )}
                </td>
                <td>{video.user?.username || "Unknown"}</td>
                <td>{video.views || 0}</td>
                <td>{video.likesCount || 0}</td>
                <td>{video.dislikesCount || 0}</td>
                <td>{video.commentsCount || 0}</td>
                <td>
                  <div className="action-row">
                    <button className="icon-btn" type="button" onClick={() => startEdit(video)} title="Edit video">
                      <MdEdit size={18} />
                    </button>
                    <button className="icon-btn danger" type="button" onClick={() => onDelete(video._id)} title="Delete video">
                      <MdDelete size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>Prev</button>
        <span>Page {pagination.page} / {pagination.totalPages || 1}</span>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.min((pagination.totalPages || 1), prev + 1))}
          disabled={page >= (pagination.totalPages || 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminVideos;
