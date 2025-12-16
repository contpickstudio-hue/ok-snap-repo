// Vercel serverless function for scan limit checking
// Uses shared CORS utility for consistent CORS handling across all API routes
const { setCorsHeaders, handlePreflight } = require('./_cors');

module.exports = async (req, res) => {
    // Set CORS headers on every response - MUST be first
    setCorsHeaders(req, res);
    
    // Handle OPTIONS preflight requests - return immediately, do NOT run business logic
    if (handlePreflight(req, res)) {
        return; // Preflight handled, exit early
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
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
        res.json(remainingInfo);
    } catch (error) {
        console.error('Error getting scan limit:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

const scanLimits = {
    guest: 3,
    free: 5
};

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function getUserLevel(userId) {
    if (!userId) return 'guest';
    return 'free';
}

// In-memory store (for serverless, consider using Vercel KV or similar)
// NOTE: This is separate from identify.js store - serverless functions don't share memory
// For production, use Vercel KV or a database for shared state
const dailyScansStore = new Map();
const guestScansByIp = new Map();

async function getRemainingScans(userId, userIp) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    
    const record = dailyScansStore.get(key);
    
    // If no record or different day, user has full limit remaining
    if (!record || record.date !== today) {
        return { remaining: limit, limit, level: userLevel };
    }
    
    // Return remaining scans (limit - count used)
    return { 
        remaining: Math.max(0, limit - record.count), 
        limit,
        level: userLevel
    };
}

