// 만득서바이벌 · graphics, game feel, sound and touch controls.
// Rules, numbers and ranking stay with the original game code; this file only
// replaces how a frame is drawn and adds feedback around the same events.
(function () {
    if (typeof sv_draw !== 'function' || typeof sv_ctx === 'undefined') return;

    var INK = '#1d1a12';
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ================= sprites: drop the white box around pet GIFs ================= */
    var spriteCache = new Map();
    function cleanSprite(img) {
        if (!img || !img.complete || !img.naturalWidth) return null;
        var hit = spriteCache.get(img.src);
        if (hit !== undefined) return hit;
        var w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
        c.width = w; c.height = h;
        var x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        try {
            var d = x.getImageData(0, 0, w, h), p = d.data, seen = new Uint8Array(w * h), stack = [];
            var isBg = function (i) {
                var r = p[i * 4], g = p[i * 4 + 1], b = p[i * 4 + 2], a = p[i * 4 + 3];
                if (a < 20) return true;
                var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
                return mn > 226 && mx - mn < 28;
            };
            for (var i = 0; i < w; i++) { stack.push(i, (h - 1) * w + i); }
            for (var j = 0; j < h; j++) { stack.push(j * w, j * w + w - 1); }
            while (stack.length) {
                var k = stack.pop();
                if (seen[k]) continue;
                seen[k] = 1;
                if (!isBg(k)) continue;
                p[k * 4 + 3] = 0;
                var kx = k % w, ky = (k / w) | 0;
                if (kx > 0) stack.push(k - 1);
                if (kx < w - 1) stack.push(k + 1);
                if (ky > 0) stack.push(k - w);
                if (ky < h - 1) stack.push(k + w);
            }
            x.putImageData(d, 0, 0);
        } catch (e) { /* cross-origin or file:// - keep the raw image */ }
        spriteCache.set(img.src, c);
        return c;
    }
    // prefer the pre-cleaned sprite files (no white halo); fall back to cleaning at runtime
    var preClean = new Map();
    function bestSource(img) {
        if (!img || !window.MandukPetClean) return img;
        var url = window.MandukPetClean(img.getAttribute ? (img.getAttribute('src') || img.src) : img.src);
        if (!url) return img;
        var c = preClean.get(url);
        if (!c) { c = new Image(); c.src = url; c.onerror = function () { c.failed = true; }; preClean.set(url, c); }
        return (c.complete && c.naturalWidth && !c.failed) ? c : img;
    }
    function drawSprite(src, cx, cy, box, flip, sy) {
        var s = cleanSprite(bestSource(src));
        if (!s) return false;
        var ratio = s.width / s.height, w = ratio >= 1 ? box : box * ratio, h = ratio >= 1 ? box / ratio : box;
        sv_ctx.save();
        sv_ctx.translate(cx, cy + h / 2);
        sv_ctx.scale(flip ? -1 : 1, sy || 1);
        sv_ctx.drawImage(s, -w / 2, -h, w, h);
        sv_ctx.restore();
        return { w: w, h: h, canvas: s };
    }

    /* ================= ground: a stone-age meadow ================= */
    var groundTile = (function () {
        var S = 512, c = document.createElement('canvas'); c.width = c.height = S;
        var g = c.getContext('2d'), rnd = mulberry(7);
        g.fillStyle = '#8fd15c'; g.fillRect(0, 0, S, S);
        for (var i = 0; i < 60; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(112,184,70,.28)' : 'rgba(176,228,118,.26)';
            blob(g, rnd() * S, rnd() * S, 14 + rnd() * 60, S);
        }
        g.strokeStyle = 'rgba(64,128,40,.55)'; g.lineWidth = 2; g.lineCap = 'round';
        for (var t = 0; t < 150; t++) {
            var x = rnd() * S, y = rnd() * S;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x + 3, y); g.lineTo(x + 4, y - 7); g.stroke();
        }
        return c;
    })();
    var groundPattern = sv_ctx.createPattern(groundTile, 'repeat');

    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function blob(g, x, y, r, S) {
        [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]].forEach(function (o) {
            g.beginPath(); g.ellipse(x + o[0], y + o[1], r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
        });
    }
    function hash(x, y) { var n = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

    var PROPS = ['rock', 'bush', 'flowers', 'bone', 'fern', 'rock2', 'grass'];
    var CELL = 220;
    function drawProps(l, t, r, b) {
        for (var cx = Math.floor(l / CELL); cx <= Math.floor(r / CELL); cx++) {
            for (var cy = Math.floor(t / CELL); cy <= Math.floor(b / CELL); cy++) {
                var h = hash(cx, cy);
                if (h > 0.62) continue;
                var x = cx * CELL + hash(cx + 9, cy) * CELL, y = cy * CELL + hash(cx, cy + 9) * CELL;
                prop(PROPS[Math.floor(hash(cx + 3, cy + 5) * PROPS.length)], x, y, 0.7 + hash(cx + 1, cy + 2) * 0.6);
            }
        }
    }
    function prop(type, x, y, s) {
        var g = sv_ctx;
        g.save(); g.translate(x, y); g.scale(s, s);
        g.lineWidth = 2.5; g.strokeStyle = INK; g.lineJoin = 'round';
        if (type === 'rock' || type === 'rock2') {
            g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(0, 10, 30, 8, 0, 0, 7); g.fill();
            g.fillStyle = type === 'rock' ? '#b8ad98' : '#a49a88';
            g.beginPath(); g.moveTo(-26, 10); g.quadraticCurveTo(-28, -12, -6, -18); g.quadraticCurveTo(20, -22, 26, 2); g.quadraticCurveTo(28, 12, 0, 12); g.closePath(); g.fill(); g.stroke();
            g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-8, -8, 9, 4, -0.4, 0, 7); g.fill();
        } else if (type === 'bush') {
            g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(0, 12, 34, 8, 0, 0, 7); g.fill();
            g.fillStyle = '#4f9e3a';
            [[-16, 0, 16], [14, -2, 17], [0, -12, 18]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.fill(); g.stroke(); });
            g.fillStyle = '#e8473b'; [[-10, -6], [8, -14], [16, 2]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], 3.5, 0, 7); g.fill(); });
        } else if (type === 'flowers') {
            ['#fff4a3', '#ffb3d1', '#ffffff'].forEach(function (col, i) {
                var fx = (i - 1) * 14, fy = (i % 2) * 8;
                g.fillStyle = col; for (var k = 0; k < 5; k++) { g.beginPath(); g.arc(fx + Math.cos(k * 1.256) * 4, fy + Math.sin(k * 1.256) * 4, 3.2, 0, 7); g.fill(); }
                g.fillStyle = '#ffc21a'; g.beginPath(); g.arc(fx, fy, 2.4, 0, 7); g.fill();
            });
        } else if (type === 'bone') {
            g.rotate(0.5); g.fillStyle = '#f6efdc';
            g.beginPath(); g.roundRect(-16, -3.5, 32, 7, 3); g.fill(); g.stroke();
            [[-16, -4], [-16, 4], [16, -4], [16, 4]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], 5, 0, 7); g.fill(); g.stroke(); });
            g.beginPath(); g.roundRect(-14, -3, 28, 6, 3); g.fill();
        } else if (type === 'fern') {
            g.strokeStyle = '#3f8a2e'; g.lineWidth = 3; g.lineCap = 'round';
            for (var f = -2; f <= 2; f++) { g.beginPath(); g.moveTo(0, 10); g.quadraticCurveTo(f * 8, -6, f * 14, -18 + Math.abs(f) * 4); g.stroke(); }
        } else {
            g.strokeStyle = '#5aa43c'; g.lineWidth = 3; g.lineCap = 'round';
            for (var q = -3; q <= 3; q++) { g.beginPath(); g.moveTo(q * 3, 8); g.lineTo(q * 5, -8 - (3 - Math.abs(q)) * 3); g.stroke(); }
        }
        g.restore();
    }

    /* ================= sound effects (synthesized) ================= */
    var sfxOn = true;
    try { sfxOn = localStorage.getItem('manduk_sfx') !== 'off'; } catch (e) {}
    var actx = null, sfxGain = null, lastPlay = {};
    function audio() {
        if (!actx) {
            var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
            actx = new AC(); sfxGain = actx.createGain(); sfxGain.gain.value = 0.22; sfxGain.connect(actx.destination);
        }
        if (actx.state === 'suspended') actx.resume();
        return actx;
    }
    function blip(type, f1, f2, dur, vol, delay) {
        var a = audio(); if (!a) return;
        var t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
    }
    function thud(vol) {
        var a = audio(); if (!a) return;
        var t = a.currentTime, len = a.sampleRate * 0.12, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        s.buffer = b; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t);
    }
    var SFX = {
        hit: function () { blip('square', 520, 260, 0.05, 0.08); },
        kill: function () { blip('triangle', 640, 1280, 0.09, 0.16); },
        gem: function () { blip('sine', 1320, 1760, 0.07, 0.12); },
        heal: function () { blip('sine', 660, 990, 0.12, 0.15); blip('sine', 990, 1320, 0.12, 0.12, 0.08); },
        hurt: function () { thud(0.5); blip('sawtooth', 180, 70, 0.18, 0.12); },
        level: function () { [523, 659, 784, 1047].forEach(function (f, i) { blip('square', f, f, 0.12, 0.1, i * 0.08); }); },
        boss: function () { blip('sawtooth', 110, 98, 0.7, 0.18); blip('sawtooth', 165, 147, 0.7, 0.12, 0.05); thud(0.6); },
        thump: function () { thud(0.45); }
    };
    function play(name, gap) {
        if (!sfxOn || sv_gameState !== 'playing') return;
        var now = performance.now();
        if (lastPlay[name] && now - lastPlay[name] < (gap || 0)) return;
        lastPlay[name] = now;
        SFX[name]();
    }

    /* ================= effects state ================= */
    var rings = [], banners = [], shake = 0, lastHitFlash = 0, lastExp = 0, lastLevel = 1, lastHp = 0, enemyId = 0;

    var origParticles = sv_createParticles;
    sv_createParticles = function (x, y, color, count) {
        if (color === '#fff' && count === 5) {        // the original's death puff
            rings.push({ x: x, y: y, r: 6, max: 46, life: 0.35, maxLife: 0.35, color: '#fff7e6' });
            play('kill', 45);
        } else if (color === '#888' && count === 8) { // stone impact
            rings.push({ x: x, y: y, r: 10, max: 140, life: 0.45, maxLife: 0.45, color: '#d9c8a3' });
            shake = Math.max(shake, 6); play('thump', 120);
        } else if (count <= 2) {
            play('hit', 55);
        }
        return origParticles.apply(this, arguments);
    };
    var origBoss = sv_spawnBoss;
    sv_spawnBoss = function () {
        var r = origBoss.apply(this, arguments);
        banners.push({ text: '보스 등장!', life: 2.2, maxLife: 2.2 });
        play('boss'); shake = Math.max(shake, 10);
        return r;
    };
    var origStart = sv_startGame;
    sv_startGame = function () {
        rings = []; banners = []; shake = 0; lastExp = 0; lastLevel = 1; lastHp = 100;
        audio();
        return origStart.apply(this, arguments);
    };

    function watchPlayer(dt) {
        if (!sv_player || sv_player.level === undefined) return;
        if (sv_hitFlashAlpha > lastHitFlash + 0.2) { shake = Math.max(shake, 9); play('hurt', 120); }
        lastHitFlash = sv_hitFlashAlpha;
        if (sv_player.level > lastLevel) { play('level'); rings.push({ x: sv_player.x, y: sv_player.y, r: 20, max: 180, life: 0.6, maxLife: 0.6, color: '#ffd400' }); }
        else if (sv_player.exp > lastExp) play('gem', 70);
        if (sv_player.hp > lastHp + 1) play('heal', 150);
        lastLevel = sv_player.level; lastExp = sv_player.exp; lastHp = sv_player.hp;
        shake = Math.max(0, shake - dt * 30);
    }

    /* ================= drawing ================= */
    var lastT = performance.now();
    function shadow(x, y, r) {
        sv_ctx.fillStyle = 'rgba(29,26,18,.28)';
        sv_ctx.beginPath(); sv_ctx.ellipse(x, y, r, r * 0.38, 0, 0, Math.PI * 2); sv_ctx.fill();
    }
    function gem(g, t) {
        var big = g.isBossDrop, s = big ? 16 : (g.value >= 10 ? 9 : g.value >= 3 ? 7.5 : 6);
        var col = big ? ['#e3c2ff', '#9b4dff'] : g.value >= 10 ? ['#ffd1d1', '#ff4b3e'] : g.value >= 3 ? ['#c9ffe4', '#21c77a'] : ['#d4f3ff', '#2fa8ff'];
        var bob = Math.sin(t * 4 + g.x * 0.05) * 2;
        shadow(g.x, g.y + s + 3, s * 0.8);
        sv_ctx.save(); sv_ctx.translate(g.x, g.y + bob);
        var grad = sv_ctx.createLinearGradient(0, -s, 0, s); grad.addColorStop(0, col[0]); grad.addColorStop(1, col[1]);
        sv_ctx.fillStyle = grad; sv_ctx.strokeStyle = INK; sv_ctx.lineWidth = big ? 3 : 2;
        sv_ctx.beginPath(); sv_ctx.moveTo(0, -s * 1.3); sv_ctx.lineTo(s, -s * 0.2); sv_ctx.lineTo(0, s * 1.3); sv_ctx.lineTo(-s, -s * 0.2); sv_ctx.closePath(); sv_ctx.fill(); sv_ctx.stroke();
        sv_ctx.fillStyle = 'rgba(255,255,255,.75)'; sv_ctx.beginPath(); sv_ctx.moveTo(-s * 0.15, -s); sv_ctx.lineTo(-s * 0.55, -s * 0.2); sv_ctx.lineTo(-s * 0.15, -s * 0.2); sv_ctx.fill();
        sv_ctx.restore();
    }
    function meat(m, t) {
        var k = m.isBossDrop ? 2.2 : 1, bob = Math.sin(t * 3 + m.x) * 2;
        shadow(m.x, m.y + 12 * k, 12 * k);
        sv_ctx.save(); sv_ctx.translate(m.x, m.y + bob); sv_ctx.scale(k, k); sv_ctx.rotate(-0.5);
        sv_ctx.lineWidth = 2.2; sv_ctx.strokeStyle = INK;
        sv_ctx.fillStyle = '#f6efdc';
        sv_ctx.beginPath(); sv_ctx.roundRect(4, -3, 14, 6, 3); sv_ctx.fill(); sv_ctx.stroke();
        sv_ctx.beginPath(); sv_ctx.arc(19, -4, 4, 0, 7); sv_ctx.arc(19, 4, 4, 0, 7); sv_ctx.fill(); sv_ctx.stroke();
        sv_ctx.fillStyle = '#c4452e';
        sv_ctx.beginPath(); sv_ctx.ellipse(-4, 0, 13, 10, 0, 0, 7); sv_ctx.fill(); sv_ctx.stroke();
        sv_ctx.fillStyle = 'rgba(255,220,180,.6)'; sv_ctx.beginPath(); sv_ctx.ellipse(-7, -4, 5, 3, -0.4, 0, 7); sv_ctx.fill();
        sv_ctx.restore();
    }
    function bar(x, y, w, h, ratio, col) {
        sv_ctx.fillStyle = INK; sv_ctx.beginPath(); sv_ctx.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 4); sv_ctx.fill();
        sv_ctx.fillStyle = '#4a4033'; sv_ctx.fillRect(x - w / 2, y, w, h);
        sv_ctx.fillStyle = col; sv_ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h);
    }
    function label(text, x, y, bg, fg) {
        sv_ctx.font = "13px 'Black Han Sans', 'Pretendard', sans-serif";
        var w = sv_ctx.measureText(text).width + 14;
        sv_ctx.fillStyle = bg; sv_ctx.strokeStyle = INK; sv_ctx.lineWidth = 2;
        sv_ctx.beginPath(); sv_ctx.roundRect(x - w / 2, y - 10, w, 20, 6); sv_ctx.fill(); sv_ctx.stroke();
        sv_ctx.fillStyle = fg; sv_ctx.textAlign = 'center'; sv_ctx.textBaseline = 'middle'; sv_ctx.fillText(text, x, y + 1);
    }
    function weaponImg(img) { return img && img.src && img.complete && img.naturalWidth > 0; }

    sv_draw = function () {
        var now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
        var t = sv_gameTime, g = sv_ctx;
        watchPlayer(dt);

        var sx = 0, sy = 0;
        if (shake > 0 && !REDUCED) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
        var camX = sv_camX + sx, camY = sv_camY + sy;

        // ground
        g.save();
        g.translate(-camX, -camY);
        g.fillStyle = groundPattern; g.fillRect(camX, camY, sv_cw, sv_ch);
        var L = camX - 120, R = camX + sv_cw + 120, T = camY - 120, B = camY + sv_ch + 120;
        drawProps(L, T, R, B);

        // pickups
        sv_gems.forEach(function (gm) { if (gm.x > L && gm.x < R && gm.y > T && gm.y < B) gem(gm, t); });
        sv_meats.forEach(function (m) { if (m.x > L && m.x < R && m.y > T && m.y < B) meat(m, t); });

        // area effects under the actors
        sv_aoeEffects.forEach(function (a) {
            if (a.type === 'claw') {
                var k = a.life / a.maxLife;
                g.save(); g.translate(a.x, a.y); g.globalAlpha = 0.35 * k;
                g.fillStyle = '#bfe9ff'; g.beginPath(); g.arc(0, 0, a.radius, 0, 7); g.fill();
                g.globalAlpha = k; g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round';
                var off = (a.hitsLeft % 2 === 0) ? 0.5 : -0.5;
                for (var i = -1; i <= 1; i++) {
                    g.beginPath(); g.arc(0, 0, a.radius * (0.55 + i * 0.12), off - 1.1, off + 1.1); g.stroke();
                }
                g.restore();
            } else if (a.type === 'drop') {
                var k2 = 1 - a.life / a.maxLife, rr = a.radius * (a.sizeMult || 1);
                g.save(); g.translate(a.x, a.y);
                g.strokeStyle = 'rgba(196,38,28,' + (0.35 + 0.4 * k2) + ')'; g.lineWidth = 3; g.setLineDash([10, 8]);
                g.beginPath(); g.arc(0, 0, rr, 0, 7); g.stroke(); g.setLineDash([]);
                g.fillStyle = 'rgba(29,26,18,' + (0.15 + 0.3 * k2) + ')'; g.beginPath(); g.ellipse(0, 0, rr * k2, rr * k2 * 0.45, 0, 0, 7); g.fill();
                g.restore();
            }
        });

        // actors, sorted by depth
        var actors = [];
        sv_enemies.forEach(function (e) { if (e.x > L && e.x < R && e.y > T && e.y < B) actors.push(e); });
        actors.push(sv_player);
        actors.sort(function (a, b) { return a.y - b.y; });
        actors.forEach(function (e) {
            if (e === sv_player) return drawPlayer(t);
            if (e._id === undefined) { e._id = enemyId++; e._hp = e.hp; e._flash = 0; }
            if (e.hp < e._hp) { e._flash = 0.12; e._squash = 0.18; }
            e._hp = e.hp;
            e._flash = Math.max(0, e._flash - dt); e._squash = Math.max(0, (e._squash || 0) - dt);
            var size = e.radius * (e.isBoss ? 3.4 : 2.7);
            shadow(e.x, e.y + e.radius * 0.9, e.radius * 1.05);
            if (e.isBoss) {
                g.save(); g.globalAlpha = 0.5 + Math.sin(t * 6) * 0.2; g.strokeStyle = '#ff3b30'; g.lineWidth = 4;
                g.beginPath(); g.ellipse(e.x, e.y + e.radius * 0.9, e.radius * 1.6, e.radius * 0.6, 0, 0, 7); g.stroke(); g.restore();
            }
            var bob = 1 + Math.sin(t * 12 + e._id) * 0.05 - (e._squash ? e._squash * 1.2 : 0);
            var flip = sv_player.x > e.x;
            var drawn = e.imgObj ? drawSprite(e.imgObj, e.x, e.y - size * 0.15, size, flip, bob) : null;
            if (!drawn) { g.fillStyle = e.color; g.beginPath(); g.arc(e.x, e.y, e.radius, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke(); }
            else if (e._flash > 0) {
                g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = e._flash / 0.12 * 0.8;
                drawSprite(e.imgObj, e.x, e.y - size * 0.15, size, flip, bob); g.restore();
            }
            var top = e.y - size * 0.15 - (drawn ? drawn.h : e.radius * 2) * 0.55 - 10;
            if (e.isBoss) { label('BOSS', e.x, top - 16, '#ff3b30', '#fff7e6'); bar(e.x, top - 2, 64, 6, e.hp / e.maxHp, '#ff3b30'); }
            else {
                if (e.isRanged) label('원거리', e.x, top - 14, '#b780ff', INK);
                if (e.hp < e.maxHp) bar(e.x, top, 28, 4, e.hp / e.maxHp, '#ff6b4a');
            }
        });

        // orbiting axes and projectiles above the actors
        sv_aoeEffects.forEach(function (a) {
            if (a.type !== 'orbit') return;
            g.save(); g.translate(a.x, a.y);
            g.globalAlpha = 0.25; g.fillStyle = a.color; g.beginPath(); g.arc(0, 0, 22 * (a.sizeMult || 1), 0, 7); g.fill(); g.globalAlpha = 1;
            g.rotate(a.angle + t * 15);
            var s = 40 * (a.sizeMult || 1);
            if (weaponImg(a.img)) g.drawImage(a.img, -s / 2, -s / 2, s, s);
            else { g.fillStyle = a.color; g.fillRect(-s / 4, -s / 4, s / 2, s / 2); }
            g.restore();
        });
        sv_aoeEffects.forEach(function (a) {
            if (a.type !== 'drop' || a.hasHit) return;
            var dropY = -600 * (a.life / a.maxLife), s = 60 * (a.sizeMult || 1);
            g.save(); g.translate(a.x, a.y + dropY); g.rotate(t * 3);
            if (weaponImg(a.img)) g.drawImage(a.img, -s / 2, -s / 2, s, s);
            else { g.fillStyle = '#a49a88'; g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill(); }
            g.restore();
        });
        sv_projectiles.forEach(function (p) {
            if (p.x < L || p.x > R || p.y < T || p.y > B) return;
            var sp = Math.hypot(p.vx, p.vy) || 1;
            g.save();
            g.strokeStyle = p.color; g.globalAlpha = 0.45; g.lineWidth = 6 * (p.sizeMult || 1); g.lineCap = 'round';
            g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx / sp * 34, p.y - p.vy / sp * 34); g.stroke();
            g.globalAlpha = 1; g.translate(p.x, p.y);
            g.rotate(p.type === 'boomerang' ? t * 20 : p.angle);
            var s = (p.type === 'thrust' ? 40 : p.type === 'boomerang' ? 35 : 25) * (p.sizeMult || 1);
            if (weaponImg(p.img)) { if (p.type !== 'boomerang') g.rotate(Math.PI / 4); g.drawImage(p.img, -s / 2, -s / 2, s, s); }
            else { g.fillStyle = p.color; g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, 6); g.lineTo(-6, -6); g.fill(); }
            g.restore();
        });
        sv_enemyProjectiles.forEach(function (ep) {
            if (ep.x < L || ep.x > R || ep.y < T || ep.y > B) return;
            g.save(); g.translate(ep.x, ep.y); g.rotate(t * 10);
            g.fillStyle = '#b780ff'; g.strokeStyle = INK; g.lineWidth = 2.5;
            g.beginPath(); for (var k = 0; k < 10; k++) { var rad = k % 2 ? 5 : 11; g.lineTo(Math.cos(k * Math.PI / 5) * rad, Math.sin(k * Math.PI / 5) * rad); } g.closePath(); g.fill(); g.stroke();
            g.restore();
        });

        // particles and rings
        sv_particles.forEach(function (pt) {
            g.globalAlpha = Math.max(0, pt.life / pt.maxLife); g.fillStyle = pt.color;
            g.fillRect(pt.x - pt.radius, pt.y - pt.radius, pt.radius * 2, pt.radius * 2);
        });
        g.globalAlpha = 1;
        for (var i = rings.length - 1; i >= 0; i--) {
            var rg = rings[i]; rg.life -= dt;
            if (rg.life <= 0) { rings.splice(i, 1); continue; }
            var k = 1 - rg.life / rg.maxLife;
            g.globalAlpha = 1 - k; g.strokeStyle = rg.color; g.lineWidth = 6 * (1 - k) + 1;
            g.beginPath(); g.arc(rg.x, rg.y, rg.r + (rg.max - rg.r) * k, 0, 7); g.stroke();
        }
        g.globalAlpha = 1;

        // damage numbers
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        sv_damageTexts.forEach(function (d) {
            var k = d.life / d.maxLife, pop = k > 0.8 ? 1 + (k - 0.8) * 2.5 : 1;
            var heal = String(d.text).charAt(0) === '+';
            var big = !heal && Number(d.text) >= 100;
            g.globalAlpha = Math.min(1, k * 2);
            g.font = Math.round((big ? 22 : 17) * pop) + "px 'Black Han Sans', 'Pretendard', sans-serif";
            g.lineWidth = 5; g.strokeStyle = INK; g.strokeText(d.text, d.x, d.y);
            g.fillStyle = heal ? '#45ffb0' : big ? '#ffd400' : '#fff7e6'; g.fillText(d.text, d.x, d.y);
        });
        g.globalAlpha = 1;
        g.restore();

        // screen overlays
        var vig = g.createRadialGradient(sv_cw / 2, sv_ch / 2, Math.min(sv_cw, sv_ch) * 0.35, sv_cw / 2, sv_ch / 2, Math.max(sv_cw, sv_ch) * 0.75);
        vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(29,26,18,.38)');
        g.fillStyle = vig; g.fillRect(0, 0, sv_cw, sv_ch);
        if (sv_hitFlashAlpha > 0) { g.fillStyle = 'rgba(255,59,48,' + sv_hitFlashAlpha * 0.6 + ')'; g.fillRect(0, 0, sv_cw, sv_ch); }
        for (var b = banners.length - 1; b >= 0; b--) {
            var bn = banners[b]; bn.life -= dt;
            if (bn.life <= 0) { banners.splice(b, 1); continue; }
            var p = 1 - bn.life / bn.maxLife, a = p < 0.15 ? p / 0.15 : bn.life < 0.4 ? bn.life / 0.4 : 1;
            g.save(); g.globalAlpha = a; g.translate(sv_cw / 2, sv_ch * 0.3); g.rotate(-0.05); g.scale(1 + (1 - a) * 0.3, 1 + (1 - a) * 0.3);
            g.font = "64px 'Black Han Sans', 'Pretendard', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.lineWidth = 14; g.strokeStyle = INK; g.strokeText(bn.text, 0, 0); g.fillStyle = '#ff3b30'; g.fillText(bn.text, 0, 0);
            g.restore();
        }
    };

    function drawPlayer(t) {
        var g = sv_ctx, p = sv_player, moving = sv_keys.w || sv_keys.a || sv_keys.s || sv_keys.d || sv_keys.arrowup || sv_keys.arrowdown || sv_keys.arrowleft || sv_keys.arrowright;
        shadow(p.x, p.y + 20, 22);
        g.save(); g.globalAlpha = 0.55; g.strokeStyle = '#ffd400'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(p.x, p.y + 20, 26 + Math.sin(t * 4) * 2, 10, 0, 0, 7); g.stroke(); g.restore();
        var bob = moving ? 1 + Math.sin(t * 16) * 0.06 : 1 + Math.sin(t * 3) * 0.02;
        var drawn = sv_selectedCharImgPath ? drawSprite(SV_IMAGES.player, p.x, p.y - 6, 58, p.facingX > 0, bob) : null;
        if (!drawn) {
            g.save(); g.translate(p.x, p.y); g.scale(1, bob);
            g.fillStyle = '#ffd400'; g.strokeStyle = INK; g.lineWidth = 3;
            g.beginPath(); g.arc(0, 0, p.radius, 0, 7); g.fill(); g.stroke();
            g.fillStyle = INK; var fx = p.facingX * 5, fy = p.facingY * 4;
            g.beginPath(); g.arc(-6 + fx, -3 + fy, 3, 0, 7); g.arc(6 + fx, -3 + fy, 3, 0, 7); g.fill();
            g.restore();
        }
        bar(p.x, p.y + 32, 44, 5, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? '#45d07a' : '#ff3b30');
    }

    /* ================= touch joystick ================= */
    var stick = document.createElement('div');
    stick.className = 'sv-stick';
    stick.innerHTML = '<div class="sv-stick-knob"></div>';
    var wrap = document.getElementById('survival-fullscreen-wrapper');
    if (wrap) wrap.appendChild(stick);
    var knob = stick.querySelector('.sv-stick-knob'), active = null, origin = null;
    function setKeys(dx, dy) {
        var dead = 0.3;
        sv_keys.a = dx < -dead; sv_keys.d = dx > dead; sv_keys.w = dy < -dead; sv_keys.s = dy > dead;
    }
    if (wrap) {
        wrap.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' || sv_gameState !== 'playing' || e.target.closest('button, .sv-modal, .sv-stat-box')) return;
            active = e.pointerId; origin = { x: e.clientX, y: e.clientY };
            stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.classList.add('is-on');
            knob.style.transform = 'translate(-50%, -50%)';
        });
        wrap.addEventListener('pointermove', function (e) {
            if (e.pointerId !== active) return;
            var dx = e.clientX - origin.x, dy = e.clientY - origin.y, d = Math.hypot(dx, dy), max = 46;
            if (d > max) { dx = dx / d * max; dy = dy / d * max; }
            knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
            setKeys(dx / max, dy / max);
            e.preventDefault();
        }, { passive: false });
        var end = function (e) { if (e.pointerId !== active) return; active = null; stick.classList.remove('is-on'); setKeys(0, 0); };
        wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
        if (sv_canvas) sv_canvas.style.touchAction = 'none';
    }

    /* ================= sound toggle ================= */
    var sfxBtn = document.createElement('button');
    sfxBtn.type = 'button'; sfxBtn.className = 'sv-sfx-toggle';
    function syncSfx() {
        sfxBtn.innerHTML = '<i class="fa-solid ' + (sfxOn ? 'fa-volume-high' : 'fa-volume-xmark') + '"></i> 효과음';
        sfxBtn.setAttribute('aria-pressed', String(sfxOn));
    }
    sfxBtn.addEventListener('click', function () {
        sfxOn = !sfxOn; syncSfx();
        try { localStorage.setItem('manduk_sfx', sfxOn ? 'on' : 'off'); } catch (e) {}
        if (sfxOn) { audio(); SFX.gem(); }
    });
    syncSfx();
    var hud = document.getElementById('sv-hud');
    if (hud) hud.appendChild(sfxBtn);
})();
