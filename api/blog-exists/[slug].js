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
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:22',message:'Blog exists check entry',data:{slug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        
        if (!slug) {
            return res.status(400).json({ error: 'Slug parameter is required' });
        }

        // Check if blog file exists by fetching from the deployed public-site
        // This is more reliable than checking file system in serverless
        const publicSiteUrl = 'https://ok-snap.com';
        const blogUrl = `${publicSiteUrl}/blogs/${slug}.html`;
        const imageUrl = `${publicSiteUrl}/images/blogs/${slug}.png`;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:33',message:'Checking deployed blog URL',data:{blogUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        
        try {
            // Try to fetch the blog HTML file
            const blogResponse = await fetch(blogUrl, {
                method: 'HEAD', // Use HEAD to check existence without downloading
                headers: {
                    'User-Agent': 'OK-Snap-Blog-Checker'
                }
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:44',message:'Blog URL fetch response',data:{status:blogResponse.status,ok:blogResponse.ok,url:blogUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            
            if (blogResponse.ok) {
                // Check if image exists
                let imageExists = false;
                try {
                    const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                    imageExists = imageResponse.ok;
                } catch (e) {
                    // Image doesn't exist, that's okay
                }
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:58',message:'Blog exists',data:{slug,blogUrl,imageExists},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                
                return res.status(200).json({
                    exists: true,
                    slug: slug,
                    blogUrl: blogUrl,
                    imageUrl: imageExists ? imageUrl : null
                });
            } else {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:68',message:'Blog does not exist on deployed site',data:{slug,status:blogResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                return res.status(200).json({
                    exists: false,
                    slug: slug
                });
            }
        } catch (fetchError) {
            // If fetch fails, assume blog doesn't exist
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:75',message:'Blog fetch exception',data:{error:fetchError.message,slug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
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

