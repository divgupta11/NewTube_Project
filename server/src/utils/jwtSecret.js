const DEFAULT_JWT_SECRET = "youtube-clone-fallback-secret";

const getJwtSecret = () => (process.env.JWT_SECRET || DEFAULT_JWT_SECRET).trim();

module.exports = getJwtSecret;
