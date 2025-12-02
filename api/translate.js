// Vercel serverless function for translation endpoints
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Placeholder - translation is handled by OpenAI in identify endpoint
    // This endpoint can be extended for future translation API integrations
    res.json({ 
        message: 'Translation is handled by OpenAI in identify endpoint',
        status: 'ok' 
    });
}

