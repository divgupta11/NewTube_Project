const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+\-.]*:/i;

export const resolvePublicUrl = (value) => {
  if (!value) return "";

  const raw = String(value).trim();
  if (!raw) return "";
  if (ABSOLUTE_URL_PATTERN.test(raw)) return raw;

  const baseUrl = import.meta.env.VITE_SERVER_URL?.trim() || window.location.origin;
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = raw.startsWith("/") ? raw.slice(1) : raw;

  return new URL(normalizedPath, normalizedBase).toString();
};
