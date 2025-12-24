// Slug validation and encoding utilities

/**
 * Validates if a slug matches the required format
 * Valid format: lowercase letters, numbers, underscores, and hyphens only
 * @param {string} slug - The slug to validate
 * @returns {boolean} - true if valid, false otherwise
 */
function isValidSlug(slug) {
    if (!slug || typeof slug !== 'string') {
        return false;
    }
    // Must match: lowercase letters, numbers, underscores, and hyphens only
    // No spaces, special characters, or uppercase letters
    return /^[a-z0-9_-]+$/.test(slug);
}

/**
 * Validates a slug and throws an error if invalid
 * @param {string} slug - The slug to validate
 * @param {string} paramName - Name of the parameter (for error message)
 * @throws {Error} - If slug is invalid
 */
function validateSlug(slug, paramName = 'slug') {
    if (!slug) {
        throw new Error(`${paramName} is required`);
    }
    if (!isValidSlug(slug)) {
        throw new Error(`${paramName} must contain only lowercase letters, numbers, underscores, and hyphens (a-z0-9_-)`);
    }
}

/**
 * Encodes a slug for use in URLs (particularly Supabase REST API queries)
 * Always use this when inserting slugs into Supabase REST URLs
 * @param {string} slug - The slug to encode
 * @returns {string} - URL-encoded slug
 */
function encodeSlugForUrl(slug) {
    if (!slug) return '';
    return encodeURIComponent(slug);
}

module.exports = {
    isValidSlug,
    validateSlug,
    encodeSlugForUrl
};

