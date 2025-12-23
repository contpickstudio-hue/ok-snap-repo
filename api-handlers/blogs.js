// API endpoint to fetch blogs from Supabase
// Returns list of all blogs for the blog listing page

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
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ 
                error: 'Supabase not configured',
                message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set'
            });
        }
        
        // Fetch blogs from Supabase
        const response = await fetch(`${supabaseUrl}/rest/v1/blogs?select=slug,title,name,name_korean,image_url,created_at&order=created_at.desc`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[blogs] Error fetching blogs:', response.status, errorText);
            
            // If table doesn't exist, return empty array
            if (response.status === 404 || response.status === 406) {
                return res.status(200).json([]);
            }
            
            return res.status(500).json({ 
                error: 'Failed to fetch blogs',
                message: errorText 
            });
        }
        
        const blogs = await response.json();
        
        // Transform to match expected format
        const formattedBlogs = (blogs || []).map(blog => ({
            slug: blog.slug,
            title: blog.title || blog.name,
            name: blog.name || blog.title,
            nameKorean: blog.name_korean,
            imageUrl: blog.image_url,
            createdAt: blog.created_at ? new Date(blog.created_at).toISOString().split('T')[0] : null
        }));
        
        console.log(`[blogs] Fetched ${formattedBlogs.length} blogs from Supabase`);
        
        return res.status(200).json(formattedBlogs);
        
    } catch (error) {
        console.error('[blogs] Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch blogs',
            message: error.message
        });
    }
};

