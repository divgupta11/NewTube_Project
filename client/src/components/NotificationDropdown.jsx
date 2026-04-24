import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { MdNotificationsNone, MdDoneAll } from "react-icons/md";
import api from "../api/client";
import { resolvePublicUrl } from "../utils/publicUrl";

const NotificationDropdown = ({ onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id, e) => {
    if (e) e.preventDefault();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };


  return (
    <div className="notifications-dropdown">
      <div className="notifications-header">
        <h3>Notifications</h3>
        {notifications.some(n => !n.isRead) && (
          <button className="mark-read-btn" onClick={handleMarkAllRead}>
            <MdDoneAll size={16} style={{ marginRight: "4px" }} />
            Mark all as read
          </button>
        )}
      </div>

      <div className="notifications-list">
        {loading ? (
          <div className="notifications-empty">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <MdNotificationsNone size={48} />
            <p>Your notifications will appear here</p>
          </div>
        ) : (
          notifications.map((n) => (
            <Link 
              key={n._id} 
              to={`/watch/${n.video?._id}`} 
              className={`notification-item ${!n.isRead ? "unread" : ""}`}
              onClick={() => {
                handleMarkAsRead(n._id);
                onClose();
              }}
            >
              <img 
                src={resolvePublicUrl(n.channel?.avatar) || "https://i.pravatar.cc/150"} 
                alt={n.channel?.username} 
                className="notification-avatar" 
              />
              <div className="notification-content">
                <div className="notification-text">
                  {n.channel?._id ? (
                    <Link className="notification-channel" to={`/channel/${n.channel._id}`}>
                      {n.channel?.username}
                    </Link>
                  ) : (
                    <span className="notification-channel">{n.channel?.username}</span>
                  )}{" "}
                  uploaded: {n.video?.title}
                </div>
                <div className="notification-time">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </div>
              </div>
              {n.video?.thumbnailUrl && (
                <img src={resolvePublicUrl(n.video.thumbnailUrl)} alt="Thumbnail" className="notification-thumbnail" />
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
