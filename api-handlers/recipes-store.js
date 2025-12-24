// API endpoint to store and retrieve recipes from Supabase
// This avoids triggering Vercel deployments when recipes are updated

module.exports = async (req, res) => {
    const { validateSlug, isValidSlug } = require('../lib/slug-validation');
    const { ErrorResponse } = require('../lib/error-response');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return ErrorResponse.configurationError(res, 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    
    try {
        if (req.method === 'GET') {
            // Fetch all recipes using Supabase REST API
            const response = await fetch(`${supabaseUrl}/rest/v1/recipes?select=*&order=created_at.desc`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`Supabase API error: ${response.status} - ${errorText}`);
                // If table doesn't exist, return empty array (will be created on first POST)
                if (response.status === 404 || response.status === 406) {
                    return res.status(200).json([]);
                }
                return ErrorResponse.databaseError(res, 'Failed to fetch recipes from database', error);
            }
            
            const data = await response.json();
            
            // Transform to match expected format
            const recipes = (data || []).map(recipe => ({
                slug: recipe.slug,
                title: recipe.title,
                name: recipe.name || recipe.title,
                url: recipe.url,
                createdAt: recipe.created_at ? new Date(recipe.created_at).toISOString().split('T')[0] : recipe.created_at
            }));
            
            return res.status(200).json(recipes);
            
        } else if (req.method === 'POST') {
            // Store or update recipes
            const { recipes } = req.body;
            
            if (!Array.isArray(recipes)) {
                return ErrorResponse.badRequest(res, 'recipes must be an array');
            }
            
            // Validate all slugs before processing
            for (const recipe of recipes) {
                if (!recipe.slug) {
                    return ErrorResponse.validationError(res, 'All recipes must have a slug field');
                }
                if (!isValidSlug(recipe.slug)) {
                    return ErrorResponse.validationError(res, `Invalid slug format: "${recipe.slug}". Slug must contain only lowercase letters, numbers, underscores, and hyphens (a-z0-9_-)`);
                }
            }
            
            // Upsert all recipes (insert or update) using Supabase REST API
            const recipesToUpsert = recipes.map(recipe => ({
                slug: recipe.slug,
                title: recipe.title || recipe.name,
                name: recipe.name || recipe.title,
                url: recipe.url,
                created_at: recipe.createdAt ? new Date(recipe.createdAt).toISOString() : new Date().toISOString()
            }));
            
            // Use upsert with conflict resolution on slug
            const response = await fetch(`${supabaseUrl}/rest/v1/recipes`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=representation'
                },
                body: JSON.stringify(recipesToUpsert)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`Supabase API error: ${response.status} - ${errorText}`);
                
                // If table doesn't exist, provide helpful error message
                if (response.status === 404 || response.status === 406) {
                    return ErrorResponse.configurationError(res, 'Recipes table does not exist. Please create the recipes table in Supabase. See SUPABASE_SETUP.md for instructions.', error);
                }
                
                return ErrorResponse.databaseError(res, 'Failed to store recipes in database', error);
            }
            
            const data = await response.json();
            
            return res.status(200).json({
                success: true,
                message: `Successfully stored ${recipes.length} recipes`,
                count: data?.length || recipes.length
            });
        }
        
        return ErrorResponse.methodNotAllowed(res);
        
    } catch (error) {
        return ErrorResponse.internalServerError(res, 'An internal server error occurred', error);
    }
};

