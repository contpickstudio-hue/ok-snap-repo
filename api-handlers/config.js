// API endpoint to serve frontend configuration
// Allows frontend to access environment variables that aren't available at build time
module.exports = async (req, res) => {
    // === GLOBAL CORS HEADERS ===
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // === PRE-FLIGHT REQUEST ===
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { ErrorResponse } = require('../lib/error-response');
    
    if (req.method !== 'GET') {
        return ErrorResponse.methodNotAllowed(res);
    }

    try {
        const config = require('../lib/config');
        
        const configData = {
            PUBLIC_SITE_URL: config.getPublicSiteUrl(),
            API_BASE_URL: config.getApiBaseUrl(req)
        };
        
        return res.status(200).json(configData);
    } catch (err) {
        // Return safe defaults on error (don't fail config endpoint)
        console.error('Config API error:', err);
        return res.status(200).json({
            PUBLIC_SITE_URL: 'https://ok-snap.com',
            API_BASE_URL: 'https://ok-snap-identifier.vercel.app'
        });
    }
};

