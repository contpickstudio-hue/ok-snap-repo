// Vercel serverless function for recipe endpoints
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

