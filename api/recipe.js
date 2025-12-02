// Vercel serverless function for recipe endpoints
export default async function handler(req, res) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
        Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
        return res.status(200).json({}).end();
    }

    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));

    // Placeholder - recipe links are generated client-side
    // This endpoint can be extended for future recipe API integrations
    res.json({ 
        message: 'Recipe links are generated client-side',
        status: 'ok' 
    });
}

