// API endpoint to fetch a single blog post by slug from Supabase
// Returns full blog content for rendering

module.exports = async (req, res) => {
    const { validateSlug, encodeSlugForUrl } = require('../lib/slug-validation');
    const { ErrorResponse } = require('../lib/error-response');
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
        // Extract slug from query parameter (set by router)
        const slug = req.query.slug;
        
        if (!slug) {
            return ErrorResponse.badRequest(res, 'Slug parameter is required');
        }
        
        // Validate slug format
        try {
            validateSlug(slug, 'slug');
        } catch (validationError) {
            return ErrorResponse.validationError(res, validationError.message, validationError);
        }
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return ErrorResponse.configurationError(res, 'SUPABASE_URL and SUPABASE_ANON_KEY must be set');
        }
        
        // Fetch blog from Supabase (encode slug for URL)
        const encodedSlug = encodeSlugForUrl(slug);
        const response = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${encodedSlug}&select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            const error = new Error(`Supabase API error: ${response.status} - ${errorText}`);
            
            if (response.status === 404 || response.status === 406) {
                return ErrorResponse.notFound(res, `Blog with slug "${slug}" does not exist`, error);
            }
            
            return ErrorResponse.databaseError(res, 'Failed to fetch blog from database', error);
        }
        
        const blogs = await response.json();
        
        if (!Array.isArray(blogs) || blogs.length === 0) {
            return ErrorResponse.notFound(res, `Blog with slug "${slug}" does not exist`);
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
        return ErrorResponse.internalServerError(res, 'Failed to fetch blog', error);
    }
};

