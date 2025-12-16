// API route wrapper for recipes.json to add CORS headers
// Static files don't automatically get CORS headers, so we serve via API route
const { setCorsHeaders, handlePreflight } = require('./_cors');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    // Set CORS headers on every response - MUST be first
    setCorsHeaders(req, res);
    
    // Handle OPTIONS preflight requests - return immediately, do NOT run business logic
    if (handlePreflight(req, res)) {
        return; // Preflight handled, exit early
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
        
        // Return with CORS headers already set
        res.setHeader('Content-Type', 'application/json');
        res.json(recipes);
    } catch (error) {
        console.error('Error reading recipes.json:', error);
        res.status(500).json({ error: 'Failed to load recipes', recipes: [] });
    }
};

