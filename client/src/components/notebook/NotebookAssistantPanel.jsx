import { useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiList, FiMessageCircle, FiMoon, FiSun, FiDownload, FiPlus, FiTrash2, FiRefreshCw } from "react-icons/fi";
import axios from "axios";
import { getNotebookClientId } from "../../utils/notebookClient";
import { resolvePublicUrl } from "../../utils/publicUrl";

const apiBase = import.meta.env.VITE_API_URL || "/api";

const notebookHeaders = () => ({
  "x-notebook-client-id": getNotebookClientId()
});

const formatSeconds = (value) => {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
};

const downloadText = (filename, content) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const NotebookAssistantPanel = ({
  video,
  theme,
  onToggleTheme,
  onToggleNotebook,
  onSeekTo
}) => {
  const [activeTab, setActiveTab] = useState("summary");
  const [summaryMode, setSummaryMode] = useState("detailed");
  const [loading, setLoading] = useState(true);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [asking, setAsking] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [question, setQuestion] = useState("");
  const [noteText, setNoteText] = useState("");
  const [status, setStatus] = useState("");

  const videoId = video?._id || "";
  const thumbnail = resolvePublicUrl(video?.thumbnailUrl);

  const normalizedMessages = useMemo(() => {
    const messages = Array.isArray(session?.messages) ? session.messages : [];
    return messages.slice(-40);
  }, [session]);

  const notes = useMemo(() => {
    const merged = Array.isArray(session?.notes) ? session.notes : [];
    return merged.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [session]);

  const loadSession = async () => {
    if (!videoId) return;
    setLoading(true);
    setStatus("");

    try {
      const { data } = await axios.get(`${apiBase}/notebook/${videoId}`, {
        headers: notebookHeaders()
      });
      setSession(data.session || null);
      setSummary({
        shortSummary: data.session?.summaryShort || data.video?.aiLearningMode || "",
        detailedSummary: data.session?.summaryDetailed || data.video?.aiSummary || "",
        keyPoints: data.session?.keyPoints || data.video?.aiKeyPoints || [],
        aiNotes: data.session?.aiNotes || data.video?.aiNotes || [],
        highlights: data.session?.highlights || [],
        followUpQuestions: []
      });
    } catch (error) {
      setStatus(error.response?.data?.message || "Failed to load notebook context.");
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab("summary");
    setSummaryMode("detailed");
    setQuestion("");
    setNoteText("");
    setStatus("");
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const generateSummary = async (mode = summaryMode) => {
    if (!videoId) return;
    setGeneratingSummary(true);
    setStatus("");

    try {
      const { data } = await axios.post(
        `${apiBase}/notebook/${videoId}/summary`,
        { mode },
        { headers: notebookHeaders() }
      );

      setSummary(data.summary || null);
      setSession(data.session || null);
      setStatus("Notebook summary updated.");
    } catch (error) {
      setStatus(error.response?.data?.message || "Failed to generate summary.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  useEffect(() => {
    const hasSummary = Boolean(summary?.shortSummary || summary?.detailedSummary || session?.summaryShort || session?.summaryDetailed);
    if (!loading && videoId && !hasSummary && !generatingSummary) {
      generateSummary("detailed");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, videoId]);

  const askQuestion = async (event) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !videoId) return;

    setAsking(true);
    setStatus("");

    try {
      const { data } = await axios.post(
        `${apiBase}/notebook/${videoId}/question`,
        { question: trimmed },
        { headers: notebookHeaders() }
      );

      setSession(data.session || null);
      setQuestion("");
      setStatus("Answer added to notebook history.");
    } catch (error) {
      setStatus(error.response?.data?.message || "Failed to answer the question.");
    } finally {
      setAsking(false);
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed || !videoId) return;

    setSavingNote(true);
    setStatus("");

    try {
      const { data } = await axios.post(
        `${apiBase}/notebook/${videoId}/notes`,
        { text: trimmed },
        { headers: notebookHeaders() }
      );

      setSession(data.session || null);
      setNoteText("");
      setStatus("Note saved.");
    } catch (error) {
      setStatus(error.response?.data?.message || "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const removeNote = async (noteId) => {
    if (!videoId) return;

    try {
      const { data } = await axios.delete(`${apiBase}/notebook/${videoId}/notes/${noteId}`, {
        headers: notebookHeaders()
      });
      setSession(data.session || null);
      setStatus("Note removed.");
    } catch (error) {
      setStatus(error.response?.data?.message || "Failed to remove note.");
    }
  };

  const exportNotes = () => {
    if (!notes.length) return;
    const text = notes
      .map((item, index) => `${index + 1}. ${item.text} [${new Date(item.createdAt).toLocaleString()}]`)
      .join("\n\n");
    downloadText(`${video?.title || "newtube-video"}-notes.txt`, text);
  };

  if (!videoId) return null;

  return (
    <aside className="notebook-panel ai-panel">
      <header className="notebook-header ai-panel-head">
        <div className="notebook-title-wrap">
          <h3>
            <FiBookOpen />
            AI Notebook
          </h3>
          <p className="notebook-context">
            {video?.title || "Video notebook"} {video?.videoUrl ? `· ${video.videoUrl}` : ""}
          </p>
        </div>
        <div className="notebook-header-actions">
          {onToggleNotebook && (
            <button type="button" className="notebook-theme-btn" onClick={onToggleNotebook}>
              Close notebook
            </button>
          )}
          <button type="button" className="notebook-theme-btn" onClick={onToggleTheme}>
            {theme === "dark" ? <FiSun /> : <FiMoon />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" className="notebook-refresh-btn" onClick={() => generateSummary(summaryMode)} disabled={generatingSummary}>
            <FiRefreshCw className={generatingSummary ? "spinning" : ""} />
            {generatingSummary ? "Working..." : "Refresh"}
          </button>
        </div>
      </header>

      <div className="notebook-video-card">
        <img src={thumbnail || "https://picsum.photos/seed/notebook/640/360"} alt={video?.title || "Notebook"} />
        <div>
          <strong>{video?.title || "Notebook source"}</strong>
          <p>{video?.transcript ? "Transcript available" : "Using metadata and description as context"}</p>
        </div>
      </div>

      <nav className="notebook-tabs" aria-label="Notebook tabs">
        <button type="button" className={activeTab === "summary" ? "active" : ""} onClick={() => setActiveTab("summary")}>
          <FiList /> Summary
        </button>
        <button type="button" className={activeTab === "notes" ? "active" : ""} onClick={() => setActiveTab("notes")}>
          <FiPlus /> Notes
        </button>
        <button type="button" className={activeTab === "qa" ? "active" : ""} onClick={() => setActiveTab("qa")}>
          <FiMessageCircle /> Ask
        </button>
      </nav>

      {status && <p className="ai-notice">{status}</p>}
      {loading ? <p className="empty-text">Loading notebook context...</p> : null}

      {activeTab === "summary" && (
        <div className="notebook-section">
          <div className="notebook-mode-switch">
            <button type="button" className={summaryMode === "short" ? "active" : ""} onClick={() => setSummaryMode("short")}>
              Short
            </button>
            <button type="button" className={summaryMode === "detailed" ? "active" : ""} onClick={() => setSummaryMode("detailed")}>
              Detailed
            </button>
            <button type="button" className="accent" onClick={() => generateSummary(summaryMode)} disabled={generatingSummary}>
              {generatingSummary ? "Generating..." : "Generate"}
            </button>
          </div>

          <div className="notebook-card">
            <h4>Summary</h4>
            <p>{summaryMode === "short" ? (summary?.shortSummary || session?.summaryShort || "No summary yet.") : (summary?.detailedSummary || session?.summaryDetailed || "No summary yet.")}</p>
          </div>

          <div className="notebook-card">
            <h4>Key Points</h4>
            {((summary?.keyPoints || session?.keyPoints) || []).length ? (
              <ul>
                {(summary?.keyPoints || session?.keyPoints).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No key points yet.</p>
            )}
          </div>

          <div className="notebook-card">
            <h4>Timestamp Highlights</h4>
            {((summary?.highlights || session?.highlights) || []).length ? (
              <div className="timestamp-grid">
                {(summary?.highlights || session?.highlights).map((item, index) => (
                  <button
                    key={`${item.label}-${index}`}
                    type="button"
                    className="timestamp-chip"
                    onClick={() => onSeekTo?.(Number(item.seconds || 0))}
                  >
                    <strong>{item.label}</strong>
                    <span>{formatSeconds(item.seconds)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>No timestamp highlights yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="notebook-section">
          <form className="notebook-note-form" onSubmit={addNote}>
            <textarea
              rows="4"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Write a note about this video"
            />
            <button type="submit" disabled={savingNote}>
              {savingNote ? "Saving..." : "Save Note"}
            </button>
          </form>

          <div className="notebook-card">
            <div className="notebook-card-head">
              <h4>Your Notes</h4>
              <button type="button" onClick={exportNotes} disabled={!notes.length}>
                <FiDownload />
                Export
              </button>
            </div>
            {notes.length ? (
              <div className="notebook-note-list">
                {notes.map((item) => (
                  <article key={item._id} className="notebook-note-item">
                    <div>
                      <p>{item.text}</p>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    <button type="button" onClick={() => removeNote(item._id)} aria-label="Delete note">
                      <FiTrash2 />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p>No notes yet. Save your ideas while watching.</p>
            )}
          </div>

          <div className="notebook-card">
            <h4>AI Notes</h4>
            {(summary?.aiNotes || session?.aiNotes || []).length ? (
              <ul>
                {(summary?.aiNotes || session?.aiNotes).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No AI notes yet. Generate a summary first.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "qa" && (
        <div className="notebook-section">
          <div className="notebook-chat-history">
            {normalizedMessages.length ? (
              normalizedMessages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`notebook-chat-message ${message.role}`}>
                  <span>{message.role === "user" ? "You" : "Notebook"}</span>
                  <p>{message.content}</p>
                  {message.role === "assistant" && message.keyTakeaway && (
                    <div className="notebook-chat-meta">
                      <strong>Key takeaway</strong>
                      <p>{message.keyTakeaway}</p>
                    </div>
                  )}
                  {message.role === "assistant" && Array.isArray(message.sources) && message.sources.length > 0 && (
                    <div className="notebook-source-list" aria-label="Relevant transcript sources">
                      {message.sources.slice(0, 3).map((source, sourceIndex) => (
                        <button
                          key={`${source.label}-${sourceIndex}`}
                          type="button"
                          className="timestamp-chip notebook-source-chip"
                          onClick={() => onSeekTo?.(Number(source.seconds || 0))}
                        >
                          <strong>{source.label || `Source ${sourceIndex + 1}`}</strong>
                          <span>{formatSeconds(source.seconds)}</span>
                          {source.quote && <small>{source.quote}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.role === "assistant" && Array.isArray(message.timestampHints) && message.timestampHints.length > 0 && (
                    <div className="notebook-source-list">
                      {message.timestampHints.slice(0, 3).map((hint, hintIndex) => (
                        <button
                          key={`${hint.label}-${hintIndex}`}
                          type="button"
                          className="timestamp-chip notebook-source-chip"
                          onClick={() => onSeekTo?.(Number(hint.seconds || 0))}
                        >
                          <strong>{hint.label}</strong>
                          <span>{formatSeconds(hint.seconds)}</span>
                          {hint.reason && <small>{hint.reason}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <p>No questions yet. Ask anything about this video.</p>
            )}
          </div>

          <form className="notebook-qa-form" onSubmit={askQuestion}>
            <textarea
              rows="3"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this video"
            />
            <button type="submit" disabled={asking}>
              {asking ? "Thinking..." : "Ask Notebook"}
            </button>
          </form>
        </div>
      )}
    </aside>
  );
};

export default NotebookAssistantPanel;
