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
        return res.status(200).json(remainingInfo);
    } catch (err) {
        console.error('Scan limit API error:', err);
        return res.status(500).json({ error: 'Scan limit check failed' });
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

