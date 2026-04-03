import { useEffect, useState } from "react";
import { MdBlock, MdDelete } from "react-icons/md";
import { deleteUserById, fetchUsers, updateUserBlock } from "../adminApi";

const AdminUsers = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchUsers({ page, limit: 10, search });
      setItems(data.items || []);
      setPagination(data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch users");
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

  const onToggleBlock = async (user) => {
    try {
      await updateUserBlock(user._id, !user.isBlocked);
      setItems((prev) => prev.map((item) => (item._id === user._id ? { ...item, isBlocked: !item.isBlocked } : item)));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update user status");
    }
  };

  const onDelete = async (id) => {
    const ok = window.confirm("Delete this user and all their videos/comments?");
    if (!ok) return;

    try {
      await deleteUserById(id);
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-head split">
        <div>
          <h2>User Management</h2>
          <p>Search, block/unblock, and delete users.</p>
        </div>
        <form className="admin-search" onSubmit={onSearch}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search username/email" />
          <button type="submit">Search</button>
        </form>
      </div>

      {error && <p className="admin-error-text">{error}</p>}
      {loading ? <p>Loading users...</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Join Date</th>
              <th>Videos</th>
              <th>Subscriptions</th>
              <th>Subscribers</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user._id}>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>{user.totalVideosUploaded}</td>
                <td>{user.totalSubscriptions}</td>
                <td>{user.subscribersCount}</td>
                <td>
                  <span className={`pill ${user.isBlocked ? "bad" : "good"}`}>
                    {user.isBlocked ? "Blocked" : "Active"}
                  </span>
                </td>
                <td>
                  <div className="action-row">
                    <button className="icon-btn" onClick={() => onToggleBlock(user)} type="button" title="Block/unblock">
                      <MdBlock size={18} />
                    </button>
                    <button className="icon-btn danger" onClick={() => onDelete(user._id)} type="button" title="Delete user">
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

export default AdminUsers;
