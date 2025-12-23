// Unified API router - handles all API routes in a single serverless function
// This reduces the number of serverless functions to stay within Vercel Hobby plan limits (12 max)

const { setCorsHeaders, handlePreflight } = require('./_cors');

// Import route handlers from api-handlers directory
// This keeps them out of the api/ directory so Vercel doesn't create separate functions
let identifyHandler, generateBlogHandler, recipesJsonHandler, recipesStoreHandler;
let syncRecipesHandler, scanLimitHandler, decrementScanCountHandler, blogsHandler;
let blogExistsHandler, blogsSlugHandler;

try {
    identifyHandler = require('../api-handlers/identify');
    generateBlogHandler = require('../api-handlers/generate-blog');
    recipesJsonHandler = require('../api-handlers/recipes-json');
    recipesStoreHandler = require('../api-handlers/recipes-store');
    syncRecipesHandler = require('../api-handlers/sync-recipes');
    scanLimitHandler = require('../api-handlers/scan-limit');
    decrementScanCountHandler = require('../api-handlers/decrement-scan-count');
    blogsHandler = require('../api-handlers/blogs');
    // Handle files with brackets in path - renamed to avoid Node.js issues
    blogExistsHandler = require('../api-handlers/blog-exists-slug');
    blogsSlugHandler = require('../api-handlers/blogs-slug');
    console.log('[api-router] All handlers loaded successfully');
} catch (requireError) {
    console.error('[api-router] Failed to load handlers:', requireError);
    throw requireError;
}

module.exports = async (req, res) => {
    let route = 'unknown';
    try {
        // Set CORS headers on every response
        setCorsHeaders(req, res);
        
        // Handle OPTIONS preflight requests
        if (handlePreflight(req, res)) {
            return;
        }
        
        // Extract path from request
        // Vercel rewrites: original path is in req.url, but we need to check query params too
        let path = req.url || '';
        
        // Also check if path is in query (some Vercel configurations put it there)
        if (!path && req.query && req.query.path) {
            path = req.query.path;
        }
        
        // Remove query string if present
        if (path.includes('?')) {
            path = path.split('?')[0];
        }
        
        // Remove leading /api if present
        route = path.replace(/^\/api\/?/, '') || '';
        
        console.log(`[api-router] Route: ${route}, Method: ${req.method}, URL: ${req.url}, Query:`, req.query);
    
        // Route to appropriate handler based on path
        if (route === 'identify' && req.method === 'POST') {
            console.log('[api-router] Routing to identify handler');
            if (!identifyHandler) {
                throw new Error('identifyHandler not loaded');
            }
            return await identifyHandler(req, res);
        }
        
        if (route === 'generate-blog' && req.method === 'POST') {
            return await generateBlogHandler(req, res);
        }
        
        if (route === 'recipes-json' && req.method === 'GET') {
            return await recipesJsonHandler(req, res);
        }
        
        if (route === 'recipes-store' && (req.method === 'GET' || req.method === 'POST')) {
            return await recipesStoreHandler(req, res);
        }
        
        if (route === 'sync-recipes' && (req.method === 'GET' || req.method === 'POST')) {
            return await syncRecipesHandler(req, res);
        }
        
        if (route === 'scan-limit' && req.method === 'GET') {
            return await scanLimitHandler(req, res);
        }
        
        if (route === 'decrement-scan-count' && req.method === 'POST') {
            return await decrementScanCountHandler(req, res);
        }
        
        if (route === 'blogs' && req.method === 'GET') {
            return await blogsHandler(req, res);
        }
        
        // Handle dynamic routes: blogs/[slug] and blog-exists/[slug]
        const blogsSlugMatch = route.match(/^blogs\/(.+)$/);
        if (blogsSlugMatch && req.method === 'GET') {
            // Set slug in query for the handler
            req.query = req.query || {};
            req.query.slug = blogsSlugMatch[1];
            return await blogsSlugHandler(req, res);
        }
        
        const blogExistsMatch = route.match(/^blog-exists\/(.+)$/);
        if (blogExistsMatch && req.method === 'GET') {
            // Set slug in query for the handler
            req.query = req.query || {};
            req.query.slug = blogExistsMatch[1];
            return await blogExistsHandler(req, res);
        }
        
        // 404 for unknown routes
        return res.status(404).json({ 
            error: 'Not found',
            message: `API route not found: ${route}`
        });
        
    } catch (error) {
        console.error('[api-router] Error:', error);
        console.error('[api-router] Error stack:', error.stack);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            route: route,
            method: req.method
        });
    }
};

