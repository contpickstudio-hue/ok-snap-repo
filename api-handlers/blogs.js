// API endpoint to fetch blogs from Supabase
// Returns list of all blogs for the blog listing page

module.exports = async (req, res) => {
    const { ErrorResponse } = require('../lib/error-response');
    const { debugLog } = require('../lib/logger');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return ErrorResponse.methodNotAllowed(res, 'Method not allowed. Use GET.');
    }
    
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return ErrorResponse.configurationError(res, 'SUPABASE_URL and SUPABASE_ANON_KEY must be set');
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
            const error = new Error(`Supabase API error: ${response.status} - ${errorText}`);
            
            // If table doesn't exist, return empty array
            if (response.status === 404 || response.status === 406) {
                return res.status(200).json([]);
            }
            
            return ErrorResponse.databaseError(res, 'Failed to fetch blogs from database', error);
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
        
        debugLog(`[blogs] Fetched ${formattedBlogs.length} blogs from Supabase`);
        
        return res.status(200).json(formattedBlogs);
        
    } catch (error) {
        return ErrorResponse.internalServerError(res, 'Failed to fetch blogs', error);
    }
};

