const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const {
  retrieveRelevantChunks,
  buildContextFromChunks
} = require("./notebookRagService");
const MAX_SOURCE_CHARS = 18000;
let geminiDisabledForProcess = false;
let openAiDisabledForProcess = false;

const clampText = (value, maxChars = MAX_SOURCE_CHARS) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;

  const head = text.slice(0, Math.floor(maxChars * 0.65));
  const tail = text.slice(-Math.floor(maxChars * 0.2));
  return `${head}\n\n[Transcript trimmed for token limits]\n\n${tail}`;
};

const buildNotebookSource = (video) => {
  const transcript = clampText(video.transcript || "");
  const source = [
    `Video title: ${video.title || "Untitled video"}`,
    `Video URL: ${video.videoUrl || ""}`,
    `Description: ${video.description || ""}`,
    `Tags: ${(video.tags || []).join(", ")}`,
    `Duration seconds: ${Number(video.durationSeconds || 0)}`,
    `Transcript:`,
    transcript || "No transcript was provided for this video.",
    `Cached summary: ${video.aiSummary || ""}`,
    `Cached short summary: ${video.aiLearningMode || ""}`,
    `Cached key points: ${(video.aiKeyPoints || []).join(" | ")}`
  ].join("\n");

  return {
    transcript,
    source
  };
};

const buildChunkContext = async ({ video, session, question, limit = 6 }) => {
  const chunks = await retrieveRelevantChunks({
    video,
    userId: session?.user || null,
    clientId: session?.clientId || "",
    question: question || video.title || "summarize this video",
    limit
  });

  return {
    chunks,
    source: chunks.length ? buildContextFromChunks(chunks, video.transcript || "") : clampText(video.transcript || "")
  };
};

const extractTextOutput = (responseJson) => {
  if (typeof responseJson?.output_text === "string" && responseJson.output_text.trim()) {
    return responseJson.output_text.trim();
  }

  const message = (responseJson?.output || []).find((item) => item?.type === "message");
  const textItem = message?.content?.find((item) => item?.type === "output_text" || item?.type === "text");
  return String(textItem?.text || "").trim();
};

const extractGeminiText = (payload) => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const content = candidates[0]?.content;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  return parts.map((part) => part?.text || "").join("").trim();
};

const extractJsonFromText = (text) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      const fencedText = fenced[1].trim();
      JSON.parse(fencedText);
      return fencedText;
    }

    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      const slice = trimmed.slice(first, last + 1);
      JSON.parse(slice);
      return slice;
    }
  }

  throw new Error("Model response was not valid JSON");
};

const parseStructuredOutput = (payload, fallbackLabel) => {
  const text = extractTextOutput(payload);
  if (!text) {
    throw new Error(`OpenAI returned no structured output for ${fallbackLabel}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse OpenAI ${fallbackLabel} response: ${error.message}`);
  }
};

const parseGeminiStructuredOutput = (payload, fallbackLabel) => {
  const text = extractGeminiText(payload);
  if (!text) {
    throw new Error(`Gemini returned no structured output for ${fallbackLabel}`);
  }

  try {
    return JSON.parse(extractJsonFromText(text));
  } catch (error) {
    throw new Error(`Failed to parse Gemini ${fallbackLabel} response: ${error.message}`);
  }
};

const callOpenAI = async ({ instructions, schemaName, schema, input }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_OPENAI_MODEL,
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "OpenAI request failed";
    throw new Error(message);
  }

  return payload;
};

const callGemini = async ({ instructions, inputText }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${instructions}\n\n${inputText}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Gemini request failed";
    throw new Error(message);
  }

  return payload;
};

const createSummarySchema = () => ({
  type: "object",
  additionalProperties: false,
  properties: {
    shortSummary: { type: "string" },
    detailedSummary: { type: "string" },
    keyPoints: {
      type: "array",
      items: { type: "string" }
    },
    aiNotes: {
      type: "array",
      items: { type: "string" }
    },
    highlights: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          seconds: { type: "number" },
          reason: { type: "string" }
        },
        required: ["label", "seconds", "reason"]
      }
    },
    followUpQuestions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["shortSummary", "detailedSummary", "keyPoints", "aiNotes", "highlights", "followUpQuestions"]
});

const createAnswerSchema = () => ({
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    keyTakeaway: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          seconds: { type: "number" },
          quote: { type: "string" },
          chunkIndex: { type: "number" }
        },
        required: ["label", "seconds", "quote", "chunkIndex"]
      }
    },
    timestampHints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          seconds: { type: "number" },
          reason: { type: "string" }
        },
        required: ["label", "seconds", "reason"]
      }
    },
    followUpQuestions: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["answer", "keyTakeaway", "sources", "timestampHints", "followUpQuestions"]
});

const buildBaseInstructions = () => [
  "You are NewTube Notebook, a NotebookLM-style assistant for a single video source.",
  "Use only the provided source material and the existing notebook history.",
  "Always answer in English only.",
  "Be concise, structured, calm, and notebook-like, not chatty.",
  "If the source is missing details, say so clearly instead of inventing facts.",
  "Prefer bullets, headings, and practical next steps."
].join(" ");

const buildSummaryPrompt = ({ video, session, mode, source }) => [
  `Mode: ${mode}`,
  `Return valid JSON with keys shortSummary, detailedSummary, keyPoints, aiNotes, highlights, followUpQuestions.`,
  `Video title: ${video.title || ""}`,
  `Conversation history:`,
  JSON.stringify((session?.messages || []).slice(-12), null, 2),
  `User notes:`,
  JSON.stringify((session?.notes || []).slice(-12), null, 2),
  `Source material:`,
  source
].join("\n");

const buildAnswerPrompt = ({ question, session, source, chunks }) => [
  `User question: ${question}`,
  `Return valid JSON with keys answer, keyTakeaway, sources, timestampHints, followUpQuestions.`,
  `Answer strictly from the source material. If the source does not support the answer, say so clearly.`,
  `Use timestamp-based citations when relevant.`,
  `Conversation history:`,
  JSON.stringify((session?.messages || []).slice(-16), null, 2),
  `User notes:`,
  JSON.stringify((session?.notes || []).slice(-12), null, 2),
  `Retrieved chunks:`,
  JSON.stringify(chunks || [], null, 2),
  `Source material:`,
  source
].join("\n");

const localSummary = ({ video, mode, source }) => {
  const transcript = String(video.transcript || source || "").trim();
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const keyPoints = [];
  const seedPoints = [
    video.title,
    video.description,
    ...(Array.isArray(video.tags) ? video.tags : []),
    ...sentences.slice(0, 4)
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  for (const item of seedPoints) {
    if (!keyPoints.includes(item)) {
      keyPoints.push(item);
    }
    if (keyPoints.length >= 5) break;
  }

  const highlights = keyPoints.slice(0, 3).map((item, index) => ({
    label: `Highlight ${index + 1}`,
    seconds: Math.max(0, Math.round(((index + 1) / 4) * Number(video.durationSeconds || 0))),
    reason: item
  }));

  return {
    shortSummary: mode === "short"
      ? (sentences[0] || video.description || "A concise notebook summary is not available yet.")
      : (sentences.slice(0, 2).join(" ") || video.description || "A concise notebook summary is not available yet."),
    detailedSummary: sentences.slice(0, 8).join(" ") || video.description || "A detailed notebook summary is not available yet.",
    keyPoints: keyPoints.slice(0, 6),
    aiNotes: keyPoints.slice(0, 4).map((item) => `Review: ${item}`),
    highlights,
    followUpQuestions: [
      "What is the main takeaway from this video?",
      "Which examples or timestamps support the conclusion?",
      "What should I remember after watching this?"
    ],
    __provider: "local"
  };
};

const localAnswer = ({ video, question }) => {
  const transcript = String(video.transcript || "").trim();
  const keywords = String(question || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 3);
  const bestMatch = transcript
    .split(/(?<=[.!?])\s+/)
    .find((sentence) => keywords.some((word) => sentence.toLowerCase().includes(word)));

  return {
    answer: bestMatch || video.description || "I could not find a strong transcript match, but the notebook context is available.",
    keyTakeaway: video.title || "Review the current video context for the main idea.",
    sources: [
      {
        label: "Best matching section",
        seconds: Math.round(Number(video.durationSeconds || 0) * 0.5),
        quote: bestMatch || video.description || "",
        chunkIndex: 0
      }
    ],
    timestampHints: [
      {
        label: "Open the middle section",
        seconds: Math.round(Number(video.durationSeconds || 0) * 0.5),
        reason: "A good mid-video checkpoint for review."
      }
    ],
    followUpQuestions: [
      "What part of the video explains this most clearly?",
      "Can you summarize the core idea in one paragraph?",
      "Which timestamp is the most important?"
    ],
    __provider: "local"
  };
};

const structuredNotebookCall = async ({ schemaName, schema, prompt, fallbackFn }) => {
  try {
    if (process.env.GEMINI_API_KEY && !geminiDisabledForProcess) {
      const payload = await callGemini({
        instructions: `${buildBaseInstructions()} Return only valid JSON with no markdown.`,
        inputText: prompt
      });

      return {
        ...parseGeminiStructuredOutput(payload, schemaName),
        __provider: "gemini"
      };
    }
  } catch (error) {
    const message = String(error?.message || "");
    geminiDisabledForProcess = /api key|leaked|invalid|permission|unauthorized/i.test(message);
    console.error(
      `Notebook Gemini call failed for ${schemaName}:`,
      geminiDisabledForProcess ? "Gemini API key is invalid or rejected; using local fallback." : message
    );
  }

  try {
    if (process.env.OPENAI_API_KEY && !openAiDisabledForProcess) {
      const payload = await callOpenAI({
        instructions: buildBaseInstructions(),
        schemaName,
        schema,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: prompt
              }
            ]
          }
        ]
      });

      return {
        ...parseStructuredOutput(payload, schemaName),
        __provider: "openai"
      };
    }
  } catch (error) {
    const message = String(error?.message || "");
    openAiDisabledForProcess = /api key|invalid|permission|unauthorized/i.test(message);
    console.error(
      `Notebook OpenAI call failed for ${schemaName}:`,
      openAiDisabledForProcess ? "OpenAI API key is invalid or rejected; using local fallback." : message
    );
  }

  return {
    ...fallbackFn(),
    __provider: "local"
  };
};

const summarizeVideo = async ({ video, session, mode = "detailed" }) => {
  const chunkContext = await buildChunkContext({ video, session, question: "Summarize this video", limit: 10 });
  return structuredNotebookCall({
    schemaName: "notebook_summary",
    schema: createSummarySchema(),
    prompt: buildSummaryPrompt({ video, session, mode, source: chunkContext.source }),
    fallbackFn: () => localSummary({ video, mode, source: chunkContext.source })
  });
};

const answerQuestion = async ({ video, session, question }) => {
  const chunkContext = await buildChunkContext({ video, session, question, limit: 6 });
  return structuredNotebookCall({
    schemaName: "notebook_answer",
    schema: createAnswerSchema(),
    prompt: buildAnswerPrompt({ question, session, source: chunkContext.source, chunks: chunkContext.chunks }),
    fallbackFn: () => localAnswer({ video, question, source: chunkContext.source })
  });
};

module.exports = {
  buildNotebookSource,
  summarizeVideo,
  answerQuestion
};
