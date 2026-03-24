/**
 * Ok-Snap AdSense helpers: conditional slots, single push per ins, config in one place.
 * Set OK_SNAP_ADS.enabled = true and real slot IDs when ready for production.
 */
(function () {
    var G = typeof window !== 'undefined' ? window : globalThis;

    G.OK_SNAP_ADS = G.OK_SNAP_ADS || {
        enabled: false,
        publisherId: 'ca-pub-9493449427784119',
        /** In-page display ads only; recipe scroll interstitial is disabled in the app. */
        browseFeedInterval: 4,
        showResultMidSlot: true,
        slots: {
            discoverFooter: 'XXXXXXXXXX',
            resultAfterNutrition: 'XXXXXXXXXX',
            resultMidContent: 'XXXXXXXXXX',
            browseFeed: 'XXXXXXXXXX'
        }
    };

    function applySlotAttributes(root) {
        var rootEl = root || document;
        var cfg = G.OK_SNAP_ADS;
        rootEl.querySelectorAll('[data-oksnap-ad-slot]').forEach(function (wrap) {
            var key = wrap.getAttribute('data-oksnap-ad-slot');
            if (!key) return;
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

    function hideAllSlots(root) {
        (root || document).querySelectorAll('[data-oksnap-ad-slot]').forEach(function (el) {
            el.style.display = 'none';
            el.setAttribute('aria-hidden', 'true');
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
        applySlotAttributes(root);
        if (!G.OK_SNAP_ADS.enabled) {
            hideAllSlots(root || document);
            return;
        }
        pushAdsIn(root || document);
    };

    /** Call after toggling slot visibility or injecting new ad units. */
    G.refreshOkSnapAds = function (root) {
        applySlotAttributes(root);
        if (!G.OK_SNAP_ADS.enabled) return;
        pushAdsIn(root || document);
    };
})();
