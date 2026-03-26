/**
 * Ok-Snap cookie / consent storage (localStorage) and query helpers.
 */
(function () {
    var G = typeof window !== 'undefined' ? window : globalThis;
    var KEY = 'oksnap_cookie_consent_v1';
    var VERSION = 1;

    function safeParse(raw) {
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function get() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return null;
            var o = safeParse(raw);
            if (!o || o.version !== VERSION) return null;
            return o;
        } catch (e) {
            return null;
        }
    }

    function save(record) {
        try {
            localStorage.setItem(KEY, JSON.stringify(record));
        } catch (e) {
            console.warn('[OkSnapConsent] save failed', e);
        }
    }

    function hasAnswered() {
        return get() !== null;
    }

    function allowsAnalytics() {
        var c = get();
        return !!(c && c.analytics === true);
    }

    function allowsAdvertising() {
        var c = get();
        return !!(c && c.advertising === true);
    }

    function allowsPersonalizedAds() {
        var c = get();
        return !!(c && c.advertising === true && c.personalizedAds === true);
    }

    function acceptAll() {
        save({
            version: VERSION,
            decidedAt: new Date().toISOString(),
            analytics: true,
            advertising: true,
            personalizedAds: true
        });
    }

    function rejectNonEssential() {
        save({
            version: VERSION,
            decidedAt: new Date().toISOString(),
            analytics: false,
            advertising: false,
            personalizedAds: false
        });
    }

    function savePreferences(opts) {
        var c = get() || {
            version: VERSION,
            decidedAt: new Date().toISOString(),
            analytics: false,
            advertising: false,
            personalizedAds: false
        };
        if (opts.analytics !== undefined) c.analytics = !!opts.analytics;
        if (opts.advertising !== undefined) c.advertising = !!opts.advertising;
        if (opts.personalizedAds !== undefined) c.personalizedAds = !!opts.personalizedAds;
        if (!c.advertising) c.personalizedAds = false;
        c.decidedAt = new Date().toISOString();
        c.version = VERSION;
        save(c);
    }

    G.OkSnapConsent = {
        VERSION: VERSION,
        get: get,
        hasAnswered: hasAnswered,
        allowsAnalytics: allowsAnalytics,
        allowsAdvertising: allowsAdvertising,
        allowsPersonalizedAds: allowsPersonalizedAds,
        acceptAll: acceptAll,
        rejectNonEssential: rejectNonEssential,
        savePreferences: savePreferences
    };
})();
