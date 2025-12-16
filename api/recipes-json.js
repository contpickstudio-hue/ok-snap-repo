// API route wrapper for recipes.json to add CORS headers
// Static files don't automatically get CORS headers, so we serve via API route
const fs = require('fs');
const path = require('path');

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
        // Path to recipes.json in public-site directory
        const recipesJsonPath = path.join(__dirname, '..', 'public-site', 'recipes.json');
        
        if (!fs.existsSync(recipesJsonPath)) {
            return res.status(404).json({ error: 'Recipes file not found', recipes: [] });
        }
        
        const recipesJson = fs.readFileSync(recipesJsonPath, 'utf8');
        const recipes = JSON.parse(recipesJson);
        
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(recipes);
    } catch (err) {
        console.error('recipes-json error:', err);
        return res.status(500).json({ error: 'Failed to load recipes' });
    }
};

