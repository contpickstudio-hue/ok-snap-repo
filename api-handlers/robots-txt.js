const seo = require('../lib/seo');

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return res.status(405).send('Method Not Allowed');
    }

    const origin = seo.getSiteOrigin(req);
    const sitemap = seo.absoluteUrl(origin, '/sitemap.xml');

    // Keep it permissive; block API endpoints from indexing.
    const body = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        `Sitemap: ${sitemap}`,
        ''
    ].join('\n');

    return res.status(200).send(body);
};

