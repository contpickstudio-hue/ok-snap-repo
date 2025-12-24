// Vercel serverless function for scan limit checking
module.exports = async (req, res) => {
    // === GLOBAL CORS HEADERS ===
    // MUST be set before ANY response or logic
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
        // Handle userId - if empty string, treat as null to avoid unnecessary processing
        let userId = req.query.userId;
        if (userId === '' || userId === 'null' || userId === 'undefined') {
            userId = null;
        }
        
        const userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                       req.headers['x-real-ip'] || 
                       '127.0.0.1';
        
        const remainingInfo = await getRemainingScans(userId, userIp);
        return res.status(200).json(remainingInfo);
    } catch (err) {
        return ErrorResponse.internalServerError(res, 'Failed to check scan limit', err);
    }
}

// Use persistent rate limiting storage via shared module
const rateLimitStorage = require('../lib/rate-limit-storage');

async function getRemainingScans(userId, userIp) {
    return await rateLimitStorage.getRemainingScans(userId, userIp);
}

