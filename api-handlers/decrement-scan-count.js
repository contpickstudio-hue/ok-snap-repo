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

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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
        console.error('Decrement scan count API error:', err);
        return res.status(500).json({ error: 'Failed to decrement scan count' });
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

// In-memory store (shared with identify.js logic)
// NOTE: In serverless, this is per-instance. For production, use Vercel KV or database
const dailyScansStore = new Map();

async function decrementScanCount(userId, userIp, decrementAmount) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    
    const record = dailyScansStore.get(key);
    
    if (!record || record.date !== today) {
        // No record exists - can't decrement, but return success
        return { 
            success: true, 
            remaining: limit, 
            limit, 
            level: userLevel,
            message: 'No scan count to decrement'
        };
    }
    
    // Decrement the count (but don't go below 0)
    record.count = Math.max(0, record.count - decrementAmount);
    dailyScansStore.set(key, record);
    
    return {
        success: true,
        remaining: Math.max(0, limit - record.count),
        limit,
        level: userLevel,
        count: record.count
    };
}

