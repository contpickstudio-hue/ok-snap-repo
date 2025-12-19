// Vercel serverless function to check if blog post exists
// Dynamic route: /api/blog-exists/:slug
// Checks if blog exists by fetching from deployed public-site

module.exports = async (req, res) => {
    // === GLOBAL CORS HEADERS ===
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // === PRE-FLIGHT REQUEST ===
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Extract slug from query parameter (Vercel dynamic routes use req.query)
        const slug = req.query.slug;
        
        if (!slug) {
            return res.status(400).json({ error: 'Slug parameter is required' });
        }

        // Check if blog file exists by fetching from the deployed public-site
        // This is more reliable than checking file system in serverless
        const publicSiteUrl = 'https://ok-snap-identifier.vercel.app';
        const blogUrl = `${publicSiteUrl}/public-site/blogs/${slug}.html`;
        const imageUrl = `${publicSiteUrl}/public-site/images/blogs/${slug}.png`;
        
        try {
            // Try to fetch the blog HTML file
            const blogResponse = await fetch(blogUrl, {
                method: 'HEAD', // Use HEAD to check existence without downloading
                headers: {
                    'User-Agent': 'OK-Snap-Blog-Checker'
                }
            });
            
            if (blogResponse.ok) {
                // Check if image exists
                let imageExists = false;
                try {
                    const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                    imageExists = imageResponse.ok;
                } catch (e) {
                    // Image doesn't exist, that's okay
                }
                
                return res.status(200).json({
                    exists: true,
                    slug: slug,
                    blogUrl: blogUrl,
                    imageUrl: imageExists ? imageUrl : null
                });
            } else {
                return res.status(200).json({
                    exists: false,
                    slug: slug
                });
            }
        } catch (fetchError) {
            // If fetch fails, assume blog doesn't exist
            return res.status(200).json({
                exists: false,
                slug: slug
            });
        }
    } catch (err) {
        console.error('Blog exists check error:', err);
        return res.status(500).json({ error: 'Failed to check blog existence' });
    }
}

