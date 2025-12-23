// API endpoint to store and retrieve recipes from Supabase
// This avoids triggering Vercel deployments when recipes are updated

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ 
            error: 'Supabase not configured',
            message: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set'
        });
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
                console.error('[recipes-store] Error fetching recipes:', response.status, errorText);
                // If table doesn't exist, return empty array (will be created on first POST)
                if (response.status === 404 || response.status === 406) {
                    return res.status(200).json([]);
                }
                return res.status(500).json({ error: 'Failed to fetch recipes', message: errorText });
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
                return res.status(400).json({ error: 'recipes must be an array' });
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
                console.error('[recipes-store] Error storing recipes:', response.status, errorText);
                
                // If table doesn't exist, provide helpful error message
                if (response.status === 404 || response.status === 406) {
                    return res.status(500).json({ 
                        error: 'Recipes table does not exist',
                        message: 'Please create the recipes table in Supabase. See SUPABASE_SETUP.md for instructions.'
                    });
                }
                
                return res.status(500).json({ error: 'Failed to store recipes', message: errorText });
            }
            
            const data = await response.json();
            
            return res.status(200).json({
                success: true,
                message: `Successfully stored ${recipes.length} recipes`,
                count: data?.length || recipes.length
            });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('[recipes-store] Exception:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};

