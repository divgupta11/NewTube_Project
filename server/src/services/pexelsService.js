const PEXELS_BASE = "https://api.pexels.com/videos";
const FALLBACK_PEXELS_KEY = "5gTSSTjEhBbX308NsmCQOTNp5OUtz8B8kQhS1rAwGisFHrSl3B5TWgDt";

const getPexelsApiKey = () => (process.env.PEXELS_API_KEY || FALLBACK_PEXELS_KEY || "").trim();

const slugToTitle = (value) => {
  if (!value) return "Pexels Video";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const deriveTitle = (video) => {
  const url = String(video.url || "");
  const match = url.match(/\/video\/([^/]+)\/?$/i);
  if (match?.[1]) {
    return slugToTitle(match[1]);
  }
  return `Pexels Clip ${video.id}`;
};

const pickPlayableFile = (files = []) => {
  const mp4Files = files.filter((file) => String(file.file_type || "").toLowerCase() === "video/mp4" && file.link);
  if (!mp4Files.length) return "";

  const preferred = mp4Files
    .filter((file) => Number(file.width || 0) <= 1080)
    .sort((a, b) => Number(b.width || 0) - Number(a.width || 0));

  if (preferred.length) return preferred[0].link;
  return mp4Files[0].link;
};

const mapPexelsVideo = (video, type = "trending") => ({
  _id: `pexels-${video.id}`,
  title: deriveTitle(video),
  description: `Source: Pexels ${type === "shorts" ? "Shorts" : "Trending"}`,
  transcript: "",
  videoUrl: pickPlayableFile(video.video_files || []),
  thumbnailUrl: video.image || "",
  tags: ["pexels", type],
  isShort: type === "shorts",
  isTrending: type === "trending",
  views: Number(video.id || 0) % 150000,
  createdAt: new Date().toISOString(),
  user: {
    _id: `pexels-user-${video.user?.id || "unknown"}`,
    username: video.user?.name || "Pexels Creator",
    avatar: `https://i.pravatar.cc/120?u=pexels-${video.user?.id || "unknown"}`,
    subscribers: []
  }
});

const pexelsFetch = async (path) => {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is not configured");
  }

  const response = await fetch(`${PEXELS_BASE}${path}`, {
    headers: {
      Authorization: apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pexels request failed: ${response.status} ${text}`);
  }

  return response.json();
};

const fetchTrendingFromPexels = async () => {
  const payload = await pexelsFetch("/popular?per_page=18&page=1");
  return (payload.videos || []).map((video) => mapPexelsVideo(video, "trending")).filter((video) => video.videoUrl);
};

const fetchShortsFromPexels = async () => {
  const payload = await pexelsFetch("/search?query=travel&orientation=portrait&per_page=18&page=1");
  return (payload.videos || []).map((video) => mapPexelsVideo(video, "shorts")).filter((video) => video.videoUrl);
};

const fetchPexelsVideoById = async (videoId) => {
  const payload = await pexelsFetch(`/videos/${videoId}`);
  if (!payload?.id) return null;

  const type = Number(payload.height || 0) > Number(payload.width || 0) ? "shorts" : "trending";
  return mapPexelsVideo(payload, type);
};

const checkPexelsHealth = async () => {
  try {
    const items = await fetchTrendingFromPexels();
    return { ok: true, provider: "pexels", count: items.length };
  } catch (error) {
    return { ok: false, provider: "pexels", reason: error.message };
  }
};

module.exports = {
  fetchTrendingFromPexels,
  fetchShortsFromPexels,
  fetchPexelsVideoById,
  checkPexelsHealth
};
