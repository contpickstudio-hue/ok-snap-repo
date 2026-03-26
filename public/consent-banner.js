/**
 * Cookie consent UI. AdSense loading lives in ad-consent-loader.js (OkSnapConsent.bootstrapAds).
 * Requires: consent-store.js → ad-consent-loader.js → this file.
 */
(function () {
    var W = typeof window !== 'undefined' ? window : globalThis;
    var C = W.OkSnapConsent;
    if (!C) {
        console.warn('[OkSnapConsentUI] OkSnapConsent missing; load consent-store.js first');
        return;
    }

    function existingAdsenseScript() {
        return document.querySelector('script[data-oksnap-adsense]');
    }

    var bannerEl = null;
    var modalOverlay = null;

    function removeBanner() {
        if (bannerEl && bannerEl.parentNode) {
            bannerEl.parentNode.removeChild(bannerEl);
        }
        bannerEl = null;
    }

    function closeModal() {
        if (modalOverlay && modalOverlay.parentNode) {
            modalOverlay.parentNode.removeChild(modalOverlay);
        }
        modalOverlay = null;
        document.body.classList.remove('oksnap-consent-modal-open');
    }

    function openPreferencesModal() {
        closeModal();
        var c = C.get() || {
            analytics: false,
            advertising: false,
            personalizedAds: false
        };
        var a = !!c.analytics;
        var ad = !!c.advertising;
        var p = !!c.personalizedAds;

        var overlay = document.createElement('div');
        overlay.className = 'oksnap-consent-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'oksnap-consent-modal-title');

        overlay.innerHTML =
            '<div class="oksnap-consent-modal">' +
            '<h2 id="oksnap-consent-modal-title">Cookie preferences</h2>' +
            '<p class="oksnap-consent-modal__intro">Choose what we store or load. Essential cookies keep the app working and remember this choice.</p>' +
            '<div class="oksnap-consent-toggle-row">' +
            '<div class="oksnap-consent-toggle-row__label"><strong>Essential</strong><span>Required for login, preferences, and this consent record.</span></div>' +
            '<span style="font-size:0.75rem;font-weight:600;color:var(--primary,#7a9163);white-space:nowrap;">Always on</span>' +
            '</div>' +
            '<div class="oksnap-consent-toggle-row">' +
            '<div class="oksnap-consent-toggle-row__label"><strong>Analytics</strong><span>Optional. Helps us understand usage so we can improve the app.</span></div>' +
            '<button type="button" class="oksnap-consent-switch" data-oksnap-toggle="analytics" aria-checked="' +
            (a ? 'true' : 'false') +
            '" aria-label="Analytics"></button>' +
            '</div>' +
            '<div class="oksnap-consent-toggle-row">' +
            '<div class="oksnap-consent-toggle-row__label"><strong>Advertising</strong><span>Optional. Allows Google AdSense and similar tags to show ads.</span></div>' +
            '<button type="button" class="oksnap-consent-switch" data-oksnap-toggle="advertising" aria-checked="' +
            (ad ? 'true' : 'false') +
            '" aria-label="Advertising"></button>' +
            '</div>' +
            '<div class="oksnap-consent-toggle-row">' +
            '<div class="oksnap-consent-toggle-row__label"><strong>Personalized ads</strong><span>Uses extra signals for more relevant ads. Only if advertising is on.</span></div>' +
            '<button type="button" class="oksnap-consent-switch" data-oksnap-toggle="personalized" aria-checked="' +
            (p ? 'true' : 'false') +
            '" aria-label="Personalized ads"' +
            (!ad ? ' disabled' : '') +
            '></button>' +
            '</div>' +
            '<div class="oksnap-consent-modal__footer">' +
            '<button type="button" class="oksnap-consent-btn oksnap-consent-btn--ghost" data-oksnap-cancel>Cancel</button>' +
            '<button type="button" class="oksnap-consent-btn oksnap-consent-btn--primary" data-oksnap-save>Save choices</button>' +
            '</div></div>';

        overlay.addEventListener('click', function (ev) {
            if (ev.target === overlay) closeModal();
        });

        function syncPersonalDisabled() {
            var adBtn = overlay.querySelector('[data-oksnap-toggle="advertising"]');
            var pBtn = overlay.querySelector('[data-oksnap-toggle="personalized"]');
            if (!pBtn) return;
            var adOn = adBtn && adBtn.getAttribute('aria-checked') === 'true';
            pBtn.disabled = !adOn;
            if (!adOn) {
                pBtn.setAttribute('aria-checked', 'false');
            }
        }

        overlay.querySelectorAll('.oksnap-consent-switch[data-oksnap-toggle]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                var on = btn.getAttribute('aria-checked') !== 'true';
                btn.setAttribute('aria-checked', on ? 'true' : 'false');
                if (btn.getAttribute('data-oksnap-toggle') === 'advertising') {
                    syncPersonalDisabled();
                }
            });
        });

        syncPersonalDisabled();

        overlay.querySelector('[data-oksnap-cancel]').addEventListener('click', closeModal);

        overlay.querySelector('[data-oksnap-save]').addEventListener('click', function () {
            var analytics = overlay.querySelector('[data-oksnap-toggle="analytics"]').getAttribute('aria-checked') === 'true';
            var advertising = overlay.querySelector('[data-oksnap-toggle="advertising"]').getAttribute('aria-checked') === 'true';
            var personalized =
                advertising &&
                overlay.querySelector('[data-oksnap-toggle="personalized"]').getAttribute('aria-checked') === 'true';
            var hadScript = !!existingAdsenseScript();
            var before = C.get();
            C.savePreferences({
                analytics: analytics,
                advertising: advertising,
                personalizedAds: personalized
            });
            closeModal();
            removeBanner();
            if (
                hadScript &&
                before &&
                (before.advertising !== advertising || before.personalizedAds !== personalized)
            ) {
                window.location.reload();
                return;
            }
            C.bootstrapAds();
        });

        document.body.appendChild(overlay);
        modalOverlay = overlay;
        document.body.classList.add('oksnap-consent-modal-open');
    }

    function showBanner() {
        if (bannerEl || C.hasAnswered()) return;
        var wrap = document.createElement('div');
        wrap.className = 'oksnap-consent-banner';
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', 'Cookie consent');
        wrap.innerHTML =
            '<div class="oksnap-consent-banner__inner">' +
            '<p class="oksnap-consent-banner__title">Cookies and ads</p>' +
            '<p class="oksnap-consent-banner__text">We use essential cookies to run the app and remember your settings. With your permission we may use analytics cookies and third-party advertising technologies (such as Google AdSense). You can change this anytime.</p>' +
            '<div class="oksnap-consent-banner__actions">' +
            '<button type="button" class="oksnap-consent-btn oksnap-consent-btn--primary" data-oksnap-accept>Accept</button>' +
            '<button type="button" class="oksnap-consent-btn oksnap-consent-btn--ghost" data-oksnap-reject>Reject non-essential</button>' +
            '<button type="button" class="oksnap-consent-btn oksnap-consent-btn--link" data-oksnap-manage>Manage preferences</button>' +
            '</div></div>';

        wrap.querySelector('[data-oksnap-accept]').addEventListener('click', function () {
            C.acceptAll();
            removeBanner();
            C.bootstrapAds();
        });
        wrap.querySelector('[data-oksnap-reject]').addEventListener('click', function () {
            C.rejectNonEssential();
            removeBanner();
            C.bootstrapAds();
        });
        wrap.querySelector('[data-oksnap-manage]').addEventListener('click', function () {
            openPreferencesModal();
        });

        document.body.appendChild(wrap);
        bannerEl = wrap;
    }

    function wireOpenButtons() {
        document.querySelectorAll('.oksnap-consent-open, button.oksnap-consent-open').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.preventDefault();
                openPreferencesModal();
            });
        });
    }

    W.OkSnapConsentUI = {
        openPreferences: openPreferencesModal,
        showBanner: showBanner
    };

    document.addEventListener('DOMContentLoaded', function () {
        wireOpenButtons();
        var consentPage =
            document.body && document.body.getAttribute('data-oksnap-consent-banner') === '1';
        if (consentPage && !C.hasAnswered()) {
            showBanner();
        }
        if (consentPage) {
            C.bootstrapAds();
        }
    });
})();
