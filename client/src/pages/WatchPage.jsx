import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

const WatchPage = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [video, setVideo] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");

  const likedByCurrentUser = useMemo(() => {
    if (!user || !video?.likes) return false;
    return video.likes.some((likeId) => likeId === user._id || likeId?._id === user._id);
  }, [user, video]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [videoRes, commentsRes] = await Promise.all([
          api.get(`/videos/${id}`),
          api.get(`/comments/${id}`)
        ]);
        setVideo(videoRes.data);
        setComments(commentsRes.data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchData();
  }, [id]);

  const likeVideo = async () => {
    if (!user) return;
    const { data } = await api.patch(`/videos/${id}/like`);
    setVideo((prev) => {
      const likes = prev.likes || [];
      let updatedLikes = likes;
      if (data.liked) {
        updatedLikes = [...likes, user._id];
      } else {
        updatedLikes = likes.filter((likeId) => (likeId._id || likeId) !== user._id);
      }
      return { ...prev, likes: updatedLikes };
    });
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!commentText.trim() || !user) return;

    const { data } = await api.post(`/comments/${id}`, { text: commentText });
    setComments((prev) => [data, ...prev]);
    setCommentText("");
  };

  const likeComment = async (commentId) => {
    if (!user) return;
    const { data } = await api.patch(`/comments/like/${commentId}`);
    setComments((prev) =>
      prev.map((comment) => {
        if (comment._id !== commentId) return comment;
        const likes = comment.likes || [];
        const hasLiked = likes.some((likeId) => (likeId._id || likeId) === user._id);
        return {
          ...comment,
          likes: hasLiked
            ? likes.filter((likeId) => (likeId._id || likeId) !== user._id)
            : [...likes, user._id],
          likesCount: data.likesCount
        };
      })
    );
  };

  if (!video) return <p className="state-message">Loading video...</p>;

  return (
    <section className="watch-layout">
      <article className="watch-main">
        <video className="watch-video" src={`${SERVER_URL}${video.videoUrl}`} controls />
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-meta-row">
          <Link className="channel-inline" to={`/channel/${video.user?._id}`}>
            <img src={video.user?.avatar} alt={video.user?.username} />
            <span>{video.user?.username}</span>
          </Link>
          <button className="solid-btn" onClick={likeVideo} type="button">
            {likedByCurrentUser ? "Unlike" : "Like"} ({video.likes?.length || 0})
          </button>
        </div>
        <p className="watch-description">{video.description}</p>

        <section className="comments-block">
          <h2>Comments ({comments.length})</h2>
          {user ? (
            <form className="comment-form" onSubmit={submitComment}>
              <input
                placeholder="Add a comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button className="solid-btn" type="submit">Post</button>
            </form>
          ) : (
            <p className="state-message">Login to comment.</p>
          )}

          <div className="comment-list">
            {comments.map((comment) => (
              <div className="comment-item" key={comment._id}>
                <img src={comment.user?.avatar} alt={comment.user?.username} />
                <div>
                  <p className="comment-user">{comment.user?.username}</p>
                  <p>{comment.text}</p>
                  <button className="text-btn" onClick={() => likeComment(comment._id)} type="button">
                    Like ({comment.likes?.length || 0})
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </article>
    </section>
  );
};

export default WatchPage;

