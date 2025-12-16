// Vercel serverless function for recipe endpoints
// Uses shared CORS utility for consistent CORS handling across all API routes
const { setCorsHeaders, handlePreflight } = require('./_cors');

module.exports = async (req, res) => {
    // Set CORS headers on every response - MUST be first
    setCorsHeaders(req, res);
    
    // Handle OPTIONS preflight requests - return immediately, do NOT run business logic
    if (handlePreflight(req, res)) {
        return; // Preflight handled, exit early
    }

    // Placeholder - recipe links are generated client-side
    // This endpoint can be extended for future recipe API integrations
    res.json({ 
        message: 'Recipe links are generated client-side',
        status: 'ok' 
    });
}

