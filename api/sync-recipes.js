// API endpoint to sync all existing blogs to recipes.json
// This scans the blogs directory and updates recipes.json with all blog entries

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Allow both GET and POST for flexibility (GET for cron jobs, POST for manual triggers)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
    }
    
    try {
        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO;
        const githubBranch = process.env.GITHUB_BRANCH || 'site';
        const githubBasePath = process.env.GITHUB_BASE_PATH !== undefined ? process.env.GITHUB_BASE_PATH : 'public-site';
        const publicSiteUrl = 'https://ok-snap.com';
        
        if (!githubToken || !githubRepo) {
            return res.status(500).json({ 
                error: 'GitHub credentials not configured',
                message: 'GITHUB_TOKEN and GITHUB_REPO must be set in environment variables'
            });
        }
        
        const [owner, repo] = githubRepo.split('/');
        const baseUrl = 'https://api.github.com';
        const blogsPath = `${githubBasePath ? githubBasePath + '/' : ''}blogs`;
        const recipesJsonPath = `${githubBasePath ? githubBasePath + '/' : ''}recipes.json`;
        
        console.log('[sync-recipes] Starting sync process:', {
            blogsPath,
            recipesJsonPath,
            branch: githubBranch
        });
        
        // Step 1: List all blog files in the blogs directory
        let blogFiles = [];
        try {
            const listResponse = await fetch(
                `${baseUrl}/repos/${owner}/${repo}/contents/${blogsPath}?ref=${githubBranch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'ok-snap-recipe-sync'
                    }
                }
            );
            
            if (!listResponse.ok) {
                if (listResponse.status === 404) {
                    // Blogs directory doesn't exist yet
                    return res.status(200).json({
                        success: true,
                        message: 'No blogs directory found. recipes.json will be created when first blog is generated.',
                        recipesCount: 0
                    });
                }
                throw new Error(`Failed to list blogs: ${listResponse.status} ${listResponse.statusText}`);
            }
            
            const files = await listResponse.json();
            // Filter for HTML files only
            blogFiles = Array.isArray(files) 
                ? files.filter(file => file.type === 'file' && file.name.endsWith('.html'))
                : [];
            
            console.log(`[sync-recipes] Found ${blogFiles.length} blog files`);
        } catch (error) {
            console.error('[sync-recipes] Error listing blog files:', error);
            return res.status(500).json({
                error: 'Failed to list blog files',
                message: error.message
            });
        }
        
        if (blogFiles.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No blog files found. recipes.json will be created when first blog is generated.',
                recipesCount: 0
            });
        }
        
        // Step 2: Extract metadata from each blog file
        const recipes = [];
        
        for (const blogFile of blogFiles) {
            try {
                const slug = blogFile.name.replace('.html', '');
                
                // Try to get file content to extract title and date
                const fileResponse = await fetch(
                    `${baseUrl}/repos/${owner}/${repo}/contents/${blogFile.path}?ref=${githubBranch}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${githubToken}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'ok-snap-recipe-sync'
                        }
                    }
                );
                
                if (fileResponse.ok) {
                    const fileData = await fileResponse.json();
                    const content = Buffer.from(fileData.content, 'base64').toString('utf8');
                    
                    // Extract title from HTML (look for <title> or <h1>)
                    let title = slug; // Default to slug
                    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                                     content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
                    if (titleMatch) {
                        title = titleMatch[1].trim();
                    }
                    
                    // Use commit date as createdAt, or current date
                    const createdAt = fileData.commit?.date 
                        ? new Date(fileData.commit.date).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0];
                    
                    recipes.push({
                        slug: slug,
                        title: title,
                        name: title, // For backward compatibility
                        url: `${publicSiteUrl}/blogs/${slug}.html`,
                        createdAt: createdAt
                    });
                } else {
                    // If we can't read the file, still add it with basic info
                    recipes.push({
                        slug: slug,
                        title: slug,
                        name: slug,
                        url: `${publicSiteUrl}/blogs/${slug}.html`,
                        createdAt: new Date().toISOString().split('T')[0]
                    });
                }
            } catch (error) {
                console.warn(`[sync-recipes] Error processing blog file ${blogFile.name}:`, error.message);
                // Continue with other files
            }
        }
        
        // Sort by date (newest first)
        recipes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`[sync-recipes] Extracted ${recipes.length} recipes from blog files`);
        
        // Step 3: Get existing recipes.json SHA (if it exists)
        let recipesSha = null;
        try {
            const getRecipesResponse = await fetch(
                `${baseUrl}/repos/${owner}/${repo}/contents/${recipesJsonPath}?ref=${githubBranch}`,
                {
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'ok-snap-recipe-sync'
                    }
                }
            );
            
            if (getRecipesResponse.ok) {
                const fileData = await getRecipesResponse.json();
                recipesSha = fileData.sha;
            }
        } catch (error) {
            // File doesn't exist yet, that's okay
            console.log('[sync-recipes] recipes.json does not exist yet, will create new file');
        }
        
        // Step 4: Update recipes.json
        const recipesContent = JSON.stringify(recipes, null, 2);
        const recipesContentBase64 = Buffer.from(recipesContent, 'utf8').toString('base64');
        
        const updateBody = {
            message: `Sync recipes.json: Update with ${recipes.length} recipes from existing blogs`,
            content: recipesContentBase64,
            branch: githubBranch
        };
        
        if (recipesSha) {
            updateBody.sha = recipesSha;
        }
        
        const updateResponse = await fetch(
            `${baseUrl}/repos/${owner}/${repo}/contents/${recipesJsonPath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'ok-snap-recipe-sync'
                },
                body: JSON.stringify(updateBody)
            }
        );
        
        if (!updateResponse.ok) {
            const errorData = await updateResponse.json().catch(() => ({}));
            throw new Error(`Failed to update recipes.json: ${updateResponse.status} - ${JSON.stringify(errorData)}`);
        }
        
        const responseData = await updateResponse.json();
        const commitSha = responseData.commit?.sha;
        
        console.log('[sync-recipes] Successfully synced recipes.json:', {
            recipesCount: recipes.length,
            commitSha: commitSha
        });
        
        // Automatically promote deployment to production (non-blocking)
        if (commitSha) {
            const { promoteDeploymentToProduction } = require('./promote-deployment');
            promoteDeploymentToProduction(commitSha, githubBranch).catch(err => {
                console.warn('[sync-recipes] Failed to promote deployment (non-critical):', err.message);
            });
        }
        
        return res.status(200).json({
            success: true,
            message: `Successfully synced ${recipes.length} recipes to recipes.json`,
            recipesCount: recipes.length,
            commitSha: commitSha,
            recipes: recipes.map(r => ({ slug: r.slug, title: r.title }))
        });
        
    } catch (error) {
        console.error('[sync-recipes] Error:', error);
        return res.status(500).json({
            error: 'Failed to sync recipes',
            message: error.message
        });
    }
};

