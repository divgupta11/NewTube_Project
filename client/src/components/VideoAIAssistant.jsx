import { useEffect, useState } from "react";
import axios from "axios";
import { MdAutoAwesome, MdRefresh, MdQuiz, MdNotes } from "react-icons/md";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const VideoAIAssistant = ({ videoId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    setError("");
    try {
      const { data: payload } = await axios.get(`${apiBase}/videos/${videoId}/ai`, { headers: authHeaders() });
      setData(payload);
    } catch (err) {
      const message = !err.response
        ? "Network error. Please ensure backend is running on port 5000."
        : err.response?.data?.message || "Unable to load AI assistant.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setAnswer("");
    load();
  }, [videoId]);

  const runAnalyze = async () => {
    setError("");
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Login required to refresh AI analysis.");
      return;
    }

    try {
      setAnalyzing(true);
      const { data: payload } = await axios.post(`${apiBase}/videos/${videoId}/ai/analyze`, {}, { headers: authHeaders() });
      setData((prev) => ({ ...(prev || {}), ...payload, status: "ready" }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to run AI analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  const askQuestion = async (event) => {
    event.preventDefault();
    if (!question.trim()) return;

    try {
      setAsking(true);
      setError("");
      const { data: payload } = await axios.post(`${apiBase}/videos/${videoId}/ai/ask`, { question: question.trim() }, { headers: authHeaders() });
      setAnswer(payload.answer || "No answer returned.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to answer this question.");
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return <section className="ai-panel"><p className="empty-text">Loading AI assistant...</p></section>;
  }

  return (
    <section className="ai-panel">
      <div className="ai-panel-head">
        <h3><MdAutoAwesome size={18} /> NewTube AI Assistant</h3>
        <button className="ripple" type="button" onClick={runAnalyze} disabled={analyzing}>
          <MdRefresh size={16} /> {analyzing ? "Analyzing..." : "Refresh AI"}
        </button>
      </div>

      {error && <p className="empty-text">{error}</p>}

      {data?.status === "pending" && <p className="empty-text">AI is analyzing this video in the background.</p>}
      {data?.status === "error" && <p className="empty-text">AI analysis failed: {data?.error || "Unknown error"}</p>}

      <article className="ai-block">
        <h4>AI Summary</h4>
        <p>{data?.summary || "Summary not available yet."}</p>
      </article>

      <article className="ai-block">
        <h4>AI Key Points</h4>
        <ul>
          {(data?.keyPoints || []).length ? data.keyPoints.map((item, index) => <li key={index}>{item}</li>) : <li>Key points will appear after analysis.</li>}
        </ul>
      </article>

      <article className="ai-block">
        <h4><MdNotes size={16} /> AI Notes</h4>
        <ul>
          {(data?.notes || []).length ? data.notes.map((item, index) => <li key={index}>{item}</li>) : <li>Notes will appear after analysis.</li>}
        </ul>
      </article>

      <article className="ai-block">
        <h4>AI Learning Mode</h4>
        <p>{data?.learningMode || "Simple explanation will appear after AI processing."}</p>
      </article>

      <article className="ai-block">
        <h4><MdQuiz size={16} /> Ask About This Video</h4>
        <form className="ai-qa-form" onSubmit={askQuestion}>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question about this video"
          />
          <button className="ripple" type="submit" disabled={asking}>{asking ? "Asking..." : "Ask AI"}</button>
        </form>
        {answer && <p className="ai-answer">{answer}</p>}
      </article>

      <small className="empty-text">Provider: {data?.provider || "local-fallback"}</small>
    </section>
  );
};

export default VideoAIAssistant;
