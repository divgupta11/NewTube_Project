import { useCallback, useEffect, useState } from "react";
import { MdDelete } from "react-icons/md";
import { deleteCommentById, fetchComments } from "../adminApi";

const AdminComments = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await fetchComments({ page, limit: 12, search });
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch comments");
    }
  }, [page, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onSearch = (event) => {
    event.preventDefault();
    setPage(1);
    load();
  };

  const onDelete = async (id) => {
    const ok = window.confirm("Delete this comment?");
    if (!ok) return;

    try {
      await deleteCommentById(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete comment");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head split">
        <div>
          <h2>Comment Management</h2>
          <p>Review and moderate comments across platform videos.</p>
        </div>
        <form className="admin-search" onSubmit={onSearch}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search comments" />
          <button type="submit">Search</button>
        </form>
      </div>

      {error && <p className="admin-error-text">{error}</p>}

      <div className="comment-card-grid">
        {items.map((comment) => (
          <article className="comment-card" key={comment._id}>
            <div>
              <h4>{comment.user?.username || "User"}</h4>
              <p className="muted-line">{comment.user?.email || "No email"}</p>
              <p className="muted-line">Video: {comment.video?.title || "Unknown"}</p>
              <p>{comment.text}</p>
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
            </div>
            <button className="icon-btn danger" type="button" onClick={() => onDelete(comment._id)}>
              <MdDelete size={18} />
            </button>
          </article>
        ))}
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

export default AdminComments;
