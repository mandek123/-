// 만득이 키우기 · stage backgrounds (초원 → 화산 → 동굴), hit feedback and skill moments.
// Reads idGame and wraps the original feedback calls; combat math is untouched.
(function () {
    if (typeof idGame === 'undefined' || typeof showDmgText !== 'function') return;
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ZONES = [['meadow', '초원'], ['volcano', '화산 지대'], ['cave', '수정 동굴']];
    function field() { return document.getElementById('idle-field'); }

    function fx(cls, x, y, html, life) {
        var f = field(); if (!f) return null;
        var el = document.createElement('div');
        el.className = 'fx ' + cls;
        el.style.left = x + 'px'; el.style.top = y + 'px';
        if (html) el.innerHTML = html;
        f.appendChild(el);
        setTimeout(function () { el.remove(); }, life || 600);
        return el;
    }
    function shake() {
        return;   // screen shake removed on request (too dizzy); kept as a no-op so callers stay simple
        var f = field(); if (!f || REDUCED) return;
        f.style.setProperty('--shake', power + 'px');
        f.classList.remove('is-shaking'); void f.offsetWidth; f.classList.add('is-shaking');
    }

    /* ---------- stage zones ---------- */
    var lastStage = null;
    function zoneFor(stage) { return ZONES[Math.floor((Math.max(1, stage) - 1) / 10) % ZONES.length]; }
    function syncZone() {
        var f = field(); if (!f) return;
        var z = zoneFor(idGame.stage || 1);
        if (f.dataset.zone !== z[0]) f.dataset.zone = z[0];
        if (idGame.started && lastStage !== null && idGame.stage !== lastStage) {
            var card = fx('fx-stage', 0, 0, '<b>STAGE ' + idGame.stage + '</b><span>' + z[1] + '</span>', 1800);
            if (card) { card.style.left = ''; card.style.top = ''; }
        }
        lastStage = idGame.stage;
    }
    setInterval(syncZone, 300);
    syncZone();

    /* ---------- hits, crits, heals ---------- */
    var orig = showDmgText;
    showDmgText = function (text, x, y, className) {
        var cx = x + 35, cy = y + 30;
        if (className === 'dmg-crit') {
            text = String(text).replace('💥', '');
            fx('fx-burst fx-burst--crit', cx, cy, '', 520);
            fx('fx-slash', cx, cy, '', 420);
            fx('fx-word', cx, cy - 46, 'CRITICAL!', 800);
            shake(7);
        } else if (className === 'dmg-enemy' && typeof text === 'number') {
            fx('fx-burst', cx + (Math.random() - 0.5) * 16, cy + (Math.random() - 0.5) * 16, '', 380);
        } else if (className === 'dmg-heal') {
            fx('fx-heal', cx, cy + 10, '<i></i><i></i><i></i><i></i>', 900);
        } else if (className === 'dmg-ally') {
            var f = field(); if (f) { f.classList.remove('is-hurt'); void f.offsetWidth; f.classList.add('is-hurt'); }
            fx('fx-burst fx-burst--red', cx, cy, '', 380);
            shake(4);
        } else if (className === 'dmg-dodge') {
            fx('fx-dodge', cx, cy, '<i></i><i></i><i></i>', 450);
        }
        return orig.call(this, text, x, y, className);
    };

    /* ---------- boss arrival and defeated monsters ---------- */
    var f0 = field();
    if (f0) {
        new MutationObserver(function (list) {
            list.forEach(function (m) {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType === 1 && n.classList.contains('boss-entity')) {
                        var b = fx('fx-boss', 0, 0, '<img src="./img/game/boss-banner.webp" alt="BOSS">', 2200);
                        if (b) { b.style.left = ''; b.style.top = ''; }
                        shake(10);
                    }
                });
                m.removedNodes.forEach(function (n) {
                    if (n.nodeType !== 1 || !n.classList.contains('idle-entity') || n.classList.contains('facing-right')) return;
                    var x = parseFloat(n.style.left) + 35, y = parseFloat(n.style.top) + 40;
                    if (!isNaN(x)) fx('fx-poof', x, y, '<i></i><i></i><i></i><i></i><i></i><i></i>', 600);
                });
            });
        }).observe(f0, { childList: true });
    }

    /* ---------- attack lunges leave a swing trail ---------- */
    if (typeof triggerAnim === 'function') {
        var origAnim = triggerAnim;
        triggerAnim = function (el, animClass) {
            if (el && (animClass === 'anim-atk-right' || animClass === 'anim-atk-left')) {
                var x = parseFloat(el.style.left) + (animClass === 'anim-atk-right' ? 70 : 0), y = parseFloat(el.style.top) + 30;
                var s = fx('fx-swing' + (animClass === 'anim-atk-left' ? ' is-left' : ''), x, y, '', 260);
            }
            return origAnim.apply(this, arguments);
        };
    }

    /* ---------- buffs light up the whole field ---------- */
    if (typeof activateBuff === 'function') {
        var origBuff = activateBuff;
        activateBuff = function (type) {
            var before = idGame.diamond;
            var r = origBuff.apply(this, arguments);
            if (idGame.diamond < before) {
                var label = type === 'atkBoost' ? '공격력 UP!' : type === 'defBoost' ? '방어 UP!' : '스톤 UP!';
                var b = fx('fx-buff fx-buff--' + type, 0, 0, '<b>' + label + '</b>', 1400);
                if (b) { b.style.left = ''; b.style.top = ''; }
            }
            return r;
        };
    }
})();
