// CLIENT_URL may hold one origin or several, separated by commas
// (for example your production site and a Vercel preview URL).
const allowedOrigins = () =>
    (process.env.CLIENT_URL || "")
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean);

const isLocalDevOrigin = (origin) => {
    if (!origin) return false;

    try {
        const { hostname, protocol } = new URL(origin);
        const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(hostname);
        return isLocalHost && ["http:", "https:"].includes(protocol);
    } catch {
        return false;
    }
};

const originCheck = (origin, callback) => {
    const allowed = allowedOrigins();

    // No Origin header: curl, k6, server-to-server. No list configured: allow all.
    // Localhost dev ports can change (5173, 5174, etc.) so they must not be rejected.
    if (!origin || allowed.length === 0 || allowed.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
    }

    callback(null, false);
};

module.exports = { originCheck, allowedOrigins };
