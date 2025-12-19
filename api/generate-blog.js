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
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO; // Format: "owner/repo" e.g., "username/ok-snap"
    // Default to 'site' branch where the blog website is deployed
    const githubBranch = process.env.GITHUB_BRANCH || 'site';
    // If your site branch root contains blog files directly (not in public-site/ folder),
    // set GITHUB_BASE_PATH environment variable to empty string
    // Default to empty string since site branch likely has files at root
    const githubBasePath = process.env.GITHUB_BASE_PATH || '';
    
    if (!githubToken || !githubRepo) {
        return {
            success: false,
            error: 'GitHub credentials not configured. Set GITHUB_TOKEN and GITHUB_REPO environment variables.'
        };
    }
    
    try {
        const [owner, repo] = githubRepo.split('/');
        if (!owner || !repo) {
            throw new Error('Invalid GITHUB_REPO format. Use "owner/repo"');
        }
        
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
        const checkBlogResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${blogFilePath}?ref=${githubBranch}`, {
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (checkBlogResponse.ok) {
            // Blog already exists - skip generation
            console.log(`Blog already exists for ${dishData.name}, skipping generation`);
            return {
                success: true,
                blogUrl: `${publicSiteUrl}/blogs/${slug}.html`,
                slug: slug,
                skipped: true,
                message: 'Blog already exists'
            };
        }
        
        // Step 2: Create blog HTML file (blog doesn't exist)
        const blogContentBase64 = Buffer.from(fullHtml, 'utf8').toString('base64');
        
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
        
        if (!createBlogResponse.ok) {
            const errorData = await createBlogResponse.json().catch(() => ({}));
            throw new Error(`Failed to create blog file: ${createBlogResponse.status} - ${JSON.stringify(errorData)}`);
        }
        
        // Step 3: Update recipes.json
        const recipesJsonPath = `${githubBasePath ? githubBasePath + '/' : ''}recipes.json`;
        let recipes = [];
        let recipesSha = null;
        
        // Get existing recipes.json if it exists
        try {
            const getRecipesResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${recipesJsonPath}?ref=${githubBranch}`, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (getRecipesResponse.ok) {
                const fileData = await getRecipesResponse.json();
                recipesSha = fileData.sha;
                const content = Buffer.from(fileData.content, 'base64').toString('utf8');
                recipes = JSON.parse(content);
            }
        } catch (e) {
            // File doesn't exist, start fresh
            recipes = [];
        }
        
        // Update recipes array
        const recipeEntry = {
            name: dishData.name,
            slug: slug,
            url: `${publicSiteUrl}/blogs/${slug}.html`,
            createdAt: new Date().toISOString()
        };
        
        const existingIndex = recipes.findIndex(r => r.slug === slug);
        if (existingIndex >= 0) {
            recipes[existingIndex] = recipeEntry;
        } else {
            recipes.unshift(recipeEntry);
        }
        
        const recipesContentBase64 = Buffer.from(JSON.stringify(recipes, null, 2), 'utf8').toString('base64');
        
        const updateRecipesResponse = await fetch(`${baseUrl}/repos/${owner}/${repo}/contents/${recipesJsonPath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'ok-snap-blog-generator'
            },
            body: JSON.stringify({
                message: `Update recipes.json: Add ${dishData.name}`,
                content: recipesContentBase64,
                sha: recipesSha,
                branch: githubBranch
            })
        });
        
        if (!updateRecipesResponse.ok && updateRecipesResponse.status !== 422) {
            const recipesError = await updateRecipesResponse.json().catch(() => ({}));
            console.error('Failed to update recipes.json:', {
                status: updateRecipesResponse.status,
                statusText: updateRecipesResponse.statusText,
                error: recipesError,
                recipesJsonPath: recipesJsonPath,
                branch: githubBranch
            });
            // Don't throw - blog was created, recipes.json update failure is not critical
        } else {
            console.log('Successfully updated recipes.json:', {
                recipesJsonPath: recipesJsonPath,
                branch: githubBranch,
                recipeCount: recipes.length
            });
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
            recipesJsonPath: recipesJsonPath,
            branch: githubBranch,
            basePath: githubBasePath || '(root)'
        });
        
        return {
            success: true,
            blogUrl: `${publicSiteUrl}/blogs/${slug}.html`,
            imageUrl: imageUrl
        };
        
    } catch (error) {
        console.error('GitHub API error:', {
            message: error.message,
            stack: error.stack,
            githubRepo: githubRepo,
            githubBranch: githubBranch,
            githubBasePath: githubBasePath || '(root)'
        });
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
        
        if (!dishData || !dishData.name) {
            return res.status(400).json({ error: 'dishData with name is required' });
        }

        // Check if blog already exists by checking the deployed site
        const slug = createSlug(dishData.name);
        const publicSiteUrl = process.env.PUBLIC_SITE_URL || 'https://ok-snap.com';
        const blogUrl = `${publicSiteUrl}/blogs/${slug}.html`;
        
        try {
            const checkResponse = await fetch(blogUrl, { method: 'HEAD' });
            if (checkResponse.ok) {
                return res.status(200).json({
                    success: true,
                    blogUrl: blogUrl,
                    slug: slug,
                    message: 'Blog already exists'
                });
            }
        } catch (checkError) {
            // Blog doesn't exist yet, continue with generation
            console.log('Blog does not exist yet, proceeding with generation');
        }

        // Generate blog content
        const blogContent = await generateBlogPost(dishData);
        
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
        return res.status(500).json({ 
            error: 'Failed to generate blog post',
            message: err.message || 'Unknown error'
        });
    }
};

