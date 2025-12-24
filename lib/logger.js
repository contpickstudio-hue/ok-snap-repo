// Simple conditional logging utility
// Logs to console only when DEBUG environment variable is set to 'true' or '1'

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/**
 * Debug logger - only logs when DEBUG environment variable is enabled
 * @param {...any} args - Arguments to log (same as console.log)
 */
function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

/**
 * Error logger - always logs (preserved for errors)
 * This is just an alias for console.error to maintain consistency
 * @param {...any} args - Arguments to log (same as console.error)
 */
function errorLog(...args) {
    console.error(...args);
}

module.exports = {
    debugLog,
    errorLog
};

