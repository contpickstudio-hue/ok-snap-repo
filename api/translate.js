// Vercel serverless function for translation endpoints
// Uses shared CORS utility for consistent CORS handling across all API routes
const { setCorsHeaders, handlePreflight } = require('./_cors');

module.exports = async (req, res) => {
    // Set CORS headers on every response - MUST be first
    setCorsHeaders(req, res);
    
    // Handle OPTIONS preflight requests - return immediately, do NOT run business logic
    if (handlePreflight(req, res)) {
        return; // Preflight handled, exit early
    }

    // Placeholder - translation is handled by OpenAI in identify endpoint
    // This endpoint can be extended for future translation API integrations
    res.json({ 
        message: 'Translation is handled by OpenAI in identify endpoint',
        status: 'ok' 
    });
}

