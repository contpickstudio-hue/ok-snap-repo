const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
function validateEnvironment() {
    const errors = [];
    
    if (!process.env.OPENAI_API_KEY) {
        errors.push('OPENAI_API_KEY is required in .env file');
    } else if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
        errors.push('OPENAI_API_KEY appears to be invalid (should start with "sk-")');
    }
    
    if (errors.length > 0) {
        console.error('\n❌ Environment Configuration Errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        console.error('\nPlease fix these errors before starting the server.\n');
        process.exit(1);
    }
    
    console.log('✅ Environment validation passed');
    console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY.substring(0, 7)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}`);
    console.log(`  PORT: ${process.env.PORT || 3000}`);
}

// Validate environment on startup
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// SECURITY MIDDLEWARE
// ============================================
// CORS configuration
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Security headers
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Body parser with size limit
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb for security
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// RATE LIMITING (Simple in-memory store)
// ============================================
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per window per IP

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old entries
    if (rateLimitStore.size > 1000) {
        for (const [key, value] of rateLimitStore.entries()) {
            if (now - value.resetTime > RATE_LIMIT_WINDOW) {
                rateLimitStore.delete(key);
            }
        }
    }
    
    const record = rateLimitStore.get(ip);
    
    if (!record) {
        rateLimitStore.set(ip, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        });
        return next();
    }
    
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
        return next();
    }
    
    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ 
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((record.resetTime - now) / 1000)
        });
    }
    
    record.count++;
    next();
}

// ============================================
// DAILY SCAN LIMITS BY USER LEVEL
// ============================================
const scanLimits = {
    guest: 3,      // Not logged in
    free: 10,      // Logged in, free user
    premium: 50   // Premium user
};

const dailyScansStore = new Map(); // key: userId or IP, value: { count, date, level }
const guestScansByIp = new Map(); // Track guest scans by IP for bonus on login

function getTodayDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getUserLevel(userId, isPremium) {
    if (!userId) return 'guest';
    if (isPremium) return 'premium';
    return 'free';
}

// Give bonus scans when user logs in after using guest scans
function applyLoginBonus(userId, userIp) {
    const today = getTodayDateString();
    const guestKey = `ip_${userIp}`;
    const userKey = userId;
    
    // Check if user already has a record (already got bonus)
    const existingUserRecord = dailyScansStore.get(userKey);
    if (existingUserRecord && existingUserRecord.date === today && existingUserRecord.bonusApplied) {
        return { bonusApplied: false }; // Already got bonus
    }
    
    // Check if user used guest scans today
    const guestRecord = guestScansByIp.get(guestKey);
    if (guestRecord && guestRecord.date === today && guestRecord.count > 0) {
        // User logged in after using guest scans - give bonus scans
        const guestScansUsed = guestRecord.count;
        const bonusScans = 5; // Additional scans when logging in
        
        // Calculate: if they used X guest scans, they get 5 bonus scans
        // So remaining = min(10, guestScansUsed + 5) - guestScansUsed = min(5, 10 - guestScansUsed)
        // Actually simpler: they used X scans as guest, now they have 10 limit, so remaining = 10 - X
        // But we want to give them 5 bonus, so: remaining = min(10, X + 5) - X = min(5, 10 - X)
        // Even simpler: remaining = 10 - guestScansUsed (but cap at 5 bonus)
        const remainingAfterBonus = Math.min(scanLimits.free, guestScansUsed + bonusScans);
        const newCount = scanLimits.free - remainingAfterBonus;
        
        // Set user record with transferred guest scans + bonus
        dailyScansStore.set(userKey, {
            count: newCount,
            date: today,
            level: 'free',
            bonusApplied: true
        });
        
        // Clear guest record for this IP (so they don't get bonus again)
        guestScansByIp.delete(guestKey);
        
        return { bonusApplied: true, guestScansUsed, bonusScans, remaining: remainingAfterBonus };
    }
    
    return { bonusApplied: false };
}

function checkDailyScanLimit(userId, userIp, isPremium = false) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId, isPremium);
    const limit = scanLimits[userLevel];
    
    // Use userId if logged in, otherwise use IP
    const key = userId || `ip_${userIp}`;
    
    // If user just logged in, apply bonus scans
    if (userId && userIp) {
        const bonusResult = applyLoginBonus(userId, userIp);
        if (bonusResult.bonusApplied) {
            // Re-fetch the record after bonus application
            const record = dailyScansStore.get(key);
            if (record && record.date === today) {
                const remaining = limit - record.count;
                return { 
                    allowed: remaining > 0, 
                    remaining: Math.max(0, remaining), 
                    limit,
                    level: userLevel,
                    bonusApplied: true
                };
            }
        }
    }
    
    const record = dailyScansStore.get(key);
    
    // Reset if it's a new day
    if (!record || record.date !== today) {
        dailyScansStore.set(key, {
            count: 1,
            date: today,
            level: userLevel
        });
        
        // Track guest scans separately
        if (!userId) {
            guestScansByIp.set(`ip_${userIp}`, {
                count: 1,
                date: today
            });
        }
        
        return { allowed: true, remaining: limit - 1, limit, level: userLevel };
    }
    
    // Check if limit exceeded
    if (record.count >= limit) {
        return { 
            allowed: false, 
            remaining: 0, 
            limit,
            level: userLevel,
            resetTime: getMidnightResetTime()
        };
    }
    
    // Increment count
    record.count++;
    dailyScansStore.set(key, record);
    
    // Track guest scans separately
    if (!userId) {
        const guestKey = `ip_${userIp}`;
        const guestRecord = guestScansByIp.get(guestKey);
        if (guestRecord && guestRecord.date === today) {
            guestRecord.count++;
        } else {
            guestScansByIp.set(guestKey, {
                count: 1,
                date: today
            });
        }
    }
    
    return { 
        allowed: true, 
        remaining: limit - record.count, 
        limit,
        level: userLevel
    };
}

function getMidnightResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
}

function getRemainingScans(userId, userIp, isPremium = false) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId, isPremium);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    
    // If user just logged in, apply bonus scans
    if (userId && userIp) {
        applyLoginBonus(userId, userIp);
    }
    
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

// Clean up old entries daily (runs every hour)
setInterval(() => {
    const today = getTodayDateString();
    for (const [key, value] of dailyScansStore.entries()) {
        if (value.date !== today) {
            dailyScansStore.delete(key);
        }
    }
}, 60 * 60 * 1000); // Every hour

// Serve static files from www directory
app.use(express.static(path.join(__dirname, 'www')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Get remaining scans endpoint
app.get('/api/scan-limit', (req, res) => {
    const userId = req.query.userId || null;
    const userIp = req.ip || req.connection.remoteAddress || 'unknown';
    const isPremium = req.query.isPremium === 'true';
    
    const remainingInfo = getRemainingScans(userId, userIp, isPremium);
    res.json(remainingInfo);
});

// ============================================
// INPUT VALIDATION HELPERS
// ============================================
function validateImageData(imageData) {
    if (!imageData || typeof imageData !== 'string') {
        return { valid: false, error: 'Image data is required and must be a string' };
    }
    
    // Check if it's a data URL
    if (!imageData.startsWith('data:image/')) {
        return { valid: false, error: 'Invalid image format. Expected data URL.' };
    }
    
    // Check size (base64 encoded image should be reasonable)
    const base64Data = imageData.split(',')[1];
    if (!base64Data) {
        return { valid: false, error: 'Invalid image data format' };
    }
    
    // Approximate size check (base64 is ~33% larger than binary)
    const sizeInBytes = (base64Data.length * 3) / 4;
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (sizeInBytes > maxSize) {
        return { valid: false, error: 'Image too large. Maximum size is 10MB.' };
    }
    
    return { valid: true };
}

function validateLanguage(language) {
    const allowedLanguages = ['English', 'Korean (한국어)', 'Spanish (Español)', 'French (Français)', 'Chinese (中文)'];
    if (!language || allowedLanguages.includes(language)) {
        return { valid: true };
    }
    return { valid: false, error: 'Invalid language specified' };
}

// ============================================
// API ENDPOINTS
// ============================================

// OpenAI API proxy endpoint with rate limiting and daily scan limits
app.post('/api/analyze-image', rateLimit, async (req, res) => {
    try {
        const { imageData, targetLanguage, userId, isPremium } = req.body;
        
        // Get user IP for guest users
        const userIp = req.ip || req.connection.remoteAddress || 'unknown';
        
        // Check daily scan limit
        const limitCheck = checkDailyScanLimit(userId, userIp, isPremium === true);
        
        if (!limitCheck.allowed) {
            const userLevel = limitCheck.level;
            let message = '';
            
            if (userLevel === 'guest') {
                message = "Oops! That's all the scans you get for today. Come back tomorrow, or sign up for a free account to get 10 scans per day! 🍽️";
            } else if (userLevel === 'free') {
                message = "Oops! That's all your free scans for today. Come back tomorrow, or upgrade to Premium for 50 scans per day! ⭐";
            } else {
                message = "Oops! That's all your scans for today. Come back tomorrow for more food discoveries! 🌟";
            }
            
            return res.status(429).json({ 
                error: message,
                message: message, // Also include as 'message' for frontend display
                limitExceeded: true,
                limit: limitCheck.limit,
                remaining: 0,
                level: limitCheck.level,
                resetTime: limitCheck.resetTime
            });
        }

        // Validate image data
        const imageValidation = validateImageData(imageData);
        if (!imageValidation.valid) {
            return res.status(400).json({ error: imageValidation.error });
        }

        // Validate language (optional, defaults to English)
        if (targetLanguage) {
            const langValidation = validateLanguage(targetLanguage);
            if (!langValidation.valid) {
                return res.status(400).json({ error: langValidation.error });
            }
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY is not set in environment variables');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        // Call OpenAI API
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
        const remainingInfo = getRemainingScans(userId, userIp, isPremium === true);
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
        
        // Don't expose internal error details in production
        const errorMessage = NODE_ENV === 'production' 
            ? 'An error occurred while processing your request. Please try again.'
            : error.message;
            
        res.status(500).json({ error: errorMessage });
    }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: NODE_ENV === 'production' 
            ? 'An unexpected error occurred'
            : err.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Serve index.html for all routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', () => {
    console.log('\nSIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    process.exit(0);
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Ok Snap Server Started`);
    console.log('='.repeat(50));
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Port: ${PORT}`);
    console.log(`\nAccessible at:`);
    console.log(`  - http://localhost:${PORT}`);
    if (NODE_ENV === 'development') {
        console.log(`  - http://192.168.2.16:${PORT} (or your computer's IP)`);
        console.log(`\n💡 Open http://localhost:${PORT} in your browser!`);
        console.log(`💡 Make sure mobile devices are on the same WiFi network!`);
    }
    console.log('='.repeat(50) + '\n');
});

