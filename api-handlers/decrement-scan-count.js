// Vercel serverless function to decrement scan count (for ad recharges)
module.exports = async (req, res) => {
    // === GLOBAL CORS HEADERS ===
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // === PRE-FLIGHT REQUEST ===
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { ErrorResponse } = require('../lib/error-response');
    
    if (req.method !== 'POST') {
        return ErrorResponse.methodNotAllowed(res);
    }

    try {
        const { userId, userIp, decrementAmount = 1 } = req.body;
        
        const userIpFromHeaders = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                                 req.headers['x-real-ip'] || 
                                 '127.0.0.1';
        
        const finalUserIp = userIp || userIpFromHeaders;
        const finalUserId = userId || null;
        
        const result = await decrementScanCount(finalUserId, finalUserIp, decrementAmount);
        return res.status(200).json(result);
    } catch (err) {
        return ErrorResponse.internalServerError(res, 'Failed to decrement scan count', err);
    }
}

// Use persistent rate limiting storage via shared module
const rateLimitStorage = require('../lib/rate-limit-storage');

async function decrementScanCount(userId, userIp, decrementAmount) {
    return await rateLimitStorage.decrementScanCount(userId, userIp, decrementAmount);
}

