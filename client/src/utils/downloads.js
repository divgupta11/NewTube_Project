const DB_NAME = "newtube_downloads_db";
const STORE_NAME = "videos";
const DB_VERSION = 1;

const openDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
});

const saveRecord = async (record) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to save download"));
  });
  db.close();
};

const getAllRecords = async () => {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error || new Error("Failed to read downloads"));
  });
  db.close();
  return rows;
};

const deleteRecord = async (id) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to delete download"));
  });
  db.close();
};

const normalizeUrl = (url, fallbackBase = "") => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${fallbackBase}${url}`;
};

export const downloadAndStoreVideo = async (video, serverUrl = "") => {
  const url = normalizeUrl(video.videoUrl || video.url, serverUrl);
  if (!url) throw new Error("Video URL not available");

  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to download video file");
  const blob = await response.blob();

  const id = String(video._id || video.id || `download-${Date.now()}`);
  await saveRecord({
    id,
    title: video.title || "Downloaded Video",
    channelName: video.user?.username || video.channelName || "Channel",
    thumbnailUrl: video.thumbnailUrl || video.thumbnail || "",
    isShort: Boolean(video.isShort),
    sourceUrl: url,
    mimeType: blob.type || "video/mp4",
    downloadedAt: new Date().toISOString(),
    blob
  });
};

export const getDownloadedVideos = async () => {
  const rows = await getAllRecords();
  return rows
    .sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime())
    .map((item) => ({
      _id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      videoUrl: URL.createObjectURL(item.blob),
      isShort: Boolean(item.isShort),
      downloadedAt: item.downloadedAt,
      isDownloaded: true,
      user: { username: item.channelName || "Channel" }
    }));
};

export const removeDownloadedVideo = async (id) => {
  await deleteRecord(id);
};
