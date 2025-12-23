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
 * Store blog in Supabase (NO GitHub commits, NO deployments!)
 * This is the ONLY way blogs are stored - Supabase is the single source of truth
 */
async function storeBlogInSupabase(dishData, blogContent, imagePath, slug) {
    const publicSiteUrl = 'https://ok-snap.com';
    
    try {
        // Step 1: Check if blog already exists in Supabase
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            return {
                success: false,
                error: 'Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
            };
        }
        
        // Check if blog already exists
        const checkResponse = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${slug}&select=slug`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (checkResponse.ok) {
            const existing = await checkResponse.json();
            if (Array.isArray(existing) && existing.length > 0) {
                console.log(`[storeBlogInSupabase] Blog already exists for ${dishData.name}, skipping`);
                return {
                    success: true,
                    blogUrl: `${publicSiteUrl}/blog.html?slug=${slug}`,
                    slug: slug,
                    skipped: true,
                    message: 'Blog already exists'
                };
            }
        }
        
        // Step 2: Store full blog content in Supabase blogs table
        const blogToStore = {
            slug: slug,
            title: dishData.name,
            name: dishData.name,
            name_korean: dishData.nameKorean || null,
            content: blogContent,
            image_url: imagePath || null,
            description: dishData.description || null,
            cuisine: dishData.cuisine || (dishData.isKorean ? 'Korean' : null),
            language: dishData.language || 'en',
            created_at: new Date().toISOString()
        };
        
        console.log('[storeBlogInSupabase] Storing blog in Supabase:', {
            slug: blogToStore.slug,
            title: blogToStore.title,
            contentLength: blogContent.length
        });
        
        const blogStoreResponse = await fetch(`${supabaseUrl}/rest/v1/blogs`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(blogToStore)
        });
        
        if (!blogStoreResponse.ok) {
            const errorText = await blogStoreResponse.text().catch(() => 'Unknown error');
            console.error('[storeBlogInSupabase] Failed to store blog:', blogStoreResponse.status, errorText);
            throw new Error(`Failed to store blog in Supabase: ${blogStoreResponse.status} - ${errorText}`);
        }
        
        const storedBlog = await blogStoreResponse.json();
        console.log('[storeBlogInSupabase] Blog stored successfully in Supabase - NO deployment needed!');
        
        // Step 3: Store recipe metadata in recipes table (for listings)
        const recipeEntry = {
            slug: slug,
            title: dishData.name,
            name: dishData.name,
            url: `${publicSiteUrl}/blog.html?slug=${slug}`,
            created_at: new Date().toISOString()
        };
        
        const recipeStoreResponse = await fetch(`${supabaseUrl}/rest/v1/recipes`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(recipeEntry)
        }).catch(err => {
            console.warn('[storeBlogInSupabase] Failed to store recipe metadata (non-critical):', err.message);
            return null;
        });
        
        if (recipeStoreResponse && recipeStoreResponse.ok) {
            console.log('[storeBlogInSupabase] Recipe metadata stored successfully');
        }
        
        return {
            success: true,
            blogUrl: `${publicSiteUrl}/blog.html?slug=${slug}`,
            imageUrl: imagePath || null,
            slug: slug,
            message: 'Blog stored in Supabase - available immediately, no deployment needed!'
        };
        
    } catch (error) {
        console.error('[storeBlogInSupabase] Error:', {
            message: error.message,
            stack: error.stack
        });
        return {
            success: false,
            error: error.message || 'Unknown error storing blog in Supabase'
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
        
        // Store blog in Supabase (NO GitHub commits, NO deployments!)
        const supabaseResult = await storeBlogInSupabase(dishData, blogContent, imagePath, slug);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0410967d-f074-48d8-be31-33e3d143eccb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'generate-blog.js:570',message:'Supabase storage result',data:{success:supabaseResult.success,error:supabaseResult.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        if (supabaseResult.success) {
            return res.status(200).json({
                success: true,
                blogUrl: supabaseResult.blogUrl,
                slug: slug,
                imageUrl: supabaseResult.imageUrl,
                message: 'Blog post created and stored in Supabase. Available immediately - no deployment needed!'
            });
        } else {
            console.error('Supabase storage failed:', supabaseResult.error);
            return res.status(500).json({
                success: false,
                error: 'Failed to store blog in Supabase',
                message: supabaseResult.error || 'Unknown error'
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

