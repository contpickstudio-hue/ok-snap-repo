// Vercel serverless function for dish identification
export default async function handler(req, res) {
    // CORS headers - must be set before any response
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://ok-snap-repo.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080'
    ];
    
    // Allow Vercel preview deployments (pattern: *.vercel.app)
    const isVercelPreview = origin && origin.endsWith('.vercel.app');
    const isAllowedOrigin = allowedOrigins.includes(origin) || isVercelPreview;
    
    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Default to production URL
        res.setHeader('Access-Control-Allow-Origin', 'https://ok-snap-repo.vercel.app');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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
            
            return res.status(429).json({ 
                error: message,
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
            return res.status(400).json({ error: 'Image data is required and must be a string' });
        }
        
        if (!imageData.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format. Expected data URL.' });
        }

        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            return res.status(400).json({ error: 'Invalid image data format' });
        }

        const sizeInBytes = (base64Data.length * 3) / 4;
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (sizeInBytes > maxSize) {
            return res.status(400).json({ error: 'Image too large. Maximum size is 10MB.' });
        }

        // Validate language
        const allowedLanguages = ['English', 'Korean (한국어)', 'Spanish (Español)', 'French (Français)', 'Chinese (中文)'];
        if (targetLanguage && !allowedLanguages.includes(targetLanguage)) {
            return res.status(400).json({ error: 'Invalid language specified' });
        }

        const OPENAI_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_KEY) {
            console.error('OPENAI_API_KEY is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Call OpenAI API
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
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            return res.status(response.status).json({ error: errorData.error?.message || 'OpenAI API error' });
        }

        const data = await response.json();
        
        // Include remaining scans in response
        const remainingInfo = await getRemainingScans(userId, userIp);
        res.json({
            ...data,
            scanInfo: {
                remaining: remainingInfo.remaining,
                limit: remainingInfo.limit,
                level: remainingInfo.level
            }
        });
    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        const errorMessage = process.env.NODE_ENV === 'production' 
            ? 'An error occurred while processing your request. Please try again.'
            : error.message;
        res.status(500).json({ error: errorMessage });
    }
}

// Shared scan limit logic (simplified for serverless - in production use external store)
const scanLimits = {
    guest: 3,
    free: 5
};

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function getUserLevel(userId) {
    if (!userId) return 'guest';
    return 'free';
}

// In-memory store (for serverless, consider using Vercel KV or similar)
const dailyScansStore = new Map();
const guestScansByIp = new Map();

async function checkDailyScanLimit(userId, userIp) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    
    const record = dailyScansStore.get(key);
    
    if (!record || record.date !== today) {
        dailyScansStore.set(key, {
            count: 1,
            date: today,
            level: userLevel
        });
        return { allowed: true, remaining: limit - 1, limit, level: userLevel };
    }
    
    if (record.count >= limit) {
        return { 
            allowed: false, 
            remaining: 0, 
            limit,
            level: userLevel,
            resetTime: new Date(new Date().setDate(new Date().getDate() + 1)).setHours(0, 0, 0, 0)
        };
    }
    
    record.count++;
    dailyScansStore.set(key, record);
    
    return { 
        allowed: true, 
        remaining: limit - record.count, 
        limit,
        level: userLevel
    };
}

async function getRemainingScans(userId, userIp) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    
    const record = dailyScansStore.get(key);
    
    if (!record || record.date !== today) {
        return { remaining: limit, limit, level: userLevel };
    }
    
    return { 
        remaining: Math.max(0, limit - record.count), 
        limit,
        level: userLevel
    };
}

