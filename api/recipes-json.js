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
        // Try www.ok-snap.com first (production domain)
        let response = await fetch('https://www.ok-snap.com/recipes.json');
        if (!response.ok) {
            // Fallback to ok-snap.com (without www)
            response = await fetch('https://ok-snap.com/recipes.json');
        }
        
        if (!response.ok) {
            // Return empty array if file doesn't exist yet
            console.log('recipes.json not found on deployed site, returning empty array');
            return res.status(200).json([]);
        }
        
        const data = await response.json();
        if (!Array.isArray(data)) {
            console.warn('recipes.json is not an array, returning empty array');
            return res.status(200).json([]);
        }
        
        return res.status(200).json(data);
    } catch (err) {
        console.error('recipes-json error:', err);
        return res.status(200).json([]); // Return empty array instead of error
    }
}

