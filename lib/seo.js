const BRAND = 'Ok Snap';

function getSiteOrigin(req) {
    // Prefer forwarded headers (Vercel / proxies)
    const xfProto = req && req.headers && (req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol']);
    const xfHost = req && req.headers && (req.headers['x-forwarded-host'] || req.headers['x-forwarded-server']);
    const host = (xfHost || (req && req.headers && req.headers.host) || '').toString();

    const protoRaw = (xfProto || (req && req.headers && req.headers['x-forwarded-proto']) || '').toString();
    const proto = protoRaw ? protoRaw.split(',')[0].trim() : '';

    if (proto && host) return `${proto}://${host}`;
    if (host) {
        const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
        return `${isLocal ? 'http' : 'https'}://${host}`;
    }

    // Safe production fallback
    return 'https://scanner.ok-snap.com';
}

function absoluteUrl(origin, pathname) {
    const o = (origin || '').replace(/\/$/, '');
    const p = pathname ? `/${String(pathname).replace(/^\/+/, '')}` : '/';
    return `${o}${p}`;
}

function recipeCanonicalUrl(origin, slug) {
    return absoluteUrl(origin, `/recipe/${slug}`);
}

function truncateMeta(text, maxLen) {
    const t = String(text || '').trim().replace(/\s+/g, ' ');
    if (!t) return '';
    if (t.length <= maxLen) return t;
    return `${t.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function organizationJsonLd(origin) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: BRAND,
        url: origin,
        email: 'support@ok-snap.com'
    };
}

function websiteJsonLd(origin) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: BRAND,
        url: origin
    };
}

function recipeJsonLd(blog, opts) {
    const o = opts || {};
    const title = blog && (blog.title || blog.name) ? String(blog.title || blog.name) : 'Recipe';
    const descRaw = (blog && (blog.description || blog.content)) ? String(blog.description || blog.content) : '';
    const description = truncateMeta(descRaw.replace(/<[^>]+>/g, ' '), 300) || `A recipe from ${BRAND}.`;
    const image = blog && blog.image_url ? [String(blog.image_url)] : undefined;
    const createdAt = blog && blog.created_at ? String(blog.created_at) : undefined;
    const updatedAt = blog && blog.updated_at ? String(blog.updated_at) : undefined;

    return {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: title,
        description,
        image,
        datePublished: createdAt,
        dateModified: updatedAt,
        mainEntityOfPage: o.canonical || undefined
    };
}

module.exports = {
    BRAND,
    getSiteOrigin,
    absoluteUrl,
    recipeCanonicalUrl,
    truncateMeta,
    organizationJsonLd,
    websiteJsonLd,
    recipeJsonLd
};

