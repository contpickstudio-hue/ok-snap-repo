/**
 * Consent-aware Google AdSense loader — single place for script URL, NPA vs personalized, and deduped injection.
 *
 * LOAD ORDER: consent-store.js → ad-runtime.js (optional but recommended) → ad-consent-loader.js → consent-banner.js
 *
 * PUBLISHER ID: Prefer window.OK_SNAP_ADS.publisherId (see ad-runtime.js). Fallback below is only if ad-runtime is absent.
 * AD SLOT IDs: Configure in ad-runtime.js under OK_SNAP_ADS.slots + slotToggles (discoverBelowHero, articleIntro, historyPage, …).
 *
 * SPA / ROUTES: After injecting new ad markup or showing a view, call OkSnapConsent.bootstrapAds() or
 * window.refreshOkSnapAds(container) so new ins elements get pushed once the script is ready (idempotent).
 */
(function () {
    var W = typeof window !== 'undefined' ? window : globalThis;
    var C = W.OkSnapConsent;
    if (!C) {
        console.warn('[OkSnapAdLoader] OkSnapConsent missing; load consent-store.js first');
        return;
    }

    /** @see ad-runtime.js OK_SNAP_ADS.publisherId — replace fallback when not using ad-runtime */
    function getPublisherId() {
        var cfg = W.OK_SNAP_ADS || {};
        return cfg.publisherId || 'ca-pub-9493449427784119';
    }

    function existingAdsenseScript() {
        return document.querySelector('script[data-oksnap-adsense]');
    }

    /**
     * Loads adsbygoogle.js once. Uses &npa=1 when personalized ads are not allowed (limited ads / non-personalized).
     * If the script is already present with a different NPA flag, triggers a full reload (AdSense does not support hot-swapping).
     */
    function ensureAdsenseScript(useNpa) {
        return new Promise(function (resolve, reject) {
            var existing = existingAdsenseScript();
            if (existing && W.adsbygoogle) {
                var wasNpa = existing.getAttribute('data-oksnap-npa') === '1';
                if (wasNpa === !!useNpa) {
                    resolve();
                    return;
                }
                window.location.reload();
                return;
            }
            if (W.__oksnapAdsScriptLoading) {
                W.__oksnapAdsScriptLoading.then(resolve).catch(reject);
                return;
            }
            var url =
                'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
                encodeURIComponent(getPublisherId());
            if (useNpa) url += '&npa=1';
            var s = document.createElement('script');
            s.async = true;
            s.src = url;
            s.crossOrigin = 'anonymous';
            s.setAttribute('data-oksnap-adsense', '1');
            s.setAttribute('data-oksnap-npa', useNpa ? '1' : '0');
            W.__oksnapAdsScriptLoading = new Promise(function (res, rej) {
                s.onload = function () {
                    W.__oksnapAdsScriptLoading = null;
                    res();
                };
                s.onerror = function () {
                    W.__oksnapAdsScriptLoading = null;
                    rej(new Error('AdSense script failed to load'));
                };
                document.head.appendChild(s);
            });
            W.__oksnapAdsScriptLoading.then(resolve).catch(reject);
        });
    }

    /** Runs page-specific hooks after the AdSense script is ready (safe if functions are missing). */
    function runPageAdHooks() {
        if (typeof W.initOkSnapAds === 'function') {
            W.initOkSnapAds(document);
        }
        if (typeof W.syncDiscoverFooterAd === 'function') {
            W.syncDiscoverFooterAd();
        }
        if (typeof W.syncDiscoverBelowHeroAd === 'function') {
            W.syncDiscoverBelowHeroAd();
        }
        if (typeof W.syncHistoryPageAd === 'function') {
            W.syncHistoryPageAd();
        }
        if (typeof W.syncFavoritesPageAd === 'function') {
            W.syncFavoritesPageAd();
        }
        if (
            typeof W.updateResultAdSlots === 'function' &&
            typeof W.currentDishData !== 'undefined' &&
            W.currentDishData
        ) {
            try {
                W.updateResultAdSlots(W.currentDishData);
            } catch (e) {
                console.warn('[OkSnapAdLoader] updateResultAdSlots', e);
            }
        }
        var container = document.getElementById('browseRecipesContainer');
        if (container && typeof W.refreshOkSnapAds === 'function') {
            W.refreshOkSnapAds(container);
        }
    }

    function bootstrapAds() {
        var cfg = W.OK_SNAP_ADS || { enabled: false };
        if (!cfg.enabled) {
            if (typeof W.initOkSnapAds === 'function') {
                W.initOkSnapAds(document);
            }
            return;
        }
        if (!C.allowsAdvertising()) {
            if (typeof W.initOkSnapAds === 'function') {
                W.initOkSnapAds(document);
            }
            if (typeof W.syncDiscoverFooterAd === 'function') {
                W.syncDiscoverFooterAd();
            }
            return;
        }
        var npa = !C.allowsPersonalizedAds();
        ensureAdsenseScript(npa)
            .then(runPageAdHooks)
            .catch(function (err) {
                console.warn('[OkSnapAdLoader] AdSense load error', err);
                if (typeof W.initOkSnapAds === 'function') {
                    W.initOkSnapAds(document);
                }
            });
    }

    C.bootstrapAds = bootstrapAds;

    W.OkSnapAdLoader = {
        ensureAdsenseScript: ensureAdsenseScript,
        runPageAdHooks: runPageAdHooks,
        getPublisherId: getPublisherId,
        wantsNonPersonalizedAds: function () {
            return C.allowsAdvertising() && !C.allowsPersonalizedAds();
        }
    };
})();
