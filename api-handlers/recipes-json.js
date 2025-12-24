// API route to fetch recipes.json from ok-snap.com with CORS headers
module.exports = async (req, res) => {
    const config = require('../lib/config');
    const { debugLog } = require('../lib/logger');
    const publicSiteUrl = config.getPublicSiteUrl();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { ErrorResponse } = require('../lib/error-response');
    
    if (req.method !== 'GET') {
        return ErrorResponse.methodNotAllowed(res);
    }
    
    try {
        // First, try to fetch from Supabase (no deployment needed!)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
            try {
                // Try fetching from blogs table first (primary source)
                const blogsResponse = await fetch(`${supabaseUrl}/rest/v1/blogs?select=slug,title,name,name_korean,image_url,created_at&order=created_at.desc`, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (blogsResponse.ok) {
                    const blogsData = await blogsResponse.json();
                    if (Array.isArray(blogsData) && blogsData.length > 0) {
                        // Transform to match expected format
                        const recipes = blogsData.map(blog => ({
                            slug: blog.slug,
                            title: blog.title || blog.name,
                            name: blog.name || blog.title,
                            url: `${publicSiteUrl}/blog.html?slug=${blog.slug}`,
                            createdAt: blog.created_at ? new Date(blog.created_at).toISOString().split('T')[0] : blog.created_at
                        }));
                        debugLog('Loaded recipes from Supabase blogs table:', recipes.length);
                        return res.status(200).json(recipes);
                    }
                }
                
                // Fallback to recipes table if blogs table is empty
                const recipesResponse = await fetch(`${supabaseUrl}/rest/v1/recipes?select=*&order=created_at.desc`, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (recipesResponse.ok) {
                    const recipesData = await recipesResponse.json();
                    if (Array.isArray(recipesData) && recipesData.length > 0) {
                        // Transform to match expected format
                        const recipes = recipesData.map(recipe => ({
                            slug: recipe.slug,
                            title: recipe.title,
                            name: recipe.name || recipe.title,
                            url: recipe.url,
                            createdAt: recipe.created_at ? new Date(recipe.created_at).toISOString().split('T')[0] : recipe.created_at
                        }));
                        debugLog('Loaded recipes from Supabase recipes table:', recipes.length);
                        return res.status(200).json(recipes);
                    }
                }
            } catch (supabaseError) {
                debugLog('Supabase fetch failed, falling back to recipes.json:', supabaseError.message);
            }
        }
        
        // Fallback: Try www subdomain first, then base domain
        const wwwUrl = publicSiteUrl.replace('://', '://www.');
        let response = await fetch(`${wwwUrl}/recipes.json`);
        if (!response.ok) {
            // Fallback to base domain
            response = await fetch(`${publicSiteUrl}/recipes.json`);
        }
        
        if (!response.ok) {
            // Return empty array if file doesn't exist yet
            debugLog('recipes.json not found on deployed site, returning empty array');
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

