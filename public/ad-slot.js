/**
 * Reusable ad unit markup (vanilla “component”). Pair with ad-runtime.js slot keys + OK_SNAP_ADS.slots / slotToggles.
 *
 * Variants (CSS in ad-slots.css):
 *   — default: in-flow banner
 *   — feed: native-style strip between browse cards
 *   — article: in-modal article padding
 *   — compact: history/favorites footer strip (smaller min-height)
 */
(function () {
    var W = typeof window !== 'undefined' ? window : globalThis;

    function escAttr(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    /**
     * @param {string} slotKey - must match OK_SNAP_ADS.slots key and data-oksnap-ad-slot
     * @param {{ variant?: string, className?: string, id?: string }} opts
     */
    function buildHtml(slotKey, opts) {
        opts = opts || {};
        var variant = opts.variant || '';
        var extra = opts.className ? ' ' + opts.className : '';
        var idAttr = opts.id ? ' id="' + escAttr(opts.id) + '"' : '';
        var mod = variant ? ' oksnap-ad-slot--' + variant : '';
        var k = escAttr(slotKey);
        return (
            '<aside class="oksnap-ad-slot' +
            mod +
            extra +
            '"' +
            idAttr +
            ' role="complementary" data-oksnap-ad-slot="' +
            k +
            '" aria-label="Advertisement">' +
            '<p class="oksnap-ad-slot__label">Advertisement</p>' +
            '<div class="oksnap-ad-slot__frame">' +
            '<ins class="adsbygoogle" style="display:block" data-ad-format="auto" data-full-width-responsive="true"></ins>' +
            '</div></aside>'
        );
    }

    function createElement(slotKey, opts) {
        var wrap = document.createElement('aside');
        opts = opts || {};
        var variant = opts.variant || '';
        wrap.className = 'oksnap-ad-slot' + (variant ? ' oksnap-ad-slot--' + variant : '') + (opts.className ? ' ' + opts.className : '');
        if (opts.id) wrap.id = opts.id;
        wrap.setAttribute('role', 'complementary');
        wrap.setAttribute('data-oksnap-ad-slot', slotKey);
        wrap.setAttribute('aria-label', 'Advertisement');

        var label = document.createElement('p');
        label.className = 'oksnap-ad-slot__label';
        label.textContent = 'Advertisement';

        var frame = document.createElement('div');
        frame.className = 'oksnap-ad-slot__frame';
        var ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');

        frame.appendChild(ins);
        wrap.appendChild(label);
        wrap.appendChild(frame);
        return wrap;
    }

    W.OkSnapAdSlot = {
        html: buildHtml,
        createElement: createElement
    };
})();
