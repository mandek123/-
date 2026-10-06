// 만득월드 · show pet sprites with a transparent background.
// PET_DATABASE keeps its original ./images/*.gif paths; the page swaps each <img> to the
// pre-cleaned animated WebP in ./images-clean/ and falls back to the original if one is missing.
(function () {
    var PET = /(^|\/)images(2)?\/([^\/?#]+)\.gif(\?.*)?$/i;
    var missing = new Set();

    function cleanUrl(src) {
        var m = PET.exec(src);
        if (!m) return null;
        return src.slice(0, m.index) + (m[1] || '') + 'images-clean/' + (m[2] ? '2-' : '') + m[3] + '.webp';
    }
    function swap(img) {
        if (img.dataset.petClean) return;
        var src = img.getAttribute('src') || '';
        var clean = cleanUrl(src);
        if (!clean || missing.has(clean)) return;
        img.dataset.petClean = '1';
        img.addEventListener('error', function onErr() {
            img.removeEventListener('error', onErr);
            missing.add(clean);
            img.src = src;                       // no cleaned copy: keep the original
        });
        img.src = clean;
    }
    function scan(root) {
        if (root.tagName === 'IMG') swap(root);
        if (root.querySelectorAll) root.querySelectorAll('img').forEach(swap);
    }

    scan(document.body);
    new MutationObserver(function (list) {
        list.forEach(function (m) {
            if (m.type === 'attributes') {
                if (m.target.dataset.petClean && cleanUrl(m.target.getAttribute('src') || '')) delete m.target.dataset.petClean;
                swap(m.target);
            } else {
                m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
            }
        });
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    // canvas games load sprites through Image(); give them the cleaned files too
    window.MandukPetClean = cleanUrl;
})();
