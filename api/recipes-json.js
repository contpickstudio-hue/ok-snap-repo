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
        // First, try to fetch from Supabase (no deployment needed!)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
            try {
                const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/recipes?select=*&order=created_at.desc`, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (supabaseResponse.ok) {
                    const supabaseData = await supabaseResponse.json();
                    if (Array.isArray(supabaseData) && supabaseData.length > 0) {
                        // Transform to match expected format
                        const recipes = supabaseData.map(recipe => ({
                            slug: recipe.slug,
                            title: recipe.title,
                            name: recipe.name || recipe.title,
                            url: recipe.url,
                            createdAt: recipe.created_at ? new Date(recipe.created_at).toISOString().split('T')[0] : recipe.created_at
                        }));
                        console.log('Loaded recipes from Supabase:', recipes.length);
                        return res.status(200).json(recipes);
                    }
                }
            } catch (supabaseError) {
                console.log('Supabase fetch failed, falling back to recipes.json:', supabaseError.message);
            }
        }
        
        // Fallback: Try www.ok-snap.com (production domain)
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

