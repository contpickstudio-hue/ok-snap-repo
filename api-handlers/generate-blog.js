// Blog generation API endpoint
// This endpoint generates a blog post using ChatGPT API with the specified system prompt
// Note: No filesystem operations - all files are created via GitHub API

const { debugLog } = require('../lib/logger');

function buildBlogGenerationSystemPrompt(dishData, slug) {
    const dishName = String(dishData.name || '').trim();
    const primaryKeyword = String(dishData.primaryKeyword || dishData.name || '').trim();
    const koreanLine = dishData.nameKorean
        ? `Korean name for context: ${dishData.nameKorean}.`
        : '';
    const calories = dishData.nutrition?.calories ?? 0;
    const protein = dishData.nutrition?.protein ?? 0;
    const carbs = dishData.nutrition?.carbs ?? 0;
    const fat = dishData.nutrition?.fat ?? 0;
    const nutritionLine = `Nutrition to weave in (facts only, one short subsection or paragraph): ${calories} calories, ${protein}g protein, ${carbs}g carbs, ${fat}g fat.`;
    const descriptionLine = dishData.description
        ? `Dish description from the app: ${dishData.description}`
        : '';

    return `You write short, SEO-oriented recipe blog posts. Follow every instruction below.

DISH AND KEYWORD CONTEXT
- Dish name: ${dishName}
- Primary SEO keyword (use naturally 4 to 6 times plus close variations): ${primaryKeyword}
- URL slug for this post (must appear exactly as given when you list the slug): ${slug}
${koreanLine ? `${koreanLine}\n` : ''}${descriptionLine ? `${descriptionLine}\n` : ''}${nutritionLine}

SEO AND METADATA (include at the top of the article body as HTML)
Generate and output in a section with class "seo-meta" (use a dl, paragraphs, or headings, no markdown):
- SEO title (natural, not clickbait, include main keyword)
- Meta description (140 to 160 characters)
- URL slug (must be exactly: ${slug})
- 5 to 8 relevant SEO tags (plain text list or comma-separated in a paragraph, not hashtags)

Do not mention the audience, readers, or SEO as a topic. Do not say you are optimizing.

WRITING STYLE (critical)
- Sound like a neutral human food blogger.
- Mix a cozy, slightly personal tone with clear, direct instructions.
- Use natural imperfections: occasional short fragments, varied sentence lengths, light conversational phrasing.
- Avoid robotic structure or repetitive patterns.
- Blend warmth with spartan, practical clarity: short, strong sentences where it helps.

STRUCTURE (use semantic HTML: article, section, h1 h2 h3, p, ul, ol, li)
1. Intro (2 to 4 sentences): light context (origin, flavor, when people eat it). No long storytelling.
2. Quick overview: what it tastes like, why it is popular. Keep it tight.
3. Recipe details: servings, prep time, cook time.
4. Ingredients: metric units only, realistic amounts, ul/li. No fluff.
5. Instructions: ol/li, step-by-step, natural phrasing (not stiff or formal).
6. Optional: include 1 or 2 only if relevant: Tips, Substitutions, FAQs (2 to 3 short Q and A pairs max).
7. Closing: soft call to action (invite them to try the recipe).
8. Nutrition: brief, using the numbers provided above.
9. Image prompts: a section titled "Image prompts" with 3 to 5 items labeled exactly "Image Prompt 1:" through "Image Prompt 5:" as needed. Each value is one or more p elements with the prompt text only.

IMAGE PROMPT RULES (text inside the article, not for you to run)
Each prompt must describe: hyper-realistic food photography, cozy homemade kitchen, natural lighting, slightly imperfect (not studio perfect).
Include coverage across prompts: finished dish (required in at least one), ingredients laid out, cooking process (1 to 2 prompts), optional plating or serving shot.

HUMANIZATION AND OUTPUT RULES (very important)
- Use clear, simple language. Spartan and informative. Short, impactful sentences. Active voice. Avoid passive voice where you can.
- Use "you" and "your" when it fits.
- Do not use em dashes anywhere. Use commas or periods only to connect ideas.
- Do not use semicolons in the article text.
- No markdown in the output. No asterisks for emphasis. Valid HTML only.
- No hashtags.
- Avoid constructions like "not just this, but also this". Avoid heavy metaphors and cliches. Avoid broad generalizations.
- Avoid setup phrases such as: in conclusion, in closing, in summary, moreover, furthermore, hence.
- Avoid unnecessary adjectives and adverbs.
- Do not add warnings, notes about AI, or meta commentary. Output only the requested article HTML.

Avoid these words and phrases (case-insensitive where practical):
can, may, just, that, very, really, literally, actually, certainly, probably, basically, could, maybe, delve, embark, enlightening, esteemed, shed light, craft, crafting, imagine, realm, game-changer, unlock, discover, skyrocket, abyss, not alone, in a world where, revolutionize, disruptive, utilize, utilizing, dive deep, tapestry, illuminate, unveil, pivotal, intricate, elucidate, however, harness, exciting, groundbreaking, cutting-edge, remarkable, remains to be seen, glimpse into, navigating, landscape, stark, testament, boost, skyrocketing, opened up, powerful, inquiries, ever-evolving

OUTPUT FORMAT
Return one HTML fragment suitable for injection into a page: start with an article element. Use proper nesting. Do not wrap the response in markdown code fences. No script tags.`;
}

async function generateBlogPost(dishData, slug) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set in environment variables');
    }

    const systemPrompt = buildBlogGenerationSystemPrompt(dishData, slug);

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
                        content: 'Write the recipe blog post. Follow the system instructions exactly. Output HTML only.'
                    }
                ],
                max_tokens: 4096,
                temperature: 0.75
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
    const normalizedName = String(name || '').trim().toLowerCase();
    const baseSlug = normalizedName
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    if (baseSlug) {
        return baseSlug;
    }

    // Ensure a stable, non-empty slug for non-Latin dish names.
    let hash = 0;
    for (let i = 0; i < normalizedName.length; i++) {
        hash = ((hash << 5) - hash) + normalizedName.charCodeAt(i);
        hash |= 0;
    }

    return `recipe-${Math.abs(hash).toString(36) || 'item'}`;
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

    const cuisineHint = dishData.isKorean ? 'Korean home cooking' : (dishData.cuisine || 'home-cooked meal');
    const imagePrompt = [
        'Hyper-realistic food photograph',
        `${dishData.name}${dishData.nameKorean ? ` (${dishData.nameKorean})` : ''}`,
        cuisineHint,
        'cozy homemade kitchen',
        'soft natural window light',
        'slightly imperfect styling',
        'not a sterile studio shot',
        'shallow depth of field',
        'appetizing steam or texture where it fits'
    ].join(', ');

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
        debugLog(`Generated image URL for ${dishData.name}`);
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
    const config = require('../lib/config');
    const { encodeSlugForUrl } = require('../lib/slug-validation');
    const publicSiteUrl = config.getPublicSiteUrl();
    
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
        
        // Check if blog already exists (encode slug for Supabase REST URL)
        const encodedSlug = encodeSlugForUrl(slug);
        const checkResponse = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${encodedSlug}&select=slug`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (checkResponse.ok) {
            const existing = await checkResponse.json();
            if (Array.isArray(existing) && existing.length > 0) {
                debugLog(`[storeBlogInSupabase] Blog already exists for ${dishData.name}, skipping`);
                return {
                    success: true,
                    blogUrl: `${publicSiteUrl}/blog.html?slug=${encodedSlug}`,
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
        
        debugLog('[storeBlogInSupabase] Storing blog in Supabase:', {
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
        debugLog('[storeBlogInSupabase] Blog stored successfully in Supabase - NO deployment needed!');
        
        // Step 3: Store recipe metadata in recipes table (for listings)
        const recipeEntry = {
            slug: slug,
            title: dishData.name,
            name: dishData.name,
            url: `${publicSiteUrl}/blog.html?slug=${encodedSlug}`,
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
            debugLog('[storeBlogInSupabase] Recipe metadata stored successfully');
        }
        
        return {
            success: true,
            blogUrl: `${publicSiteUrl}/blog.html?slug=${encodedSlug}`,
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
    // Note: CORS headers are already set by the router, but we set them here too for safety
    // === GLOBAL CORS HEADERS ===
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // === PRE-FLIGHT REQUEST ===
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { ErrorResponse } = require('../lib/error-response');
    
    if (req.method !== 'POST') {
        return ErrorResponse.methodNotAllowed(res);
    }

    try {
        debugLog('[generate-blog] Handler called, parsing request body...');
        const { dishData } = req.body;
        
        if (!dishData) {
            console.error('[generate-blog] No dishData in request body');
            debugLog('[generate-blog] Request body:', JSON.stringify(req.body).substring(0, 200));
        }
        
        if (!dishData || !dishData.name) {
            return ErrorResponse.badRequest(res, 'dishData with name is required');
        }

        // Create slug for the blog post
        const slug = createSlug(dishData.name);
        
        // Generate blog content
        const blogContent = await generateBlogPost(dishData, slug);
        
        // Generate image (optional - don't fail if image generation fails)
        let imagePath = null;
        try {
            imagePath = await generateBlogImage(dishData);
        } catch (imageError) {
            console.warn('Image generation failed, continuing without image:', imageError);
        }
        
        // Store blog in Supabase (NO GitHub commits, NO deployments!)
        const supabaseResult = await storeBlogInSupabase(dishData, blogContent, imagePath, slug);
        
        if (supabaseResult.success) {
            return res.status(200).json({
                success: true,
                blogUrl: supabaseResult.blogUrl,
                slug: slug,
                imageUrl: supabaseResult.imageUrl,
                message: 'Blog post created and stored in Supabase. Available immediately - no deployment needed!'
            });
        } else {
            return ErrorResponse.databaseError(res, 'Failed to store blog in Supabase', new Error(supabaseResult.error || 'Unknown error'));
        }
    } catch (err) {
        return ErrorResponse.internalServerError(res, 'Failed to generate blog post', err);
    }
};

