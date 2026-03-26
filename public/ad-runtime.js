/**
 * Ok-Snap AdSense slot config and push helpers. The AdSense script is injected only via ad-consent-loader.js
 * after advertising consent (with &npa=1 when personalized ads are off).
 *
 * PUBLISHER ID: set below. SLOT IDs: replace XXXXXXXXXX with your AdSense unit IDs when going live.
 */
(function () {
    var G = typeof window !== 'undefined' ? window : globalThis;

    function consentAllowsAds() {
        var C = G.OkSnapConsent;
        if (!C || typeof C.allowsAdvertising !== 'function') {
            return false;
        }
        return C.allowsAdvertising();
    }

    G.OK_SNAP_ADS = G.OK_SNAP_ADS || {
        enabled: false,
        /** Google AdSense publisher ID (ca-pub-…). Also read by OkSnapAdLoader in ad-consent-loader.js */
        publisherId: 'ca-pub-9493449427784119',
        /** In-page display ads only; recipe scroll interstitial is disabled in the app. */
        browseFeedInterval: 4,
        showResultMidSlot: true,
        /** Show in-article mid slot only when stripped HTML body length >= this (optional second ad). */
        articleMidMinContentLength: 900,
        /**
         * Per-slot on/off (false = hidden, no push). Omit key or true = on.
         * Replace XXXXXXXXXX in `slots` with real AdSense unit IDs when enabling OK_SNAP_ADS.enabled.
         */
        slotToggles: {
            discoverBelowHero: true,
            discoverFooter: false,
            resultAfterNutrition: true,
            resultMidContent: true,
            browseFeed: true,
            articleIntro: true,
            articleMid: true,
            historyPage: true,
            favoritesPage: true
        },
        slots: {
            discoverBelowHero: 'XXXXXXXXXX',
            discoverFooter: 'XXXXXXXXXX',
            resultAfterNutrition: 'XXXXXXXXXX',
            resultMidContent: 'XXXXXXXXXX',
            browseFeed: 'XXXXXXXXXX',
            articleIntro: 'XXXXXXXXXX',
            articleMid: 'XXXXXXXXXX',
            historyPage: 'XXXXXXXXXX',
            favoritesPage: 'XXXXXXXXXX'
        }
    };

    function isSlotEnabled(slotKey) {
        var cfg = G.OK_SNAP_ADS;
        var t = cfg.slotToggles || {};
        return t[slotKey] !== false;
    }

    function applyDisabledSlotClass(root) {
        (root || document).querySelectorAll('[data-oksnap-ad-slot]').forEach(function (el) {
            var key = el.getAttribute('data-oksnap-ad-slot');
            if (!key) return;
            if (!isSlotEnabled(key)) {
                el.classList.add('oksnap-ad-slot--off');
            } else {
                el.classList.remove('oksnap-ad-slot--off');
            }
        });
    }

    function applySlotAttributes(root) {
        var rootEl = root || document;
        var cfg = G.OK_SNAP_ADS;
        rootEl.querySelectorAll('[data-oksnap-ad-slot]').forEach(function (wrap) {
            var key = wrap.getAttribute('data-oksnap-ad-slot');
            if (!key || !isSlotEnabled(key)) return;
            var slotId = cfg.slots && cfg.slots[key];
            var ins = wrap.querySelector('ins.adsbygoogle');
            if (!ins || !cfg.publisherId) return;
            ins.setAttribute('data-ad-client', cfg.publisherId);
            if (slotId) ins.setAttribute('data-ad-slot', slotId);
            ins.setAttribute('data-ad-format', ins.getAttribute('data-ad-format') || 'auto');
            if (!ins.hasAttribute('data-full-width-responsive')) {
                ins.setAttribute('data-full-width-responsive', 'true');
            }
        });
    }

    function isElementVisible(el) {
        if (!el) return false;
        if (el.style && el.style.display === 'none') return false;
        if (el.hidden) return false;
        var st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    }

    /** Reserved layout when ads are configured but user declined advertising — avoids hard collapse/CLS vs real ads. */
    function setSlotsPlaceholderMode(root, on) {
        (root || document).querySelectorAll('[data-oksnap-ad-slot]').forEach(function (el) {
            var key = el.getAttribute('data-oksnap-ad-slot');
            if (key && !isSlotEnabled(key)) return;
            if (on) {
                el.classList.add('oksnap-ad-slot--blocked');
            } else {
                el.classList.remove('oksnap-ad-slot--blocked');
            }
        });
    }

    /**
     * Push AdSense for each visible ins that has not been pushed yet.
     */
    function pushAdsIn(root) {
        if (!G.OK_SNAP_ADS.enabled) return;
        var scope = root || document;
        var list = scope.querySelectorAll('ins.adsbygoogle');
        list.forEach(function (ins) {
            if (ins.getAttribute('data-oksnap-pushed') === '1') return;
            var wrap = ins.closest('[data-oksnap-ad-slot]');
            if (wrap) {
                var sk = wrap.getAttribute('data-oksnap-ad-slot');
                if (sk && !isSlotEnabled(sk)) return;
            }
            if (wrap && !isElementVisible(wrap)) return;
            if (!isElementVisible(ins)) return;
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                ins.setAttribute('data-oksnap-pushed', '1');
            } catch (e) {
                console.warn('[OkSnapAds] push failed', e);
            }
        });
    }

    G.initOkSnapAds = function (root) {
        var scope = root || document;
        var cfg = G.OK_SNAP_ADS;
        applyDisabledSlotClass(scope);
        var canRun = cfg.enabled && consentAllowsAds();
        setSlotsPlaceholderMode(scope, !!(cfg.enabled && !consentAllowsAds()));
        if (!canRun) {
            return;
        }
        setSlotsPlaceholderMode(scope, false);
        applySlotAttributes(scope);
        pushAdsIn(scope);
    };

    /** Call after toggling slot visibility or injecting new ad units (e.g. SPA route or modal). */
    G.refreshOkSnapAds = function (root) {
        var scope = root || document;
        var cfg = G.OK_SNAP_ADS;
        applyDisabledSlotClass(scope);
        var canRun = cfg.enabled && consentAllowsAds();
        setSlotsPlaceholderMode(scope, !!(cfg.enabled && !consentAllowsAds()));
        if (!canRun) {
            return;
        }
        setSlotsPlaceholderMode(scope, false);
        applySlotAttributes(scope);
        pushAdsIn(scope);
    };

    G.okSnapAdsEffectiveEnabled = function () {
        return !!(G.OK_SNAP_ADS.enabled && consentAllowsAds());
    };

    G.okSnapAdSlotEnabled = isSlotEnabled;
})();
