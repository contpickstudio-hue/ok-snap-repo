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

        // Check if blog file exists by checking GitHub repository (more reliable than deployed site)
        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO;
        const githubBranch = process.env.GITHUB_BRANCH || 'site';
        const githubBasePath = process.env.GITHUB_BASE_PATH !== undefined ? process.env.GITHUB_BASE_PATH : 'public-site';
        const publicSiteUrl = 'https://ok-snap.com';
        const blogUrl = `${publicSiteUrl}/blogs/${slug}.html`;
        const imageUrl = `${publicSiteUrl}/images/blogs/${slug}.png`;
        
        // First try GitHub API if credentials are available (more reliable)
        if (githubToken && githubRepo) {
            try {
                const [owner, repo] = githubRepo.split('/');
                const blogFilePath = `${githubBasePath ? githubBasePath + '/' : ''}blogs/${slug}.html`;
                const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${blogFilePath}?ref=${githubBranch}`;
                
                const githubResponse = await fetch(githubUrl, {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (githubResponse.ok) {
                    // Blog exists in GitHub - MUST also check if deployed site is accessible
                    let deployed = false;
                    let deployedStatus = null;
                    let imageExists = false;
                    try {
                        // Use GET instead of HEAD to ensure the actual page is accessible
                        // Some servers return 200 for HEAD but 404 for GET
                        const deployedResponse = await fetch(blogUrl, { 
                            method: 'GET',
                            headers: {
                                'User-Agent': 'OK-Snap-Blog-Checker',
                                'Accept': 'text/html'
                            }
                        });
                        deployed = deployedResponse.ok && deployedResponse.status === 200;
                        deployedStatus = deployedResponse.status;
                        
                        if (deployed) {
                            try {
                                const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
                                imageExists = imageResponse.ok;
                            } catch (e) {
                                // Image doesn't exist, that's okay
                            }
                        }
                    } catch (e) {
                        // Deployed site check failed - blog exists in GitHub but not deployed yet
                    }
                    
                    // Only return exists: true if actually deployed (accessible on live site)
                    if (deployed) {
                        return res.status(200).json({
                            exists: true,
                            deployed: true, // Explicitly set deployed flag for client-side checks
                            slug: slug,
                            blogUrl: blogUrl,
                            imageUrl: imageExists ? imageUrl : null
                        });
                    } else {
                        // Blog exists in GitHub but not deployed yet
                        return res.status(200).json({
                            exists: false,
                            slug: slug,
                            pending: true, // Indicates blog is created but not deployed yet
                            message: 'Blog is being prepared. Please check back in a few minutes.',
                            inGitHub: true, // Confirms blog exists in repository
                            deployed: false
                        });
                    }
                }
            } catch (githubError) {
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
                return res.status(200).json({
                    exists: false,
                    slug: slug
                });
            }
        } catch (fetchError) {
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

