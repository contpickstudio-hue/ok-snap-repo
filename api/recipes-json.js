// API route to fetch recipes.json from ok-snap.com with CORS headers
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const response = await fetch('https://ok-snap.com/recipes.json');
        if (!response.ok) {
            // Return empty array if file doesn't exist yet
            return res.status(200).json([]);
        }
        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        console.error('recipes-json error:', err);
        return res.status(200).json([]); // Return empty array instead of error
    }
}

