/**
 * Dynamic sitemap.xml — static app routes + /recipe/{slug} for each blog.
 */

const seo = require('../lib/seo');

function xmlEscape(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function toW3cDate(isoOrDate) {
    if (!isoOrDate) return undefined;
    try {
        const d = new Date(isoOrDate);
        if (Number.isNaN(d.getTime())) return undefined;
        return d.toISOString().split('T')[0];
    } catch {
        return undefined;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return res.status(405).send('Method Not Allowed');
    }

    const origin = seo.getSiteOrigin(req);

    const staticPaths = [
        { path: '/', priority: '1.0', changefreq: 'weekly' },
        { path: '/browse.html', priority: '0.95', changefreq: 'daily' },
        { path: '/about.html', priority: '0.7', changefreq: 'monthly' },
        { path: '/contact.html', priority: '0.7', changefreq: 'monthly' },
        { path: '/privacy.html', priority: '0.5', changefreq: 'yearly' },
        { path: '/terms.html', priority: '0.5', changefreq: 'yearly' }
    ];

    const entries = staticPaths.map((row) => ({
        loc: seo.absoluteUrl(origin, row.path === '/' ? '/' : row.path),
        lastmod: undefined,
        changefreq: row.changefreq,
        priority: row.priority
    }));

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
        try {
            const r = await fetch(
                `${supabaseUrl}/rest/v1/blogs?select=slug,updated_at,created_at&order=created_at.desc`,
                {
                    headers: {
                        apikey: supabaseKey,
                        Authorization: `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (r.ok) {
                const rows = await r.json();
                if (Array.isArray(rows)) {
                    rows.forEach((row) => {
                        if (!row.slug || typeof row.slug !== 'string') return;
                        if (!/^[a-z0-9_-]+$/.test(row.slug)) return;
                        const lm = toW3cDate(row.updated_at || row.created_at);
                        entries.push({
                            loc: seo.recipeCanonicalUrl(origin, row.slug),
                            lastmod: lm,
                            changefreq: 'weekly',
                            priority: '0.85'
                        });
                    });
                }
            }
        } catch (e) {
            console.error('[sitemap-xml] blogs fetch failed:', e.message);
        }
    }

    const urlBlocks = entries
        .map((e) => {
            const lm = e.lastmod ? `\n    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : '';
            return `  <url>
    <loc>${xmlEscape(e.loc)}</loc>${lm}
    <changefreq>${xmlEscape(e.changefreq)}</changefreq>
    <priority>${xmlEscape(e.priority)}</priority>
  </url>`;
        })
        .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlBlocks}
</urlset>`;

    return res.status(200).send(xml);
};
