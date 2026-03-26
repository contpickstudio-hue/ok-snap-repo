// Unified API router - handles all API routes in a single serverless function
// This reduces the number of serverless functions to stay within Vercel Hobby plan limits (12 max)

const crypto = require('crypto');
const { setCorsHeaders, handlePreflight } = require('./_cors');
const { debugLog } = require('../lib/logger');

function decodeRouteSlugParam(raw) {
    if (raw == null || raw === '') return raw;
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

// Import route handlers from api-handlers directory
// This keeps them out of the api/ directory so Vercel doesn't create separate functions
let identifyHandler, generateBlogHandler, recipesJsonHandler, recipesStoreHandler;
let syncRecipesHandler, scanLimitHandler, decrementScanCountHandler, blogsHandler;
let blogExistsHandler, blogsSlugHandler, blogHtmlHandler, configHandler;
let sitemapXmlHandler, robotsTxtHandler;

try {
    configHandler = require('../api-handlers/config');
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
    blogHtmlHandler = require('../api-handlers/blog-html');
    sitemapXmlHandler = require('../api-handlers/sitemap-xml');
    robotsTxtHandler = require('../api-handlers/robots-txt');
    debugLog('[api-router] All handlers loaded successfully');
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
        
        // Extract route: Vercel rewrite sends /api/(.*) -> /api?path=$1, so path is in req.query.path
        let path = req.url || '';
        const pathParam = req.query && (req.query.path !== undefined ? req.query.path : req.query['path']);
        if (pathParam !== undefined && pathParam !== null) {
            const p = typeof pathParam === 'string' ? pathParam : (Array.isArray(pathParam) ? pathParam[0] : String(pathParam));
            if (p) path = '/api/' + p.replace(/^\/+/, '');
        } else {
            const originalUrl = req.headers['x-vercel-original-url'] || req.headers['x-original-url'];
            if (originalUrl) {
                try {
                    const pathFromOriginal = originalUrl.includes('?') ? originalUrl.split('?')[0] : originalUrl;
                    if (pathFromOriginal.startsWith('/api')) path = pathFromOriginal;
                } catch (e) { /* keep path */ }
            }
        }
        if (path.includes('?')) path = path.split('?')[0];
        route = path.replace(/^\/api\/?/, '') || '';
        route = route.replace(/\/$/, '');
        
        debugLog(`[api-router] Route: "${route}", Method: ${req.method}, URL: ${req.url}, Query:`, req.query);
    
        // Route to appropriate handler based on path
        if (route === 'sitemap.xml' && req.method === 'GET') {
            if (!sitemapXmlHandler) throw new Error('sitemapXmlHandler not loaded');
            return await sitemapXmlHandler(req, res);
        }

        if (route === 'robots.txt' && req.method === 'GET') {
            if (!robotsTxtHandler) throw new Error('robotsTxtHandler not loaded');
            return await robotsTxtHandler(req, res);
        }

        if (route === 'config' && req.method === 'GET') {
            if (!configHandler) throw new Error('configHandler not loaded');
            return await configHandler(req, res);
        }
        
        if (route === 'identify' && req.method === 'POST') {
            debugLog('[api-router] Routing to identify handler');
            if (!identifyHandler) {
                throw new Error('identifyHandler not loaded');
            }
            return await identifyHandler(req, res);
        }
        
        if (route === 'generate-blog' && req.method === 'POST') {
            debugLog('[api-router] Routing to generate-blog handler');
            if (!generateBlogHandler) {
                throw new Error('generateBlogHandler not loaded');
            }
            try {
                return await generateBlogHandler(req, res);
            } catch (handlerError) {
                console.error('[api-router] generate-blog handler error:', handlerError);
                console.error('[api-router] generate-blog handler stack:', handlerError.stack);
                throw handlerError;
            }
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

        // Crawlable HTML for a single post (before blogs/:slug JSON)
        const blogHtmlMatch = route.match(/^blog-html\/(.+)$/);
        if (blogHtmlMatch && req.method === 'GET') {
            req.query = req.query || {};
            req.query.slug = decodeRouteSlugParam(blogHtmlMatch[1]);
            return await blogHtmlHandler(req, res);
        }
        
        // Handle dynamic routes: blogs/[slug] and blog-exists/[slug]
        const blogsSlugMatch = route.match(/^blogs\/(.+)$/);
        if (blogsSlugMatch && req.method === 'GET') {
            // Set slug in query for the handler
            req.query = req.query || {};
            req.query.slug = decodeRouteSlugParam(blogsSlugMatch[1]);
            return await blogsSlugHandler(req, res);
        }
        
        const blogExistsMatch = route.match(/^blog-exists\/(.+)$/);
        if (blogExistsMatch && req.method === 'GET') {
            // Set slug in query for the handler
            req.query = req.query || {};
            req.query.slug = decodeRouteSlugParam(blogExistsMatch[1]);
            return await blogExistsHandler(req, res);
        }
        
        // 404 for unknown routes
        return res.status(404).json({ 
            error: 'Not found',
            message: `API route not found: ${route}`
        });
        
    } catch (error) {
        const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
        console.error('[api-router] Error:', { requestId, route, method: req.method, message: error.message });
        console.error('[api-router] Error stack:', error.stack);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            route: route,
            method: req.method,
            requestId
        });
    }
};

