// Shared CORS utility for all API routes
// CORS (Cross-Origin Resource Sharing) allows web pages to make requests
// to APIs hosted on different domains. This is required for:
// - Web apps accessing APIs from different origins
// - Preview deployments accessing production APIs
// - Development (localhost) accessing deployed APIs

/**
 * Sets CORS headers on response object
 * Must be called before any response is sent
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
function setCorsHeaders(req, res) {
    const config = require('../lib/config');
    const origin = req.headers.origin;
    
    // Get base URLs for fallback defaults
    const apiBaseUrl = config.getApiBaseUrl(req);
    const publicSiteUrl = config.getPublicSiteUrl();
    
    // Required production origins (always allowed regardless of ALLOWED_ORIGINS)
    const requiredOrigins = [
        'https://scanner.ok-snap.com',
        'https://recipes.ok-snap.com',
        apiBaseUrl,
        publicSiteUrl
    ];
    // Default dev + required
    const defaultOrigins = [
        ...requiredOrigins,
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080'
    ];
    // Merge ALLOWED_ORIGINS with required origins so scanner/recipes always work
    const envOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0)
        : [];
    const allowedOrigins = [...new Set([...requiredOrigins, ...defaultOrigins, ...envOrigins])];
    
    // Allow Vercel preview deployments (pattern: *.vercel.app)
    const isVercelPreview = origin && origin.endsWith('.vercel.app');
    const isAllowedOrigin = allowedOrigins.includes(origin) || isVercelPreview;
    
    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        // Default to public site URL
        res.setHeader('Access-Control-Allow-Origin', publicSiteUrl);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours - cache preflight responses
}

/**
 * Handles OPTIONS preflight requests
 * Browsers send OPTIONS requests before actual requests to check CORS permissions
 * Must return immediately with CORS headers, do NOT run business logic
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {boolean} - true if OPTIONS was handled, false otherwise
 */
function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(req, res);
        res.status(200).end();
        return true;
    }
    return false;
}

module.exports = {
    setCorsHeaders,
    handlePreflight
};

