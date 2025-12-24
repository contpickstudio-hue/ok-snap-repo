// API endpoint to check if blog post exists in Supabase
// Returns existence status and blog URL

module.exports = async (req, res) => {
    const config = require('../lib/config');
    const { validateSlug, encodeSlugForUrl } = require('../lib/slug-validation');
    const { ErrorResponse } = require('../lib/error-response');
    const publicSiteUrl = config.getPublicSiteUrl();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return ErrorResponse.methodNotAllowed(res);
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
        
        // Encode slug for use in URLs (both Supabase queries and response URLs)
        const encodedSlug = encodeSlugForUrl(slug);
        
        if (!supabaseUrl || !supabaseKey) {
            // If Supabase not configured, return exists: false (graceful degradation)
            return res.status(200).json({
                exists: false,
                url: `${publicSiteUrl}/blog.html?slug=${encodedSlug}`,
                slug: slug
            });
        }
        
        // Check if blog exists in Supabase (encode slug for REST URL)
        const response = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${encodedSlug}&select=slug`, {
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
            deployed: exists, // Blogs in Supabase are always "deployed" (available immediately)
            url: `${publicSiteUrl}/blog.html?slug=${encodedSlug}`,
            slug: slug
        });
        
    } catch (error) {
        console.error('[blog-exists-slug] Error:', error);
        // Return exists: false on error (graceful degradation)
        const errorSlug = req.query.slug || 'unknown';
        const encodedErrorSlug = errorSlug === 'unknown' ? 'unknown' : encodeSlugForUrl(errorSlug);
        return res.status(200).json({
            exists: false,
            url: `${publicSiteUrl}/blog.html?slug=${encodedErrorSlug}`,
            slug: errorSlug
        });
    }
};

