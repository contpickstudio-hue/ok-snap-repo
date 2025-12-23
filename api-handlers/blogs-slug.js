// API endpoint to fetch a single blog post by slug from Supabase
// Returns full blog content for rendering

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. Use GET.' });
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
            return res.status(500).json({ 
                error: 'Supabase not configured',
                message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set'
            });
        }
        
        // Fetch blog from Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${slug}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[blogs-slug] Error fetching blog:', response.status, errorText);
            
            if (response.status === 404 || response.status === 406) {
                return res.status(404).json({ 
                    error: 'Blog not found',
                    message: `Blog with slug "${slug}" does not exist`
                });
            }
            
            return res.status(500).json({ 
                error: 'Failed to fetch blog',
                message: errorText 
            });
        }
        
        const blogs = await response.json();
        
        if (!Array.isArray(blogs) || blogs.length === 0) {
            return res.status(404).json({ 
                error: 'Blog not found',
                message: `Blog with slug "${slug}" does not exist`
            });
        }
        
        const blog = blogs[0];
        
        // Return full blog data
        return res.status(200).json({
            slug: blog.slug,
            title: blog.title || blog.name,
            name: blog.name || blog.title,
            nameKorean: blog.name_korean,
            content: blog.content,
            imageUrl: blog.image_url,
            description: blog.description,
            cuisine: blog.cuisine,
            language: blog.language,
            createdAt: blog.created_at,
            updatedAt: blog.updated_at
        });
        
    } catch (error) {
        console.error('[blogs-slug] Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch blog',
            message: error.message
        });
    }
};

