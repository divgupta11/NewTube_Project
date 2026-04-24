const crypto = require("crypto");
const NotebookChunk = require("../models/NotebookChunk");
const NotebookSession = require("../models/NotebookSession");

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const LOCAL_EMBEDDING_DIM = 256;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizeText = (value) => String(value || "").replace(/\r\n/g, "\n").trim();

const hashText = (value) => crypto.createHash("sha256").update(normalizeText(value)).digest("hex");

const parseTimestampToSeconds = (timestamp) => {
  const parts = String(timestamp || "").trim().split(":").map((part) => Number(part));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60) + seconds;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  return null;
};

const formatSeconds = (value) => {
  const seconds = Math.max(0, Math.round(Number(value || 0)));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const getOwnerFilter = ({ userId = null, clientId = "" }) => {
  if (userId) return { user: userId, clientId: "" };
  return { clientId: clientId || "anonymous" };
};

const parseTranscriptSegments = (transcript, durationSeconds = 0) => {
  const text = normalizeText(transcript);
  if (!text) return [];

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const timestampLine = /^\[?(?<time>\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–:|]?\s*(?<text>.+)$/;
  const segments = [];

  for (const line of lines) {
    const match = line.match(timestampLine);
    if (match?.groups?.text) {
      const startSeconds = parseTimestampToSeconds(match.groups.time);
      if (startSeconds !== null) {
        segments.push({
          startSeconds,
          text: match.groups.text.trim()
        });
        continue;
      }
    }

    segments.push({ text: line });
  }

  if (!segments.some((item) => Number.isFinite(item.startSeconds))) {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!sentences.length) return [];

    const total = sentences.reduce((sum, item) => sum + Math.max(item.length, 1), 0);
    let cursor = 0;
    return sentences.map((sentence, index) => {
      const share = Math.max(sentence.length, 1) / total;
      const startSeconds = Math.round(cursor);
      cursor += (Number(durationSeconds || 0) > 0 ? durationSeconds : sentences.length * 12) * share;
      return {
        startSeconds,
        text: sentence,
        endSeconds: Math.round(cursor)
      };
    });
  }

  const fallbackDuration = Number(durationSeconds || 0);
  const chunked = segments.map((segment, index) => ({
    startSeconds: Number.isFinite(segment.startSeconds)
      ? segment.startSeconds
      : Math.round((fallbackDuration > 0 ? fallbackDuration : (index + 1) * 12) * (index / Math.max(segments.length, 1))),
    text: segment.text
  }));

  for (let index = 0; index < chunked.length; index += 1) {
    const current = chunked[index];
    const next = chunked[index + 1];
    current.endSeconds = Number.isFinite(next?.startSeconds)
      ? Math.max(current.startSeconds + 1, next.startSeconds)
      : (fallbackDuration > 0 ? fallbackDuration : current.startSeconds + 12);
  }

  return chunked;
};

const chunkSegments = (segments, { maxChars = 900, overlap = 1 } = {}) => {
  const chunks = [];
  let current = [];
  let currentLength = 0;

  const flush = () => {
    if (!current.length) return;
    const first = current[0];
    const last = current[current.length - 1];
    chunks.push({
      chunkIndex: chunks.length,
      startSeconds: Number(first.startSeconds || 0),
      endSeconds: Number(last.endSeconds || first.startSeconds || 0),
      text: current.map((segment) => segment.text).join(" ").replace(/\s+/g, " ").trim()
    });
  };

  for (const segment of segments) {
    const text = String(segment.text || "").trim();
    if (!text) continue;

    const nextLength = currentLength + text.length + 1;
    if (current.length && nextLength > maxChars) {
      flush();
      current = overlap > 0 ? current.slice(-overlap) : [];
      currentLength = current.reduce((sum, item) => sum + String(item.text || "").length + 1, 0);
    }

    current.push(segment);
    currentLength += text.length + 1;
  }

  flush();
  return chunks;
};

const localEmbedding = (text, dimension = LOCAL_EMBEDDING_DIM) => {
  const vector = new Array(dimension).fill(0);
  const words = normalizeText(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  if (!words.length) return vector;

  for (const word of words) {
    const hash = crypto.createHash("sha256").update(word).digest();
    const bucket = hash.readUInt32BE(0) % dimension;
    const weight = 1 + Math.min(word.length / 8, 1);
    vector[bucket] += weight;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
};

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = Number(a[index] || 0);
    const bv = Number(b[index] || 0);
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }

  if (!aNorm || !bNorm) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
};

const embedTextsWithOpenAI = async (texts) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_EMBEDDING_MODEL,
      input: texts
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "OpenAI embeddings request failed";
    throw new Error(message);
  }

  return (payload.data || [])
    .sort((left, right) => left.index - right.index)
    .map((item) => (Array.isArray(item.embedding) ? item.embedding : []));
};

const embedTexts = async (texts) => {
  const normalized = texts.map((text) => normalizeText(text));
  if (!normalized.length) return [];

  if (process.env.OPENAI_API_KEY) {
    try {
      return await embedTextsWithOpenAI(normalized);
    } catch (error) {
      console.warn("Falling back to local embeddings:", error.message);
    }
  }

  return normalized.map((text) => localEmbedding(text));
};

const buildChunkLabel = (chunk) => {
  const start = formatSeconds(chunk.startSeconds);
  const end = formatSeconds(chunk.endSeconds);
  return `${start}${end ? ` - ${end}` : ""}`;
};

const ensureTranscriptChunks = async ({ video, userId = null, clientId = "" }) => {
  const transcript = normalizeText(video?.transcript || "");
  if (!transcript) {
    return {
      transcriptHash: "",
      chunks: [],
      rebuilt: false
    };
  }

  const ownerFilter = getOwnerFilter({ userId, clientId });
  const transcriptHash = hashText(transcript);
  const existingSession = await NotebookSession.findOne({ video: video._id, ...ownerFilter }).lean();

  if (existingSession?.transcriptHash === transcriptHash && Number(existingSession.transcriptChunkCount || 0) > 0) {
    const existingChunks = await NotebookChunk.find({ video: video._id, ...ownerFilter, transcriptHash })
      .sort({ chunkIndex: 1 })
      .lean();

    if (existingChunks.length) {
      return {
        transcriptHash,
        chunks: existingChunks,
        rebuilt: false
      };
    }
  }

  const segments = parseTranscriptSegments(transcript, Number(video.durationSeconds || 0));
  const rawChunks = chunkSegments(segments, { maxChars: 900, overlap: 1 });
  const embeddings = await embedTexts(rawChunks.map((chunk) => chunk.text));

  await NotebookChunk.deleteMany({ video: video._id, ...ownerFilter });

  const docs = rawChunks.map((chunk, index) => ({
    ...ownerFilter,
    video: video._id,
    transcriptHash,
    chunkIndex: index,
    startSeconds: chunk.startSeconds || 0,
    endSeconds: chunk.endSeconds || 0,
    text: chunk.text,
    embedding: embeddings[index] || localEmbedding(chunk.text)
  }));

  if (docs.length) {
    await NotebookChunk.insertMany(docs);
  }

  await NotebookSession.findOneAndUpdate(
    { video: video._id, ...ownerFilter },
    {
      $set: {
        transcriptHash,
        transcriptChunkCount: docs.length,
        transcriptSnapshot: transcript,
        lastProcessedAt: new Date()
      },
      $setOnInsert: {
        video: video._id,
        user: userId || null,
        clientId: userId ? "" : (clientId || "anonymous"),
        messages: [],
        notes: []
      }
    },
    { upsert: true, new: true }
  );

  return {
    transcriptHash,
    chunks: docs,
    rebuilt: true
  };
};

const retrieveRelevantChunks = async ({ video, userId = null, clientId = "", question, limit = 5 }) => {
  const { chunks } = await ensureTranscriptChunks({ video, userId, clientId });
  if (!chunks.length) return [];

  const questionEmbedding = (await embedTexts([question]))[0] || localEmbedding(question);
  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(chunk.embedding || [], questionEmbedding)
  }));

  return scored
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0);
    })
    .slice(0, limit)
    .map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      startSeconds: chunk.startSeconds || 0,
      endSeconds: chunk.endSeconds || 0,
      label: buildChunkLabel(chunk),
      score: Number(chunk.score || 0)
    }));
};

const buildContextFromChunks = (chunks, fallbackText = "") => {
  if (!chunks.length) {
    return normalizeText(fallbackText);
  }

  return chunks
    .map((chunk, index) => [
      `Chunk ${index + 1} (${chunk.label})`,
      chunk.text
    ].join("\n"))
    .join("\n\n");
};

module.exports = {
  ensureTranscriptChunks,
  retrieveRelevantChunks,
  buildContextFromChunks,
  parseTranscriptSegments,
  chunkSegments,
  localEmbedding,
  cosineSimilarity,
  formatSeconds,
  hashText
};
