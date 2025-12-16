// Vercel serverless function for recipe endpoints
module.exports = async function handler(req, res) {
    // CORS headers - must be set before any response
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://ok-snap-identifier.vercel.app',
        'https://ok-snap-repo.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080'
    ];
    
    // Native apps (Capacitor) don't send origin header - allow them
    const isNativeApp = !origin;
    
    // Allow Vercel preview deployments (pattern: *.vercel.app)
    const isVercelPreview = origin && origin.endsWith('.vercel.app');
    const isAllowedOrigin = isNativeApp || allowedOrigins.includes(origin) || isVercelPreview;
    
    if (isNativeApp) {
        // Native app - allow all origins (no origin header means it's a native app)
        res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (isAllowedOrigin) {
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

    // Placeholder - recipe links are generated client-side
    // This endpoint can be extended for future recipe API integrations
    res.json({ 
        message: 'Recipe links are generated client-side',
        status: 'ok' 
    });
}

