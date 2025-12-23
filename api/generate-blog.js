// Blog generation API endpoint
// This endpoint generates a blog post using ChatGPT API with the specified system prompt
// Note: No filesystem operations - all files are created via GitHub API

async function generateBlogPost(dishData) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    const systemPrompt = `🎯 Identity & Role
You are a Korean-lifestyle vlog writer + recipe/trend editor with 20 years of experience.
Your job is to write warm, atmospheric recipe blog posts.

✨ Tone:
- daily-vlog style, warm, cozy, emotional
- include sensory details about kitchen atmosphere
- absolutely no AI tone, no textbook tone
- write like a real human with lived experience

🔍 SEO Rules:
- Title must include main keyword
- Keyword appears naturally in intro + conclusion + subheadings
- Include keyword in ALT text
- No keyword stuffing

📚 Structure Required:
1. Title (main keyword included)
2. Intro (vlog tone)
3. Body:
   - Experience storytelling
   - Health tips
   - Realistic recipe steps
   - Cultural/trend notes
4. Summary box
5. 2–3 FAQs
6. 10–15 SEO hashtags

🔥 Absolute Rules:
- Must sound like a real Korean-lifestyle YouTuber
- Never sound like AI
- Always SEO optimized naturally
- No scientific tone
- No generic statements

Write a complete blog post about ${dishData.name}${dishData.nameKorean ? ` (${dishData.nameKorean})` : ''}. 
Include nutrition information: ${dishData.nutrition?.calories || 0} calories, ${dishData.nutrition?.protein || 0}g protein, ${dishData.nutrition?.carbs || 0}g carbs, ${dishData.nutrition?.fat || 0}g fat.
${dishData.description ? `Dish description: ${dishData.description}` : ''}

Return the blog post as HTML with proper structure. Use semantic HTML tags. Include all sections mentioned above.`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `Write a complete, warm, vlog-style blog post about ${dishData.name}. Make it feel like a real Korean lifestyle blogger wrote it.`
                    }
                ],
                max_tokens: 2000,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(errorData.error?.message || 'OpenAI API error');
        }

        const data = await response.json();
        const blogContent = data.choices[0].message.content;

        // Clean up the content - remove markdown code blocks if present
        let cleanedContent = blogContent.trim();
        if (cleanedContent.startsWith('```html')) {
            cleanedContent = cleanedContent.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/```\n?/g, '').trim();
        }

        return cleanedContent;
    } catch (error) {
        console.error('Error generating blog post:', error);
        throw error;
    }
}

function createSlug(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/**
 * Generate an image for the blog post using DALL-E API
 * @param {Object} dishData - Dish information
 * @returns {Promise<string>} - Path to the saved image file
 */
async function generateBlogImage(dishData) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    const slug = createSlug(dishData.name);
    const imagePrompt = `Professional food photography of ${dishData.name}${dishData.nameKorean ? ` (${dishData.nameKorean})` : ''}, ${dishData.isKorean ? 'Korean cuisine' : dishData.cuisine || 'delicious dish'}, beautifully plated on a modern table, natural lighting, appetizing, high quality, food blog style`;

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: imagePrompt,
                size: '1024x1024',
                quality: 'standard',
                n: 1
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(errorData.error?.message || 'DALL-E API error');
        }

        const data = await response.json();
        const imageUrl = data.data[0].url;
        
        // Return image URL - will be uploaded to GitHub, not saved locally
        console.log(`Generated image URL for ${dishData.name}`);
        return imageUrl; // Return URL instead of file path
    } catch (error) {
        console.warn('Image generation failed, continuing without image:', error);
        return null;
    }
}

// Removed saveBlogPost, updateRecipesJson, and checkBlogExists functions
// These used filesystem operations which are not allowed in Vercel serverless functions
// All operations now go through GitHub API

/**
 * Create blog files using GitHub API
 * This allows us to create files in the repository, which triggers Vercel deployment
 */
async function createBlogFilesViaGitHub(dishData, blogContent, imagePath, slug) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:161',message:'createBlogFilesViaGitHub entry',data:{dishName:dishData?.name,slug,hasImage:!!imagePath,blogContentLength:blogContent?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO; // Format: "owner/repo" e.g., "username/ok-snap"
    // Default to 'site' branch where the blog website is deployed
    const githubBranch = process.env.GITHUB_BRANCH || 'site';
    // Default to 'public-site' folder structure
    // If your site branch root contains blog files directly, set GITHUB_BASE_PATH to empty string
    const githubBasePath = process.env.GITHUB_BASE_PATH !== undefined ? process.env.GITHUB_BASE_PATH : 'public-site';
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:169',message:'GitHub config check',data:{hasToken:!!githubToken,tokenLength:githubToken?.length,repo:githubRepo,branch:githubBranch,basePath:githubBasePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    if (!githubToken || !githubRepo) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:172',message:'Missing GitHub credentials',data:{hasToken:!!githubToken,hasRepo:!!githubRepo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return {
            success: false,
            error: 'GitHub credentials not configured. Set GITHUB_TOKEN and GITHUB_REPO environment variables.'
        };
    }
    
    try {
        const [owner, repo] = githubRepo.split('/');
        if (!owner || !repo) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:178',message:'Invalid repo format',data:{repo:githubRepo,owner,repo},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            throw new Error('Invalid GITHUB_REPO format. Use "owner/repo"');
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:183',message:'Parsed GitHub config',data:{owner,repo,branch:githubBranch,basePath:githubBasePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        const baseUrl = 'https://api.github.com';
        const publicSiteUrl = 'https://ok-snap.com';
        
        // Create full HTML for blog post
        let featuredImageHtml = '';
        let imageUrlForMeta = null;
        if (imagePath) {
            // Convert file path to website URL (remove /public-site prefix if present)
            imageUrlForMeta = imagePath.startsWith('/public-site/') 
                ? `${publicSiteUrl}${imagePath.replace('/public-site', '')}` 
                : imagePath.startsWith('/') 
                    ? `${publicSiteUrl}${imagePath}` 
                    : `${publicSiteUrl}/${imagePath}`;
            featuredImageHtml = `
            <div class="blog-featured-image">
                <img src="${imageUrlForMeta}" alt="${dishData.name}${dishData.nameKorean ? ` (${dishData.nameKorean})` : ''}" style="width: 100%; max-width: 800px; height: auto; border-radius: 12px; margin: 2rem auto; display: block; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);">
            </div>
        `;
        }
        
        const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Learn how to make ${dishData.name}${dishData.nameKorean ? ` (${dishData.nameKorean})` : ''} - Authentic Korean recipe with step-by-step instructions.">
    <meta name="keywords" content="${dishData.name}, Korean food, Korean recipe, ${dishData.nameKorean || ''}, Hansik">
    ${imageUrlForMeta ? `<meta property="og:image" content="${imageUrlForMeta}">` : ''}
    <title>${dishData.name} Recipe - OK-Snap</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <header class="header">
        <div class="container">
            <div class="header-content">
                <h1 class="logo"><a href="../index.html" style="text-decoration: none; color: inherit;">OK-Snap</a></h1>
                <nav class="nav">
                    <a href="../index.html" class="nav-link">Home</a>
                    <a href="../blog.html" class="nav-link">Blog</a>
                    <a href="../about.html" class="nav-link">About</a>
                    <a href="../contact.html" class="nav-link">Contact</a>
                </nav>
            </div>
        </div>
    </header>

    <main class="main">
        <article class="blog-post">
            <div class="blog-post-header">
                <h1 class="blog-post-title">${dishData.name}${dishData.nameKorean ? ` (${dishData.nameKorean})` : ''}</h1>
                <div class="blog-post-meta">
                    Published: ${new Date().toLocaleDateString()}
                </div>
            </div>
            ${featuredImageHtml}
            <div class="blog-post-content">
                ${blogContent}
            </div>
        </article>
    </main>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2025 OK-Snap. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>`;
        
        // Step 1: Check if blog already exists BEFORE creating
        const blogFilePath = `${githubBasePath ? githubBasePath + '/' : ''}blogs/${slug}.html`;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:254',message:'Checking blog existence',data:{blogFilePath,fullUrl:`${baseUrl}/repos/${owner}/${repo}/contents/${blogFilePath}?ref=${githubBranch}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        const checkBlogResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${blogFilePath}?ref=${githubBranch}`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:262',message:'Blog check response',data:{status:checkBlogResponse.status,statusText:checkBlogResponse.statusText,ok:checkBlogResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        if (checkBlogResponse.ok) {
            // Blog already exists - skip generation
            console.log(`Blog already exists for ${dishData.name}, skipping generation`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:268',message:'Blog already exists, skipping',data:{slug},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            return {
                success: true,
                blogUrl: `${publicSiteUrl}/blogs/${slug}.html`,
                slug: slug,
                skipped: true,
                message: 'Blog already exists'
            };
        }
        
        // #region agent log
        if (!checkBlogResponse.ok) {
            const errorText = await checkBlogResponse.text().catch(() => '');
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:275',message:'Blog check failed',data:{status:checkBlogResponse.status,errorText:errorText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        }
        // #endregion
        
        // Step 2: Create blog HTML file (blog doesn't exist)
        const blogContentBase64 = Buffer.from(fullHtml, 'utf8').toString('base64');
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:277',message:'Creating blog file',data:{blogFilePath,contentLength:blogContentBase64.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        const createBlogResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${blogFilePath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'ok-snap-blog-generator'
            },
            body: JSON.stringify({
                message: `Add blog post: ${dishData.name}`,
                content: blogContentBase64,
                branch: githubBranch
            })
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:293',message:'Blog create response',data:{status:createBlogResponse.status,statusText:createBlogResponse.statusText,ok:createBlogResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        if (!createBlogResponse.ok) {
            const errorData = await createBlogResponse.json().catch(() => ({}));
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:297',message:'Blog create failed',data:{status:createBlogResponse.status,errorData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            throw new Error(`Failed to create blog file: ${createBlogResponse.status} - ${JSON.stringify(errorData)}`);
        }
        
        const createBlogData = await createBlogResponse.json();
        const blogCommitSha = createBlogData.commit?.sha;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:302',message:'Blog file created successfully',data:{slug,commitSha:blogCommitSha},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        // Note: Blog HTML file commit will trigger Vercel deployment automatically
        // Recipe data is stored in Supabase, so no additional deployment promotion needed
        
        // Step 3: Store recipe in Supabase (no GitHub commit = no Vercel deployment!)
        const recipeEntry = {
            slug: slug,
            title: dishData.name,
            name: dishData.name, // Keep for backward compatibility
            url: `${publicSiteUrl}/blogs/${slug}.html`,
            createdAt: new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
        };
        
        console.log('[createBlogFilesViaGitHub] Storing recipe in Supabase:', {
            slug: recipeEntry.slug,
            title: recipeEntry.title
        });
        
        // Store recipe in Supabase (no deployment needed!)
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
            
            if (supabaseUrl && supabaseKey) {
                const recipeToStore = {
                    slug: recipeEntry.slug,
                    title: recipeEntry.title,
                    name: recipeEntry.name,
                    url: recipeEntry.url,
                    created_at: new Date(recipeEntry.createdAt).toISOString()
                };
                
                // Store directly in Supabase using REST API
                const storeResponse = await fetch(`${supabaseUrl}/rest/v1/recipes`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=representation'
                    },
                    body: JSON.stringify(recipeToStore)
                }).catch(err => {
                    console.warn('[generate-blog] Failed to store recipe in Supabase:', err.message);
                    return null;
                });
                
                if (storeResponse && storeResponse.ok) {
                    console.log('[generate-blog] Recipe stored in Supabase successfully - no deployment needed!');
                } else if (storeResponse && (storeResponse.status === 404 || storeResponse.status === 406)) {
                    console.warn('[generate-blog] Supabase recipes table does not exist. See SUPABASE_SETUP.md for setup instructions.');
                } else if (storeResponse) {
                    const errorText = await storeResponse.text().catch(() => 'Unknown error');
                    console.error('[generate-blog] Failed to store recipe in Supabase:', storeResponse.status, errorText);
                }
            } else {
                console.warn('[generate-blog] Supabase credentials not configured. Recipe not stored in database.');
            }
        } catch (supabaseError) {
            console.error('[generate-blog] Supabase storage failed:', supabaseError.message);
            // Don't throw - blog file was created successfully, recipe storage is secondary
        }
        
        // Step 4: Handle image URL (image is already generated, just use the URL)
        let imageUrl = null;
        if (imagePath) {
            // imagePath is now a URL from OpenAI DALL-E API
            // Use it directly in the blog HTML (already included in featuredImageHtml)
            imageUrl = imagePath.startsWith('http') ? imagePath : `${publicSiteUrl}/images/blogs/${slug}.png`;
        }
        
        console.log('Blog successfully created via GitHub API:', {
            blogUrl: `${publicSiteUrl}/blogs/${slug}.html`,
            slug: slug,
            imageUrl: imageUrl,
            blogFilePath: blogFilePath,
            branch: githubBranch,
            basePath: githubBasePath || '(root)',
            note: 'Recipe stored in Supabase (no recipes.json commit needed)'
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:492',message:'Blog creation complete',data:{blogUrl:`${publicSiteUrl}/blogs/${slug}.html`,blogFilePath,branch:githubBranch,basePath:githubBasePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        
        // Verify the file was actually created by checking it exists
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:499',message:'Verifying blog file exists',data:{blogFilePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            const verifyResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${blogFilePath}?ref=${githubBranch}`, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:510',message:'Blog file verification',data:{status:verifyResponse.status,ok:verifyResponse.ok,path:blogFilePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            
            if (!verifyResponse.ok) {
                // #region agent log
                const verifyError = await verifyResponse.text().catch(() => '');
                fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:516',message:'Blog file verification failed',data:{status:verifyResponse.status,error:verifyError.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
                // #endregion
                console.warn(`Warning: Blog file verification failed. File may not exist at ${blogFilePath}`);
            }
        } catch (verifyError) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:522',message:'Blog file verification exception',data:{error:verifyError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            console.warn('Warning: Could not verify blog file creation:', verifyError.message);
        }
        
        return {
            success: true,
            blogUrl: `${publicSiteUrl}/blogs/${slug}.html`,
            imageUrl: imageUrl,
            blogFilePath: blogFilePath,
            branch: githubBranch
        };
        
    } catch (error) {
        console.error('GitHub API error:', {
            message: error.message,
            stack: error.stack,
            githubRepo: githubRepo,
            githubBranch: githubBranch,
            githubBasePath: githubBasePath || '(root)'
        });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:508',message:'GitHub API exception',data:{error:error.message,repo:githubRepo,branch:githubBranch},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return {
            success: false,
            error: error.message || 'Unknown error creating blog files via GitHub',
            details: {
                repo: githubRepo,
                branch: githubBranch,
                basePath: githubBasePath || '(root)'
            }
        };
    }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    // === GLOBAL CORS HEADERS ===
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // === PRE-FLIGHT REQUEST ===
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { dishData } = req.body;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:540',message:'API handler entry',data:{hasDishData:!!dishData,dishName:dishData?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        if (!dishData || !dishData.name) {
            return res.status(400).json({ error: 'dishData with name is required' });
        }

        // Create slug for the blog post
        const slug = createSlug(dishData.name);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:549',message:'Slug created',data:{slug,dishName:dishData.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Note: Blog existence check is handled inside createBlogFilesViaGitHub via GitHub API
        // This avoids CORS issues when checking the deployed site

        // Generate blog content
        const blogContent = await generateBlogPost(dishData);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:557',message:'Blog content generated',data:{contentLength:blogContent?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Generate image (optional - don't fail if image generation fails)
        let imagePath = null;
        try {
            imagePath = await generateBlogImage(dishData);
        } catch (imageError) {
            console.warn('Image generation failed, continuing without image:', imageError);
        }
        
        // Use GitHub API to create blog files in the repository
        // This will trigger a new Vercel deployment for public-site
        const githubResult = await createBlogFilesViaGitHub(dishData, blogContent, imagePath, slug);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:570',message:'GitHub result',data:{success:githubResult.success,error:githubResult.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        if (githubResult.success) {
            return res.status(200).json({
                success: true,
                blogUrl: githubResult.blogUrl,
                slug: slug,
                imageUrl: githubResult.imageUrl,
                message: 'Blog post created successfully. It will be available on the website shortly.'
            });
        } else {
            // If GitHub API fails, log detailed error and return content in response as fallback
            console.error('GitHub API failed:', {
                error: githubResult.error,
                details: githubResult.details
            });
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:585',message:'GitHub API failed, returning fallback',data:{error:githubResult.error,details:githubResult.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            return res.status(200).json({
                success: true,
                blogUrl: `https://ok-snap.com/blogs/${slug}.html`,
                slug: slug,
                imageUrl: imagePath ? `https://ok-snap.com${imagePath}` : null,
                blogContent: blogContent, // Include content in response for frontend display
                note: 'Blog content included in response (GitHub upload failed)',
                githubError: githubResult.error,
                githubDetails: githubResult.details
            });
        }
    } catch (err) {
        console.error('Blog generation error:', err);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:600',message:'Exception in handler',data:{error:err.message,stack:err.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return res.status(500).json({ 
            error: 'Failed to generate blog post',
            message: err.message || 'Unknown error'
        });
    }
};

