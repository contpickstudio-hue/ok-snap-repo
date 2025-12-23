// Unified API router - handles all API routes in a single serverless function
// This reduces the number of serverless functions to stay within Vercel Hobby plan limits (12 max)

const { setCorsHeaders, handlePreflight } = require('./_cors');

// Import route handlers from api-handlers directory
// This keeps them out of the api/ directory so Vercel doesn't create separate functions
const identifyHandler = require('../api-handlers/identify');
const generateBlogHandler = require('../api-handlers/generate-blog');
const recipesJsonHandler = require('../api-handlers/recipes-json');
const recipesStoreHandler = require('../api-handlers/recipes-store');
const syncRecipesHandler = require('../api-handlers/sync-recipes');
const scanLimitHandler = require('../api-handlers/scan-limit');
const decrementScanCountHandler = require('../api-handlers/decrement-scan-count');
const blogsHandler = require('../api-handlers/blogs');
const blogExistsHandler = require('../api-handlers/blog-exists-slug');
const blogsSlugHandler = require('../api-handlers/blogs-slug');

module.exports = async (req, res) => {
    // Set CORS headers on every response
    setCorsHeaders(req, res);
    
    // Handle OPTIONS preflight requests
    if (handlePreflight(req, res)) {
        return;
    }
    
    // Extract path from request
    // Vercel rewrites pass the original path in req.url
    let path = req.url;
    
    // Remove query string if present
    if (path.includes('?')) {
        path = path.split('?')[0];
    }
    
    // Remove leading /api if present
    const route = path.replace(/^\/api\/?/, '') || '';
    
    console.log(`[api-router] Route: ${route}, Method: ${req.method}, URL: ${req.url}`);
    
    try {
        // Route to appropriate handler based on path
        if (route === 'identify' && req.method === 'POST') {
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
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

