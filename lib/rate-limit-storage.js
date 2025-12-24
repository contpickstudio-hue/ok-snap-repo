// Persistent rate limiting storage using Supabase
// Replaces in-memory Map() storage for Vercel serverless environments

const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per window per IP

const scanLimits = {
    guest: 3,      // Not logged in
    free: 5        // Logged in user
};

function getTodayDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function getUserLevel(userId) {
    if (!userId) return 'guest';
    return 'free';
}

function getMidnightResetTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
}

// Get Supabase client configuration
function getSupabaseConfig() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        return null;
    }
    
    return { supabaseUrl, supabaseKey };
}

// Generic function to get a value from Supabase KV-like storage
async function getValue(key) {
    const config = getSupabaseConfig();
    if (!config) {
        console.warn('[rate-limit-storage] Supabase not configured, falling back to empty state');
        return null;
    }
    
    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}&select=*`, {
            headers: {
                'apikey': config.supabaseKey,
                'Authorization': `Bearer ${config.supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            // Table might not exist yet - return null (will be created on first write)
            if (response.status === 404 || response.status === 406) {
                return null;
            }
            throw new Error(`Supabase query failed: ${response.status}`);
        }
        
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            const record = data[0];
            // Parse JSON value if it exists
            if (record.value) {
                try {
                    return typeof record.value === 'string' ? JSON.parse(record.value) : record.value;
                } catch {
                    return record.value;
                }
            }
            // Legacy format: reconstruct from columns
            return {
                count: record.count || 0,
                resetTime: record.reset_time || record.resetTime,
                date: record.date || record.date_string,
                level: record.level,
                bonusApplied: record.bonus_applied || false
            };
        }
        
        return null;
    } catch (error) {
        console.error('[rate-limit-storage] Error getting value:', error);
        // Fail gracefully - return null to allow request to proceed
        return null;
    }
}

// Generic function to set a value in Supabase KV-like storage
async function setValue(key, value, expiresAt = null) {
    const config = getSupabaseConfig();
    if (!config) {
        console.warn('[rate-limit-storage] Supabase not configured, skipping write');
        return false;
    }
    
    try {
        const record = {
            key: key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            updated_at: new Date().toISOString()
        };
        
        // Store structured fields for easier querying
        if (value && typeof value === 'object') {
            record.count = value.count;
            record.reset_time = value.resetTime ? new Date(value.resetTime).toISOString() : null;
            record.date = value.date || value.date_string;
            record.level = value.level;
            record.bonus_applied = value.bonusApplied || false;
        }
        
        if (expiresAt) {
            record.expires_at = new Date(expiresAt).toISOString();
        }
        
        // Use UPSERT (POST with Prefer header for merge on conflict)
        // This will insert if key doesn't exist, update if it does
        const response = await fetch(`${config.supabaseUrl}/rest/v1/rate_limits`, {
            method: 'POST',
            headers: {
                'apikey': config.supabaseKey,
                'Authorization': `Bearer ${config.supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(record)
        });
        
        if (!response.ok) {
            // Table might not exist - log warning but don't fail
            if (response.status === 404 || response.status === 406) {
                console.warn('[rate-limit-storage] Rate limits table not found. Please create it using the SQL in RATE_LIMIT_SETUP.md');
                return false;
            }
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`[rate-limit-storage] Supabase write failed: ${response.status} - ${errorText}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('[rate-limit-storage] Error setting value:', error);
        // Fail gracefully - return false but don't block request
        return false;
    }
}

// Delete a value from Supabase
async function deleteValue(key) {
    const config = getSupabaseConfig();
    if (!config) {
        return false;
    }
    
    try {
        const response = await fetch(`${config.supabaseUrl}/rest/v1/rate_limits?key=eq.${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers: {
                'apikey': config.supabaseKey,
                'Authorization': `Bearer ${config.supabaseKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('[rate-limit-storage] Error deleting value:', error);
        return false;
    }
}

// ============================================
// RATE LIMITING (15-minute window)
// ============================================

/**
 * Check rate limit for IP-based requests (15-minute sliding window)
 * @param {string} ip - IP address
 * @returns {Promise<{allowed: boolean, retryAfter?: number}>}
 */
async function checkRateLimit(ip) {
    const now = Date.now();
    const key = `rate_limit:${ip}`;
    
    const record = await getValue(key);
    
    if (!record) {
        // First request - create record
        await setValue(key, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        }, new Date(now + RATE_LIMIT_WINDOW));
        return { allowed: true };
    }
    
    // Check if window expired
    const resetTime = typeof record.resetTime === 'string' ? new Date(record.resetTime).getTime() : record.resetTime;
    if (now > resetTime) {
        // Window expired - reset
        await setValue(key, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW
        }, new Date(now + RATE_LIMIT_WINDOW));
        return { allowed: true };
    }
    
    // Check if limit exceeded
    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        return { allowed: false, retryAfter };
    }
    
    // Increment count
    record.count++;
    await setValue(key, record, new Date(resetTime));
    return { allowed: true };
}

// ============================================
// DAILY SCAN LIMITS
// ============================================

/**
 * Check daily scan limit and increment if allowed
 * @param {string|null} userId - User ID (null for guests)
 * @param {string} userIp - IP address
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number, level: string, resetTime?: string, bonusApplied?: boolean}>}
 */
async function checkDailyScanLimit(userId, userIp) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    const scanKey = `daily_scan:${key}`;
    
    // If user just logged in, apply bonus scans
    if (userId && userIp) {
        const bonusResult = await applyLoginBonus(userId, userIp);
        if (bonusResult.bonusApplied) {
            // Re-fetch the record after bonus application
            const record = await getValue(scanKey);
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
    
    const record = await getValue(scanKey);
    
    // Reset if it's a new day
    if (!record || record.date !== today) {
        const newRecord = {
            count: 1,
            date: today,
            level: userLevel
        };
        await setValue(scanKey, newRecord, new Date(getMidnightResetTime()));
        
        // Track guest scans separately
        if (!userId) {
            const guestKey = `guest_scan:ip_${userIp}`;
            await setValue(guestKey, {
                count: 1,
                date: today
            }, new Date(getMidnightResetTime()));
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
    await setValue(scanKey, record, new Date(getMidnightResetTime()));
    
    // Track guest scans separately
    if (!userId) {
        const guestKey = `guest_scan:ip_${userIp}`;
        const guestRecord = await getValue(guestKey);
        if (guestRecord && guestRecord.date === today) {
            guestRecord.count++;
            await setValue(guestKey, guestRecord, new Date(getMidnightResetTime()));
        } else {
            await setValue(guestKey, {
                count: 1,
                date: today
            }, new Date(getMidnightResetTime()));
        }
    }
    
    return { 
        allowed: true, 
        remaining: limit - record.count, 
        limit,
        level: userLevel
    };
}

/**
 * Get remaining scans without incrementing
 * @param {string|null} userId - User ID (null for guests)
 * @param {string} userIp - IP address
 * @returns {Promise<{remaining: number, limit: number, level: string}>}
 */
async function getRemainingScans(userId, userIp) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    const scanKey = `daily_scan:${key}`;
    
    // If user just logged in, apply bonus scans
    if (userId && userIp) {
        await applyLoginBonus(userId, userIp);
    }
    
    const record = await getValue(scanKey);
    
    if (!record || record.date !== today) {
        return { remaining: limit, limit, level: userLevel };
    }
    
    return { 
        remaining: Math.max(0, limit - record.count), 
        limit,
        level: userLevel
    };
}

/**
 * Decrement scan count (for ad recharges)
 * @param {string|null} userId - User ID (null for guests)
 * @param {string} userIp - IP address
 * @param {number} decrementAmount - Amount to decrement (default 1)
 * @returns {Promise<{success: boolean, remaining: number, limit: number, level: string, count?: number, message?: string}>}
 */
async function decrementScanCount(userId, userIp, decrementAmount = 1) {
    const today = getTodayDateString();
    const userLevel = getUserLevel(userId);
    const limit = scanLimits[userLevel];
    const key = userId || `ip_${userIp}`;
    const scanKey = `daily_scan:${key}`;
    
    const record = await getValue(scanKey);
    
    if (!record || record.date !== today) {
        // No record exists - can't decrement, but return success
        return { 
            success: true, 
            remaining: limit, 
            limit, 
            level: userLevel,
            message: 'No scan count to decrement'
        };
    }
    
    // Decrement the count (but don't go below 0)
    record.count = Math.max(0, record.count - decrementAmount);
    await setValue(scanKey, record, new Date(getMidnightResetTime()));
    
    return {
        success: true,
        remaining: Math.max(0, limit - record.count),
        limit,
        level: userLevel,
        count: record.count
    };
}

/**
 * Apply login bonus when user logs in after using guest scans
 * @param {string} userId - User ID
 * @param {string} userIp - IP address
 * @returns {Promise<{bonusApplied: boolean, guestScansUsed?: number, bonusScans?: number, remaining?: number}>}
 */
async function applyLoginBonus(userId, userIp) {
    const today = getTodayDateString();
    const guestKey = `ip_${userIp}`;
    const userKey = userId;
    const guestScanKey = `guest_scan:${guestKey}`;
    const userScanKey = `daily_scan:${userKey}`;
    
    // Check if user already has a record (already got bonus)
    const existingUserRecord = await getValue(userScanKey);
    if (existingUserRecord && existingUserRecord.date === today && existingUserRecord.bonusApplied) {
        return { bonusApplied: false }; // Already got bonus
    }
    
    // Check if user used guest scans today
    const guestRecord = await getValue(guestScanKey);
    if (guestRecord && guestRecord.date === today && guestRecord.count > 0) {
        // User logged in after using guest scans - give bonus scans
        const guestScansUsed = guestRecord.count;
        const bonusScans = 5; // Additional scans when logging in
        
        // Calculate remaining after bonus
        const remainingAfterBonus = Math.min(scanLimits.free, guestScansUsed + bonusScans);
        const newCount = scanLimits.free - remainingAfterBonus;
        
        // Set user record with transferred guest scans + bonus
        await setValue(userScanKey, {
            count: newCount,
            date: today,
            level: 'free',
            bonusApplied: true
        }, new Date(getMidnightResetTime()));
        
        // Clear guest record for this IP (so they don't get bonus again)
        await deleteValue(guestScanKey);
        
        return { bonusApplied: true, guestScansUsed, bonusScans, remaining: remainingAfterBonus };
    }
    
    return { bonusApplied: false };
}

module.exports = {
    checkRateLimit,
    checkDailyScanLimit,
    getRemainingScans,
    decrementScanCount,
    applyLoginBonus,
    scanLimits,
    RATE_LIMIT_WINDOW,
    RATE_LIMIT_MAX_REQUESTS
};

