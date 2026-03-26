// Crawlable HTML document for a single blog post (same data as blogs-slug JSON)

function escapeHtml(str) {
    if (str == null || str === '') return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stripHtmlTags(html) {
    return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripScripts(html) {
    return String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function truncateMeta(text, maxLen) {
    const t = text || '';
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen - 1).trim()}…`;
}

module.exports = async (req, res) => {
    const { validateSlug, encodeSlugForUrl } = require('../lib/slug-validation');
    const seo = require('../lib/seo');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET, OPTIONS');
        return res.status(405).send('Method Not Allowed');
    }

    const slug = req.query.slug;
    if (!slug) {
        return res.status(400).send('Missing slug');
    }

    const basicOnly = String(req.query.basic || '').toLowerCase() === '1' || String(req.query.basic || '').toLowerCase() === 'true';

    try {
        validateSlug(slug, 'slug');
    } catch (validationError) {
        return res.status(400).send(escapeHtml(validationError.message));
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return res.status(500).send('Server configuration error');
    }

    const encodedSlug = encodeSlugForUrl(slug);
    const origin = seo.getSiteOrigin(req);
    const canonical = seo.recipeCanonicalUrl(origin, slug) + (basicOnly ? '?basic=1' : '');
    const openInAppUrl = `${seo.absoluteUrl(origin, '/browse.html')}?slug=${encodeURIComponent(slug)}`;
    let response;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7500);
        response = await fetch(`${supabaseUrl}/rest/v1/blogs?slug=eq.${encodedSlug}&select=*`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (fetchErr) {
        const isTimeout = fetchErr && fetchErr.name === 'AbortError';
        console.error('[blog-html] Supabase fetch failed:', {
            slug,
            timeout: isTimeout,
            name: fetchErr && fetchErr.name,
            message: fetchErr && fetchErr.message
        });

        // Standalone pages should never feel "blank" — return a basic, readable page.
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
        const safeCanonical = escapeHtml(canonical);
        const safeTitle = escapeHtml('Recipe');
        const safeMeta = escapeHtml('A recipe from Ok Snap.');
        const note = isTimeout
            ? 'This recipe is taking longer than usual to load. Here’s the basic page for now.'
            : 'We couldn’t load the full recipe right now. Here’s the basic page for now.';

        return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} | Ok Snap</title>
<meta name="description" content="${safeMeta}">
<link rel="canonical" href="${safeCanonical}">
</head>
<body>
<main style="max-width:820px;margin:0 auto;padding:28px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;line-height:1.55;">
<p style="margin:0 0 14px;"><a href="${escapeHtml(openInAppUrl)}" style="color:#2b6cb0;text-decoration:none;">Open in Ok Snap</a></p>
<h1 style="margin:0 0 10px;">Recipe</h1>
<p style="margin:0 0 14px;color:#444;">${escapeHtml(note)}</p>
<p style="margin:0 0 18px;"><a href="${safeCanonical}" style="color:#2b6cb0;">Try again</a></p>
<p style="margin:0;color:#666;font-size:0.95rem;">Powered by Ok Snap.</p>
</main>
</body>
</html>`);
    }

    if (!response.ok) {
        console.error('[blog-html] Upstream status', { slug, status: response.status });
        return res.status(response.status === 404 || response.status === 406 ? 404 : 502).send('Recipe unavailable');
    }

    const blogs = await response.json();
    if (!Array.isArray(blogs) || blogs.length === 0) {
        return res.status(404).send('Recipe not found');
    }

    const blog = blogs[0];
    const title = blog.title || blog.name || 'Recipe';
    const rawDesc = blog.description || stripHtmlTags(blog.content);
    const metaDesc = seo.truncateMeta(rawDesc, 160) || truncateMeta(rawDesc, 160);
    const safeTitle = escapeHtml(title);
    const safeMeta = escapeHtml(metaDesc);
    const bodyHtml = basicOnly
        ? `<p>${escapeHtml(truncateMeta(rawDesc, 420) || 'A recipe from Ok Snap.')}</p>`
        : stripScripts(blog.content || '<p>Content not available.</p>');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

    const recipeLd = seo.recipeJsonLd(blog, { canonical: canonical.replace('?basic=1', '') });
    const orgLd = seo.organizationJsonLd(origin);
    const siteLd = seo.websiteJsonLd(origin);
    const ldJson = JSON.stringify([orgLd, siteLd, recipeLd]).replace(/</g, '\\u003c');
    const ogImage = blog.image_url ? escapeHtml(blog.image_url) : '';
    const safeCanonical = escapeHtml(canonical);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} | Ok Snap</title>
<meta name="description" content="${safeMeta}">
<link rel="canonical" href="${safeCanonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeMeta}">
<meta property="og:url" content="${safeCanonical}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeMeta}">
${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ''}
<script type="application/ld+json">${ldJson}</script>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#f6f6f2; color:#222; font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif; line-height:1.6; }
  a { color:#2b6cb0; }
  .wrap { max-width: 920px; margin:0 auto; padding: 24px 16px 40px; }
  .topnav { display:flex; gap:12px; flex-wrap:wrap; align-items:center; margin-bottom: 14px; font-size: 0.95rem; }
  .pill { display:inline-block; padding: 8px 10px; border-radius: 999px; background:#fff; border:1px solid rgba(0,0,0,0.08); text-decoration:none; }
  .card { background:#fff; border:1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 18px 16px; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
  h1 { font-size: 1.85rem; line-height:1.2; margin:0 0 10px; }
  .korean { margin: 0 0 14px; color:#555; }
  .hero img { width: 100%; max-width: 860px; height: auto; border-radius: 12px; }
  .meta { margin-top: 12px; color:#555; font-size: 0.95rem; }
  .note { margin-top: 12px; color:#555; font-size:0.95rem; }
  @media (min-width: 520px) { .wrap { padding: 28px 18px 48px; } }
</style>
</head>
<body>
<main class="wrap">
  <nav class="topnav" aria-label="Recipe navigation">
    <a class="pill" href="${escapeHtml(openInAppUrl)}">Open in Ok Snap</a>
    <a class="pill" href="${escapeHtml(seo.absoluteUrl(origin, '/'))}">Discover</a>
    <a class="pill" href="${escapeHtml(seo.absoluteUrl(origin, '/browse.html'))}">Browse recipes</a>
    ${basicOnly ? `<a class="pill" href="${escapeHtml(canonical.replace('?basic=1', ''))}">Open full recipe</a>` : `<a class="pill" href="${escapeHtml(canonical + (canonical.includes('?') ? '&' : '?') + 'basic=1')}">View basic recipe only</a>`}
  </nav>

  <article class="card">
    <h1>${safeTitle}</h1>
    ${blog.name_korean ? `<p class="korean"><em>${escapeHtml(blog.name_korean)}</em></p>` : ''}
    ${blog.image_url ? `<div class="hero"><img src="${escapeHtml(blog.image_url)}" alt="${safeTitle}" loading="lazy"></div>` : ''}
    <div class="blog-post-content">${bodyHtml}</div>
    ${basicOnly ? `<p class="note">You’re viewing the basic recipe for faster loading. You can switch to the full recipe anytime.</p>` : ''}
    <p class="meta">Ok Snap · <a href="mailto:support@ok-snap.com">support@ok-snap.com</a></p>
  </article>
</main>
</body>
</html>`;

    return res.status(200).send(html);
};
