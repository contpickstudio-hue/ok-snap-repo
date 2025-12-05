// Vercel serverless function for scan limit checking
export default async function handler(req, res) {
    // CORS headers - must be set before any response
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://ok-snap-repo.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080'
    ];
    
    // Allow Vercel preview deployments (pattern: *.vercel.app)
    const isVercelPreview = origin && origin.endsWith('.vercel.app');
    const isAllowedOrigin = allowedOrigins.includes(origin) || isVercelPreview;
    
    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Default to production URL
        res.setHeader('Access-Control-Allow-Origin', 'https://ok-snap-repo.vercel.app');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const userId = req.query.userId || null;
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

