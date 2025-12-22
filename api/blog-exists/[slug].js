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

        // Check if blog file exists by checking GitHub repository (more reliable than deployed site)
        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO;
        const githubBranch = process.env.GITHUB_BRANCH || 'site';
        const githubBasePath = process.env.GITHUB_BASE_PATH !== undefined ? process.env.GITHUB_BASE_PATH : 'public-site';
        const publicSiteUrl = 'https://ok-snap.com';
        const blogUrl = `${publicSiteUrl}/blogs/${slug}.html`;
        const imageUrl = `${publicSiteUrl}/images/blogs/${slug}.png`;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:33',message:'Checking blog existence',data:{slug,githubRepo,githubBranch,githubBasePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        
        // First try GitHub API if credentials are available (more reliable)
        if (githubToken && githubRepo) {
            try {
                const [owner, repo] = githubRepo.split('/');
                const blogFilePath = `${githubBasePath ? githubBasePath + '/' : ''}blogs/${slug}.html`;
                const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${blogFilePath}?ref=${githubBranch}`;
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:42',message:'Checking GitHub for blog file',data:{blogFilePath,githubUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                
                const githubResponse = await fetch(githubUrl, {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:52',message:'GitHub API response',data:{status:githubResponse.status,ok:githubResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                
                if (githubResponse.ok) {
                    // Blog exists in GitHub - check if deployed site is accessible
                    let imageExists = false;
                    try {
                        const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                        imageExists = imageResponse.ok;
                    } catch (e) {
                        // Image doesn't exist, that's okay
                    }
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:65',message:'Blog exists in GitHub',data:{slug,blogUrl,imageExists},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                    // #endregion
                    
                    return res.status(200).json({
                        exists: true,
                        slug: slug,
                        blogUrl: blogUrl,
                        imageUrl: imageExists ? imageUrl : null
                    });
                }
            } catch (githubError) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:77',message:'GitHub check failed, trying deployed site',data:{error:githubError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                // Fall through to deployed site check
            }
        }
        
        // Fallback: Check deployed site
        try {
            // Try to fetch the blog HTML file
            const blogResponse = await fetch(blogUrl, {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'OK-Snap-Blog-Checker'
                }
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:90',message:'Deployed site check response',data:{status:blogResponse.status,ok:blogResponse.ok,url:blogUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
            // #endregion
            
            if (blogResponse.ok) {
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
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:110',message:'Blog does not exist on deployed site',data:{slug,status:blogResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                return res.status(200).json({
                    exists: false,
                    slug: slug
                });
            }
        } catch (fetchError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'blog-exists/[slug].js:119',message:'Blog check exception',data:{error:fetchError.message,slug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
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

