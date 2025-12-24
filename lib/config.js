// Configuration utility for environment variables with safe defaults
// Ensures consistent URL configuration across the application

/**
 * Get the public site URL (main website URL)
 * @returns {string} Public site URL, defaults to https://ok-snap.com
 */
function getPublicSiteUrl() {
    return process.env.PUBLIC_SITE_URL || 'https://ok-snap.com';
}

/**
 * Get the API base URL
 * For backend: uses env var or derives from request origin
 * For frontend: should use config endpoint or detect from origin
 * @param {Object} req - Express request object (optional, for backend)
 * @returns {string} API base URL
 */
function getApiBaseUrl(req = null) {
    // If env var is set, use it
    if (process.env.API_BASE_URL) {
        return process.env.API_BASE_URL;
    }
    
    // For backend, try to derive from request origin if available
    if (req) {
        const protocol = req.protocol || 'https';
        const host = req.get('host');
        if (host) {
            return `${protocol}://${host}`;
        }
    }
    
    // Default fallback
    return process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'https://ok-snap-identifier.vercel.app';
}

module.exports = {
    getPublicSiteUrl,
    getApiBaseUrl
};

