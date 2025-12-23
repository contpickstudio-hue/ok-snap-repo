// API endpoint to check if blog post exists in Supabase
// Returns existence status and blog URL

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
        // Extract slug from query parameter (set by router)
        const slug = req.query.slug;
        
        if (!slug) {
            return res.status(400).json({ error: 'Slug parameter is required' });
        }
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            // If Supabase not configured, return exists: false (graceful degradation)
            return res.status(200).json({
                exists: false,
                url: `https://ok-snap.com/blog.html?slug=${slug}`,
                slug: slug
            });
        }
        
        // Check if blog exists in Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${slug}&select=slug`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        let exists = false;
        if (response.ok) {
            const blogs = await response.json();
            exists = Array.isArray(blogs) && blogs.length > 0;
        }
        
        return res.status(200).json({
            exists: exists,
            url: `https://ok-snap.com/blog.html?slug=${slug}`,
            slug: slug
        });
        
    } catch (error) {
        console.error('[blog-exists-slug] Error:', error);
        // Return exists: false on error (graceful degradation)
        return res.status(200).json({
            exists: false,
            url: `https://ok-snap.com/blog.html?slug=${req.query.slug || 'unknown'}`,
            slug: req.query.slug || 'unknown'
        });
    }
};

