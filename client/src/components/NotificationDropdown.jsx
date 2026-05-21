import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { MdClose, MdDeleteOutline, MdDoneAll, MdNotificationsNone } from "react-icons/md";
import api from "../api/client";
import { resolvePublicUrl } from "../utils/publicUrl";

const fallbackAvatar = "https://i.pravatar.cc/96?img=12";

const NotificationDropdown = ({ onClose, onUnreadChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cleared, setCleared] = useState(false);
  const requestVersionRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
    const requestVersion = requestVersionRef.current;

    try {
      const { data } = await api.get("/notifications");
      if (requestVersion !== requestVersionRef.current) return;

      const items = Array.isArray(data) ? data : [];
      if (!cleared) {
        setNotifications(items);
        onUnreadChange?.(items.filter((item) => !item.isRead).length);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
      }
    }
  }, [cleared, onUnreadChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    document.body.classList.add("notifications-panel-open");
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.classList.remove("notifications-panel-open");
    };
  }, [onClose]);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [notifications]
  );

  const syncUnreadCount = (items) => {
    onUnreadChange?.(items.filter((item) => !item.isRead).length);
  };

  const handleMarkAsRead = async (id) => {
    const current = notifications;
    const next = current.map((item) => (item._id === id ? { ...item, isRead: true } : item));
    setNotifications(next);
    syncUnreadCount(next);

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (error) {
      console.error("Failed to mark as read:", error);
      setNotifications(current);
      syncUnreadCount(current);
    }
  };

  const handleMarkAllRead = async () => {
    const current = notifications;
    const next = current.map((item) => ({ ...item, isRead: true }));
    setNotifications(next);
    syncUnreadCount(next);

    try {
      await api.patch("/notifications/read-all");
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      setNotifications(current);
      syncUnreadCount(current);
    }
  };

  const handleClearNotifications = async () => {
    requestVersionRef.current += 1;
    setCleared(true);
    setNotifications([]);
    setLoading(false);
    syncUnreadCount([]);

    try {
      await api.delete("/notifications");
    } catch (error) {
      console.error("Failed to clear notifications:", error);
    }
  };


  return (
    <div className="notifications-backdrop" onMouseDown={onClose}>
      <aside
        className="notifications-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-panel-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="notifications-header">
          <div>
            <p className="notifications-kicker">Latest first</p>
            <h3 id="notifications-panel-title">Notifications</h3>
          </div>
          <div className="notifications-actions">
            {notifications.some((item) => !item.isRead) && (
              <button className="mark-read-btn" type="button" onClick={handleMarkAllRead}>
                <MdDoneAll size={18} />
                <span>Mark all</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button className="clear-notifications-btn" type="button" onClick={handleClearNotifications}>
                <MdDeleteOutline size={18} />
                <span>Clear</span>
              </button>
            )}
            <button className="notifications-close" type="button" aria-label="Close notifications" onClick={onClose}>
              <MdClose size={22} />
            </button>
          </div>
        </div>

        <div className="notifications-list">
          {loading ? (
            <div className="notifications-empty">Loading notifications...</div>
          ) : cleared || sortedNotifications.length === 0 ? (
            <div className="notifications-empty">
              <MdNotificationsNone size={44} />
              <p>Your notifications will appear here</p>
            </div>
          ) : (
            sortedNotifications.map((notification) => (
              <Link
                key={notification._id}
                to={notification.video?._id ? `/watch/${notification.video._id}` : "/"}
                className={`notification-item ${!notification.isRead ? "unread" : "read"}`}
                onClick={() => {
                  handleMarkAsRead(notification._id);
                  onClose();
                }}
              >
                <span className="notification-read-dot" aria-label={notification.isRead ? "Read" : "Unread"} />
                <img
                  src={resolvePublicUrl(notification.channel?.avatar) || fallbackAvatar}
                  alt={notification.channel?.username || "Channel avatar"}
                  className="notification-avatar"
                />
                <span className="notification-content">
                  <span className="notification-text">
                    <strong>{notification.channel?.username || "A channel"}</strong>
                    {" uploaded "}
                    {notification.video?.title || "a new video"}
                  </span>
                  <span className="notification-meta">
                    <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                    <span>{notification.isRead ? "Read" : "Unread"}</span>
                  </span>
                </span>
                {notification.video?.thumbnailUrl && (
                  <img
                    src={resolvePublicUrl(notification.video.thumbnailUrl)}
                    alt=""
                    className="notification-thumbnail"
                  />
                )}
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

export default NotificationDropdown;
