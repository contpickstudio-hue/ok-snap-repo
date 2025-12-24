// Vercel serverless function for dish identification
module.exports = async (req, res) => {
    // === GLOBAL CORS HEADERS ===
    // MUST be set before ANY response or logic
    // Allows cross-origin requests from web apps, mobile apps, and preview deployments
    // Set headers for ALL requests (including OPTIONS preflight)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours - cache preflight responses
    
    // === PRE-FLIGHT REQUEST ===
    // Browsers send OPTIONS requests before POST to check CORS permissions
    // MUST return immediately - do NOT run any business logic
    // Do NOT access request body, do NOT call external APIs, do NOT return 408
    if (req.method === 'OPTIONS') {
        // Return 200 OK with CORS headers - browser will cache this response
        res.status(200);
        res.end();
        return;
    }
    
    // ============================================
    // POST REQUEST HANDLING
    // ============================================
    const { ErrorResponse } = require('../lib/error-response');
    
    if (req.method !== 'POST') {
        return ErrorResponse.methodNotAllowed(res);
    }

    try {
        const { imageData, targetLanguage, userId } = req.body;

        // Get user IP
        const userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                       req.headers['x-real-ip'] || 
                       '127.0.0.1';

        // Check daily scan limit (shared logic)
        const scanLimitCheck = await checkDailyScanLimit(userId, userIp);
        
        if (!scanLimitCheck.allowed) {
            const userLevel = scanLimitCheck.level;
            let message = '';
            
            if (userLevel === 'guest') {
                message = "Oops! That's all the scans you get for today. Come back tomorrow, or sign up for a free account to get 5 scans per day! 🍽️";
            } else {
                message = "Oops! That's all your scans for today. Come back tomorrow for more food discoveries! 🌟";
            }
            
            // Rate limit response with additional fields for frontend compatibility
            return res.status(429).json({ 
                success: false,
                error: 'SCAN_LIMIT_EXCEEDED',
                message: message,
                limitExceeded: true,
                limit: scanLimitCheck.limit,
                remaining: 0,
                level: scanLimitCheck.level,
                resetTime: scanLimitCheck.resetTime
            });
        }

        // Validate image data
        if (!imageData || typeof imageData !== 'string') {
            return ErrorResponse.badRequest(res, 'Image data is required and must be a string');
        }
        
        if (!imageData.startsWith('data:image/')) {
            return ErrorResponse.badRequest(res, 'Invalid image format. Expected data URL.');
        }

        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            return ErrorResponse.badRequest(res, 'Invalid image data format');
        }

        const sizeInBytes = (base64Data.length * 3) / 4;
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (sizeInBytes > maxSize) {
            return ErrorResponse.badRequest(res, 'Image too large. Maximum size is 10MB.');
        }

        // Validate language
        const allowedLanguages = ['English', 'Korean (한국어)', 'Spanish (Español)', 'French (Français)', 'Chinese (中文)'];
        if (targetLanguage && !allowedLanguages.includes(targetLanguage)) {
            return ErrorResponse.badRequest(res, 'Invalid language specified');
        }

        const OPENAI_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_KEY) {
            return ErrorResponse.configurationError(res, 'OPENAI_API_KEY is not configured');
        }

        // Add timeout to prevent hanging requests
        // Vercel serverless functions have a 10s timeout for FREE tier, 60s for PRO tier
        // IMPORTANT: Free tier (Hobby) only allows 10 seconds - OpenAI image analysis typically takes 15-30s
        // This will timeout on free tier. Consider upgrading to Pro or using a different hosting solution.
        // For Pro tier, use 50 seconds to leave buffer for response handling
        const OPENAI_TIMEOUT = 50000; // 50 seconds - works with Pro tier (60s limit)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, OPENAI_TIMEOUT);

        try {
            // Call OpenAI API with timeout
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_KEY}`
            },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are Ok Snap, a food recognition expert with special expertise in Korean cuisine. You identify dishes from all cuisines, but have deeper knowledge and cultural context for Korean food (Hansik).

IMPORTANT: Respond entirely in ${targetLanguage || 'English'}. All text including dish names, descriptions, and messages must be in ${targetLanguage || 'English'}.

Analyze images and identify ANY dish you see, with special emphasis and detail for Korean dishes. For Korean dishes, always include the Korean name (한글) even if responding in other languages.

Respond in valid JSON format only. Structure:
{
    "dish_detected": true/false,
    "is_korean": true/false,
    "dish_name": "Dish name in ${targetLanguage || 'English'}",
    "dish_name_korean": "한글 name" or "",  // Always include if is_korean is true, otherwise empty string
    "cuisine": "Cuisine name in ${targetLanguage || 'English'}",
    "confidence": 0.0-1.0,
    "description": "Beautiful, warm description in ${targetLanguage || 'English'} with colors, textures, plating, cultural context. For Korean dishes, include cultural significance. Write like a friendly food guide, not robotic.",
    "alternatives": ["alt1 in ${targetLanguage || 'English'}", "alt2 in ${targetLanguage || 'English'}", "alt3 in ${targetLanguage || 'English'}"], // only if confidence < 0.8
    "nutrition": {
        "calories": 250,  // Estimated calories per serving (number)
        "protein": 15,    // Grams of protein (number)
        "carbs": 30,     // Grams of carbohydrates (number)
        "fat": 8         // Grams of fat (number)
    }
}

If no dish detected: {"dish_detected": false, "message": "Error message in ${targetLanguage || 'English'}"}

IMPORTANT: Always include nutrition estimates. Base them on typical serving sizes for the dish. Use reasonable estimates - don't make up extreme numbers. If unsure, use average values for similar dishes.

Be culturally authentic, warm, and inspiring. Use light emojis occasionally (🌶, 🍚, 🥢, 🍲, 🍝, 🍜, 🍱).
All responses must be in ${targetLanguage || 'English'}.`
                        },
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `Analyze this image and identify the dish in ${targetLanguage || 'English'}. If it's Korean food, provide extra cultural context and the Korean name (한글). Otherwise, identify the dish and its cuisine. Provide a detailed, warm description entirely in ${targetLanguage || 'English'}.`
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageData
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 800 // Reduced from 1000 to speed up response time
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
                const error = new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
                return ErrorResponse.externalServiceError(res, 'Failed to process image with AI service', error);
            }

            const data = await response.json();
            
            // Include remaining scans in response
            const remainingInfo = await getRemainingScans(userId, userIp);
            return res.json({
                ...data,
                scanInfo: {
                    remaining: remainingInfo.remaining,
                    limit: remainingInfo.limit,
                    level: remainingInfo.level
                }
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Handle timeout specifically
            if (fetchError.name === 'AbortError') {
                return ErrorResponse.gatewayTimeout(res, 'Request timeout. The image analysis took too long. Please try again with a smaller image.', fetchError);
            }
            
            // Handle other fetch errors
            console.error('Error calling OpenAI API:', fetchError);
            throw fetchError; // Re-throw to be caught by outer catch
        }
    } catch (err) {
        // Ensure we always return a response - prevent hanging requests
        console.error('Identify API error:', err);
        
        // If response already sent, don't try to send again
        if (res.headersSent) {
            return;
        }
        
        return ErrorResponse.internalServerError(res, 'Failed to identify dish', err);
    }
}

// Use persistent rate limiting storage via shared module
const rateLimitStorage = require('../lib/rate-limit-storage');

async function checkDailyScanLimit(userId, userIp) {
    return await rateLimitStorage.checkDailyScanLimit(userId, userIp);
}

async function getRemainingScans(userId, userIp) {
    return await rateLimitStorage.getRemainingScans(userId, userIp);
}

