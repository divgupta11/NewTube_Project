const Video = require("../models/Video");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const NOTEBOOKLM_ENDPOINT = process.env.NOTEBOOKLM_ENDPOINT || "";
const NOTEBOOKLM_API_KEY = process.env.NOTEBOOKLM_API_KEY || "";

const cleanArray = (value) => (Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []);

const buildNotebookContext = (video) => {
  const transcript = String(video.transcript || "").trim();
  const description = String(video.description || "").trim();

  return {
    title: video.title || "Untitled",
    description,
    transcript,
    tags: video.tags || [],
    combinedText: [video.title, description, transcript].filter(Boolean).join("\n\n")
  };
};

const callNotebookLM = async (context) => {
  if (!NOTEBOOKLM_ENDPOINT || !NOTEBOOKLM_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(NOTEBOOKLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NOTEBOOKLM_API_KEY}`
      },
      body: JSON.stringify({
        source: "newtube-video",
        content: context
      })
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const callGemini = async (prompt, temperature = 0.4) => {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          topP: 0.9
        }
      })
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("\n") || "";
  return text.trim();
};

const parseJsonFromText = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const fallbackInsights = (context) => {
  const base = context.description || context.title;
  const sentences = base.split(/[.!?]/).map((s) => s.trim()).filter(Boolean);
  const summary = sentences[0] || context.title || "No summary available yet.";
  const keyPoints = sentences.slice(0, 5).map((s) => s.length > 140 ? `${s.slice(0, 140)}...` : s);

  return {
    summary,
    keyPoints: keyPoints.length ? keyPoints : ["Add richer description or transcript to generate AI key points."],
    notes: keyPoints.length ? keyPoints.map((p, i) => `Note ${i + 1}: ${p}`) : ["AI notes will appear after analysis."],
    simplifiedExplanation: summary,
    provider: "local-fallback"
  };
};

const generateInsightsFromContext = async (context, notebookData = null) => {
  const prompt = `You are NewTube AI assistant, powered by NotebookLM + Gemini.
Analyze the video context and return ONLY valid JSON in this schema:
{
  "summary": "short paragraph",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "notes": ["study note 1", "study note 2"],
  "simplifiedExplanation": "easy explanation for beginners"
}
Rules:
- summary max 80 words
- keyPoints 4 to 7 bullets
- notes 4 to 8 bullets
- simplifiedExplanation in very simple language
- no markdown

Video context:
Title: ${context.title}
Description: ${context.description || "N/A"}
Transcript: ${context.transcript || "N/A"}
Notebook Data: ${notebookData ? JSON.stringify(notebookData).slice(0, 4000) : "Not available"}
`;

  if (!GEMINI_API_KEY) {
    return fallbackInsights(context);
  }

  const output = await callGemini(prompt, 0.35);
  const parsed = parseJsonFromText(output);
  if (!parsed) {
    return fallbackInsights(context);
  }

  return {
    summary: String(parsed.summary || "").trim(),
    keyPoints: cleanArray(parsed.keyPoints),
    notes: cleanArray(parsed.notes),
    simplifiedExplanation: String(parsed.simplifiedExplanation || "").trim(),
    provider: "gemini"
  };
};

const generateAndStoreVideoInsights = async (videoId) => {
  const video = await Video.findById(videoId);
  if (!video) throw new Error("Video not found");

  const context = buildNotebookContext(video);
  const notebookData = await callNotebookLM(context);
  const insights = await generateInsightsFromContext(context, notebookData);

  video.aiSummary = insights.summary;
  video.aiKeyPoints = insights.keyPoints;
  video.aiNotes = insights.notes;
  video.aiLearningMode = insights.simplifiedExplanation;
  video.aiProvider = insights.provider;
  video.aiStatus = "ready";
  video.aiLastProcessedAt = new Date();
  video.aiError = "";
  await video.save();

  return {
    status: video.aiStatus,
    summary: video.aiSummary,
    keyPoints: video.aiKeyPoints,
    notes: video.aiNotes,
    learningMode: video.aiLearningMode,
    provider: video.aiProvider,
    updatedAt: video.aiLastProcessedAt
  };
};

const askQuestionAboutVideo = async (video, question) => {
  const context = buildNotebookContext(video);

  const curatedContext = [
    `Title: ${context.title}`,
    `Description: ${context.description || "N/A"}`,
    `Transcript: ${context.transcript || "N/A"}`,
    `Summary: ${video.aiSummary || "N/A"}`,
    `Key Points: ${(video.aiKeyPoints || []).join(" | ") || "N/A"}`,
    `Notes: ${(video.aiNotes || []).join(" | ") || "N/A"}`,
    `Learning Mode: ${video.aiLearningMode || "N/A"}`
  ].join("\n");

  if (!GEMINI_API_KEY) {
    return {
      answer: `AI is running in fallback mode. Based on the video context, this video is about: ${video.aiSummary || context.description || context.title}`,
      provider: "local-fallback"
    };
  }

  const prompt = `You are NewTube AI study assistant. Answer the user question using ONLY the video context.
If context is missing, say that transcript/details are limited.
Keep answer concise, correct, and easy.

Video context:
${curatedContext}

User question:
${question}`;

  const answer = await callGemini(prompt, 0.2);
  return { answer, provider: "gemini" };
};

module.exports = {
  buildNotebookContext,
  generateAndStoreVideoInsights,
  askQuestionAboutVideo
};
