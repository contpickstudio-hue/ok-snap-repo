// API endpoint to sync all existing blogs to recipes.json
// This scans the blogs directory and updates recipes.json with all blog entries

module.exports = async (req, res) => {
    const { debugLog } = require('../lib/logger');
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const { ErrorResponse } = require('../lib/error-response');
    
    // Allow both GET and POST for flexibility (GET for cron jobs, POST for manual triggers)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return ErrorResponse.methodNotAllowed(res, 'Method not allowed. Use GET or POST.');
    }
    
    try {
        const config = require('../lib/config');
        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPO;
        const githubBranch = process.env.GITHUB_BRANCH || 'site';
        const githubBasePath = process.env.GITHUB_BASE_PATH !== undefined ? process.env.GITHUB_BASE_PATH : 'public-site';
        const publicSiteUrl = config.getPublicSiteUrl();
        
        if (!githubToken || !githubRepo) {
            return ErrorResponse.configurationError(res, 'GITHUB_TOKEN and GITHUB_REPO must be set in environment variables');
        }
        
        const [owner, repo] = githubRepo.split('/');
        const baseUrl = 'https://api.github.com';
        const blogsPath = `${githubBasePath ? githubBasePath + '/' : ''}blogs`;
        const recipesJsonPath = `${githubBasePath ? githubBasePath + '/' : ''}recipes.json`;
        
        debugLog('[sync-recipes] Starting sync process:', {
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
            
            debugLog(`[sync-recipes] Found ${blogFiles.length} blog files`);
        } catch (error) {
            return ErrorResponse.externalServiceError(res, 'Failed to list blog files from GitHub', error);
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
        
        debugLog(`[sync-recipes] Extracted ${recipes.length} recipes from blog files`);
        
        // Step 3: Store recipes in Supabase (no GitHub commit = no Vercel deployment!)
        let supabaseSuccess = false;
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
            
            if (supabaseUrl && supabaseKey) {
                const recipesToStore = recipes.map(recipe => ({
                    slug: recipe.slug,
                    title: recipe.title || recipe.name,
                    name: recipe.name || recipe.title,
                    url: recipe.url,
                    created_at: new Date(recipe.createdAt).toISOString()
                }));
                
                // Store directly in Supabase using REST API
                const storeResponse = await fetch(`${supabaseUrl}/rest/v1/recipes`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=representation'
                    },
                    body: JSON.stringify(recipesToStore)
                });
                
                if (storeResponse && storeResponse.ok) {
                    supabaseSuccess = true;
                    debugLog('[sync-recipes] Recipes stored in Supabase successfully - no deployment needed!');
                } else if (storeResponse && (storeResponse.status === 404 || storeResponse.status === 406)) {
                    console.warn('[sync-recipes] Supabase recipes table does not exist. See SUPABASE_SETUP.md for setup instructions.');
                } else if (storeResponse) {
                    const errorText = await storeResponse.text().catch(() => 'Unknown error');
                    console.error('[sync-recipes] Failed to store recipes in Supabase:', storeResponse.status, errorText);
                }
            } else {
                console.warn('[sync-recipes] Supabase credentials not configured. Recipes not stored in database.');
            }
        } catch (supabaseError) {
            console.error('[sync-recipes] Supabase storage failed:', supabaseError.message);
        }
        
        if (!supabaseSuccess) {
            return ErrorResponse.databaseError(res, 'Supabase storage failed. Check your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.', null);
        }
        
        return res.status(200).json({
            success: true,
            message: `Successfully synced ${recipes.length} recipes to Supabase (no deployment needed!)`,
            recipesCount: recipes.length,
            recipes: recipes.map(r => ({ slug: r.slug, title: r.title }))
        });
        
    } catch (error) {
        return ErrorResponse.internalServerError(res, 'Failed to sync recipes', error);
    }
};

