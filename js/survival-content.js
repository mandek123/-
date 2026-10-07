// 만득서바이벌 · new content: 3 weapons, 2 monster types, map events.
// Built on the original game loop: new weapons join SV_WEAPON_DB and the level-up pool,
// monsters are spawned through the original spawner, and events reuse its pickups.
(function () {
    if (typeof SV_WEAPON_DB === 'undefined' || !window.SVPlus) return;
    var P = window.SVPlus, INK = '#1d1a12';

    function svgImg(svg) { var i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); return i; }
    var ICON_FIRE = svgImg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4C36 18 50 22 50 40a18 18 0 0 1-36 0c0-10 6-14 8-22 4 6 4 10 8 12 2-10 0-18 2-26z" fill="#ff7a1a" stroke="#1d1a12" stroke-width="4" stroke-linejoin="round"/><path d="M32 30c3 6 9 8 9 15a9 9 0 0 1-18 0c0-5 3-7 4-11 2 3 3 4 5 5z" fill="#ffd400" stroke="#1d1a12" stroke-width="3" stroke-linejoin="round"/><path d="M12 58h40" stroke="#1d1a12" stroke-width="5" stroke-linecap="round"/><path d="M16 54l32 6M48 54l-32 6" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/></svg>');
    var ICON_TOTEM = svgImg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="20" y="16" width="24" height="44" rx="4" fill="#b98a52" stroke="#1d1a12" stroke-width="4"/><circle cx="27" cy="28" r="3" fill="#1d1a12"/><circle cx="37" cy="28" r="3" fill="#1d1a12"/><path d="M26 38h12" stroke="#1d1a12" stroke-width="3"/><path d="M36 2L24 18h8l-6 12 14-16h-8l6-12z" fill="#ffd400" stroke="#1d1a12" stroke-width="3" stroke-linejoin="round"/></svg>');

    /* ---------- weapons ---------- */
    SV_WEAPON_DB.fire = { id: 'fire', name: '모닥불 오라', desc: '주변에 불꽃을 둘러 가까운 적을 계속 태웁니다.', type: 'aura', baseDmg: 9, baseCd: 0.5, speed: 0, range: 95, pierce: 99, color: '#ff7a1a', img: ICON_FIRE };
    SV_WEAPON_DB.totem = { id: 'totem', name: '번개 토템', desc: '토템을 세워 가까운 적들에게 연쇄 번개를 내립니다.', type: 'totem', baseDmg: 32, baseCd: 4.0, speed: 0, range: 260, pierce: 3, color: '#ffd400', img: ICON_TOTEM };
    SV_WEAPON_DB.stoneaxe = { id: 'stoneaxe', name: '돌도끼 투척', desc: '돌도끼를 높이 던져 포물선으로 떨어뜨립니다. (관통)', type: 'lob', baseDmg: 45, baseCd: 2.2, speed: 380, range: 0, pierce: 4, color: '#c9a066', img: P.ART.stoneaxe };
    var NEW_IDS = ['fire', 'totem', 'stoneaxe'];
    var ALL_IDS = ['bow', 'spear', 'axe', 'claw', 'boomerang', 'stone'].concat(NEW_IDS);

    var origAdd = sv_addWeapon;
    sv_addWeapon = function (id) {
        var had = sv_player.weapons.find(function (w) { return w.id === id; });
        var before = had ? had.level : 0;
        origAdd.apply(this, arguments);
        var w = sv_player.weapons.find(function (x) { return x.id === id; });
        if (!w || NEW_IDS.indexOf(id) < 0 || !had || w.level === before) return;
        if (id === 'fire') { w.damage *= 1.25; w.range += 14; if (w.level === 6) { w.maxCd = 0.3; w.range += 30; } }
        if (id === 'totem') { w.damage *= 1.3; w.pierce += 1; if (w.level === 6) { w.maxCd = 2.5; w.pierce += 2; } }
        if (id === 'stoneaxe') { w.damage *= 1.3; w.count = (w.count || 1) + (w.level % 2 === 0 ? 1 : 0); if (w.level === 6) w.maxCd = 1.2; }
    };

    var totems = [], bolts = [], auraTick = 0;
    var origFire = sv_fireWeapon;
    sv_fireWeapon = function (w) {
        if (w.type === 'aura') return;                       // handled every frame below
        if (w.type === 'totem') {
            totems.push({ x: sv_player.x + (Math.random() - 0.5) * 60, y: sv_player.y + (Math.random() - 0.5) * 60, life: 6, maxLife: 6, timer: 0.2, w: w });
            P.play('thump', 200);
            return;
        }
        if (w.type === 'lob') {
            var n = w.count || 1;
            for (var i = 0; i < n; i++) {
                var dir = Math.atan2(sv_player.facingY, sv_player.facingX) + (i - (n - 1) / 2) * 0.5;
                sv_projectiles.push({
                    x: sv_player.x, y: sv_player.y, vx: Math.cos(dir) * w.speed, vy: Math.sin(dir) * w.speed - 420,
                    damage: w.damage * sv_player.atkMult, pierce: w.pierce, hitIds: new Set(), life: 1.3, maxLife: 1.3,
                    color: w.color, img: w.img, type: 'lob', angle: 0, sizeMult: w.level >= 6 ? 1.6 : 1.2
                });
            }
            return;
        }
        return origFire.apply(this, arguments);
    };

    /* ---------- monsters ---------- */
    var origSpawn = sv_spawnEnemy;
    sv_spawnEnemy = function () {
        origSpawn.apply(this, arguments);
        var e = sv_enemies[sv_enemies.length - 1];
        if (!e) return;
        var r = Math.random();
        if (sv_gameTime > 40 && r < 0.12) {
            e.kind = 'charger'; e.radius = 18; e.hp = e.maxHp = e.maxHp * 1.4; e.baseSpeed = e.speed; e.chargeT = 2 + Math.random() * 2; e.expValue += 1;
        } else if (sv_gameTime > 80 && r < 0.22) {
            e.kind = 'splitter'; e.radius = 20; e.hp = e.maxHp = e.maxHp * 1.6; e.speed *= 0.8; e.expValue += 2;
        }
    };
    function spawnHatchling(x, y, parent) {
        var a = Math.random() * Math.PI * 2;
        sv_enemies.push({
            x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, radius: 11, maxHp: parent.maxHp * 0.3, hp: parent.maxHp * 0.3,
            damage: Math.max(1, Math.floor(parent.damage * 0.6)), speed: parent.speed * 1.35, expValue: 1, attackTimer: 0.5,
            color: '#fff1c9', imgObj: P.ART.egg, isBoss: false, isRanged: false, kind: 'hatchling'
        });
    }

    /* ---------- map events ---------- */
    var EVENTS = [
        { name: '운석 낙하!', color: '#ff7a1a', run: function () {
            for (var i = 0; i < 8; i++) {
                meteors.push({ x: sv_player.x + (Math.random() - 0.5) * sv_cw * 0.9, y: sv_player.y + (Math.random() - 0.5) * sv_ch * 0.9, t: 1.4 + i * 0.25, r: 90 });
            }
        } },
        { name: '고기 축제!', color: '#45d07a', run: function () {
            for (var i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2; sv_meats.push({ x: sv_player.x + Math.cos(a) * 220, y: sv_player.y + Math.sin(a) * 220, healAmount: 30, isBossDrop: false }); }
        } },
        { name: '보석 비!', color: '#2fa8ff', run: function () {
            for (var i = 0; i < 24; i++) sv_gems.push({ x: sv_player.x + (Math.random() - 0.5) * 700, y: sv_player.y + (Math.random() - 0.5) * 500, value: 2, isBossDrop: false });
        } },
        { name: '몬스터 대행진!', color: '#b780ff', run: function () {
            var side = Math.random() * Math.PI * 2;
            for (var i = 0; i < 16; i++) {
                origSpawn();
                var e = sv_enemies[sv_enemies.length - 1], spread = (i - 8) * 26, d = Math.max(sv_cw, sv_ch) / 2 + 80;
                e.x = sv_player.x + Math.cos(side) * d - Math.sin(side) * spread; e.y = sv_player.y + Math.sin(side) * d + Math.cos(side) * spread;
                e.hp = e.maxHp = e.maxHp * 0.6; e.speed *= 1.15;
            }
        } }
    ];
    var meteors = [], nextEvent = 35, eventIdx = 0;

    /* ---------- update ---------- */
    var origStart = sv_startGame;
    sv_startGame = function () { totems = []; bolts = []; meteors = []; nextEvent = 35; eventIdx = Math.floor(Math.random() * EVENTS.length); return origStart.apply(this, arguments); };

    function hurt(e, dmg) { e.hp -= dmg; sv_showDamage(dmg, e.x, e.y); }
    function nearest(x, y, range, skip) {
        var best = null, bd = range * range;
        sv_enemies.forEach(function (e) { if (skip.has(e) || e.hp <= 0) return; var dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = e; } });
        return best;
    }

    var origUpdate = sv_update;
    sv_update = function (dt) {
        // splitters break into hatchlings before the original removes them
        sv_enemies.slice().forEach(function (e) { if (e.kind === 'splitter' && e.hp <= 0 && !e.split) { e.split = true; spawnHatchling(e.x, e.y, e); spawnHatchling(e.x, e.y, e); } });
        // chargers wind up, then dash
        sv_enemies.forEach(function (e) {
            if (e.kind !== 'charger') return;
            e.chargeT -= dt;
            if (e.chargeT <= 0 && !e.dashing && !e.windup) { e.windup = 0.6; e.speed = 0; }
            if (e.windup) { e.windup -= dt; if (e.windup <= 0) { e.windup = 0; e.dashing = 0.55; e.speed = e.baseSpeed * 4; } }
            else if (e.dashing) { e.dashing -= dt; if (e.dashing <= 0) { e.dashing = 0; e.speed = e.baseSpeed; e.chargeT = 2.5 + Math.random() * 1.5; } }
        });
        // thrown stone axes arc back down
        sv_projectiles.forEach(function (p) { if (p.type === 'lob') { p.vy += 900 * dt; p.angle += dt * 14; } });

        origUpdate.apply(this, arguments);
        if (sv_gameState !== 'playing') return;

        // fire aura
        var fire = sv_player.weapons.find(function (w) { return w.id === 'fire'; });
        if (fire) {
            auraTick -= dt;
            if (auraTick <= 0) {
                auraTick = fire.level >= 6 ? fire.maxCd : fire.maxCd * sv_player.cdMult;
                var r2 = fire.range * fire.range, dmg = fire.damage * sv_player.atkMult;
                sv_enemies.forEach(function (e) { var dx = e.x - sv_player.x, dy = e.y - sv_player.y; if (dx * dx + dy * dy < r2 + e.radius * e.radius) { e.hp -= dmg; if (Math.random() < 0.3) sv_showDamage(dmg, e.x, e.y, '#ffb27a'); } });
            }
        }
        // totems
        for (var i = totems.length - 1; i >= 0; i--) {
            var tm = totems[i]; tm.life -= dt; tm.timer -= dt;
            if (tm.life <= 0) { totems.splice(i, 1); continue; }
            if (tm.timer <= 0) {
                tm.timer = 0.8;
                var from = { x: tm.x, y: tm.y - 40 }, hit = new Set(), chain = tm.w.pierce, dmg2 = tm.w.damage * sv_player.atkMult;
                for (var c = 0; c < chain; c++) {
                    var tgt = nearest(from.x, from.y, c === 0 ? tm.w.range : 180, hit);
                    if (!tgt) break;
                    hit.add(tgt); bolts.push({ x1: from.x, y1: from.y, x2: tgt.x, y2: tgt.y, life: 0.18 });
                    hurt(tgt, dmg2 * (c === 0 ? 1 : 0.8)); from = tgt;
                }
                if (hit.size) P.play('hit', 80);
            }
        }
        for (var b = bolts.length - 1; b >= 0; b--) { bolts[b].life -= dt; if (bolts[b].life <= 0) bolts.splice(b, 1); }
        // events
        if (sv_gameTime >= nextEvent) {
            var ev = EVENTS[eventIdx % EVENTS.length]; eventIdx++;
            nextEvent += 45;
            P.banner(ev.name, ev.color); ev.run();
        }
        for (var m = meteors.length - 1; m >= 0; m--) {
            var mt = meteors[m]; mt.t -= dt;
            if (mt.t > 0) continue;
            meteors.splice(m, 1);
            var rr = mt.r * mt.r, md = 60 + sv_gameTime * 0.6;
            sv_enemies.forEach(function (e) { var dx = e.x - mt.x, dy = e.y - mt.y; if (dx * dx + dy * dy < rr) hurt(e, md); });
            var pdx = sv_player.x - mt.x, pdy = sv_player.y - mt.y;
            if (pdx * pdx + pdy * pdy < rr) { sv_player.hp -= 12; sv_hitFlashAlpha = 0.4; sv_updateUI(); if (sv_player.hp <= 0) return sv_gameOver(); }
            P.ring(mt.x, mt.y, 10, mt.r * 1.6, 0.5, '#ff7a1a'); P.shake(8); P.play('thump', 60);
            sv_createParticles(mt.x, mt.y, '#ff7a1a', 6);
        }
    };

    /* ---------- drawing ---------- */
    P.under.push(function (g, t) {
        var fire = sv_player.weapons && sv_player.weapons.find(function (w) { return w.id === 'fire'; });
        if (fire) {
            var r = fire.range;
            g.save(); g.translate(sv_player.x, sv_player.y);
            var grad = g.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
            grad.addColorStop(0, 'rgba(255,212,0,0)'); grad.addColorStop(0.75, 'rgba(255,122,26,.18)'); grad.addColorStop(1, 'rgba(255,59,48,.35)');
            g.fillStyle = grad; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
            g.strokeStyle = 'rgba(255,122,26,.7)'; g.lineWidth = 3; g.setLineDash([12, 10]); g.lineDashOffset = -t * 40;
            g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.setLineDash([]);
            for (var i = 0; i < 10; i++) {
                var a = i / 10 * Math.PI * 2 + t * 1.5, fr = r * (0.82 + Math.sin(t * 6 + i) * 0.06), fs = 7 + Math.sin(t * 9 + i * 2) * 3;
                g.fillStyle = i % 2 ? '#ffd400' : '#ff7a1a';
                g.beginPath(); g.ellipse(Math.cos(a) * fr, Math.sin(a) * fr - fs * 0.4, fs * 0.6, fs, 0, 0, 7); g.fill();
            }
            g.restore();
        }
        meteors.forEach(function (mt) {
            var k = Math.max(0, Math.min(1, 1 - mt.t / 1.4));
            g.save(); g.translate(mt.x, mt.y);
            g.strokeStyle = 'rgba(255,59,48,' + (0.4 + 0.5 * k) + ')'; g.lineWidth = 4; g.setLineDash([12, 8]);
            g.beginPath(); g.arc(0, 0, mt.r, 0, 7); g.stroke(); g.setLineDash([]);
            g.fillStyle = 'rgba(255,59,48,' + 0.2 * k + ')'; g.beginPath(); g.arc(0, 0, mt.r * k, 0, 7); g.fill();
            if (mt.t < 0.6) {
                var h = mt.t / 0.6 * 420;
                g.fillStyle = '#7a5a48'; g.strokeStyle = INK; g.lineWidth = 3;
                g.beginPath(); g.arc(-h * 0.4, -h, 20, 0, 7); g.fill(); g.stroke();
                g.fillStyle = 'rgba(255,122,26,.6)'; g.beginPath(); g.ellipse(-h * 0.4 + 14, -h - 18, 10, 26, -0.4, 0, 7); g.fill();
            }
            g.restore();
        });
        totems.forEach(function (tm) {
            P.shadow(tm.x, tm.y + 6, 18);
            g.save(); g.translate(tm.x, tm.y);
            if (tm.life < 1) g.globalAlpha = tm.life;
            g.fillStyle = '#b98a52'; g.strokeStyle = INK; g.lineWidth = 3;
            g.beginPath(); g.roundRect(-12, -46, 24, 50, 5); g.fill(); g.stroke();
            g.fillStyle = INK; g.beginPath(); g.arc(-5, -34, 2.5, 0, 7); g.arc(5, -34, 2.5, 0, 7); g.fill();
            g.fillRect(-6, -24, 12, 3);
            g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(4, -70); g.lineTo(-8, -52); g.lineTo(0, -52); g.lineTo(-4, -40); g.lineTo(10, -58); g.lineTo(2, -58); g.closePath(); g.fill(); g.stroke();
            g.restore();
        });
    });
    P.over.push(function (g, t) {
        bolts.forEach(function (bt) {
            g.save(); g.globalAlpha = bt.life / 0.18; g.lineJoin = 'round';
            [[9, INK], [5, '#ffd400'], [2, '#ffffff']].forEach(function (s) {
                g.strokeStyle = s[1]; g.lineWidth = s[0]; g.beginPath(); g.moveTo(bt.x1, bt.y1);
                for (var k = 1; k < 6; k++) { var f = k / 6; g.lineTo(bt.x1 + (bt.x2 - bt.x1) * f + (Math.random() - 0.5) * 22, bt.y1 + (bt.y2 - bt.y1) * f + (Math.random() - 0.5) * 22); }
                g.lineTo(bt.x2, bt.y2); g.stroke();
            });
            g.restore();
        });
        sv_enemies.forEach(function (e) {
            if (e.kind === 'charger') {
                if (e.windup) P.label('!', e.x, e.y - e.radius * 2.6, '#ff3b30', '#fff7e6');
                else if (e.dashing) { g.save(); g.globalAlpha = 0.35; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(e.x, e.y, e.radius * 1.4, 0, 7); g.fill(); g.restore(); }
            } else if (e.kind === 'splitter') {
                P.label('분열', e.x, e.y - e.radius * 2.8, '#fff1c9', INK);
            }
        });
    });

    /* ---------- level-up pool with the new weapons ---------- */
    var origLevel = sv_checkLevelUp;
    sv_checkLevelUp = function () {
        sv_updateUI();
        if (sv_player.exp < sv_player.maxExp) return;
        sv_player.exp -= sv_player.maxExp;
        sv_player.level++;
        sv_player.maxExp = Math.floor(sv_player.maxExp * 1.15 + 10);
        sv_gameState = 'paused';
        var modal = document.getElementById('sv-levelup-modal'), container = document.getElementById('sv-upgrade-container');
        container.innerHTML = '';
        var weaponPool = [], statPool = [];
        var owned = sv_player.weapons.filter(function (w) { return w.id.indexOf('evo_') !== 0; }).length;
        ALL_IDS.forEach(function (wId) {
            if (sv_player.weapons.find(function (wp) { return wp.id === 'evo_' + wId; })) return;
            var w = sv_player.weapons.find(function (wp) { return wp.id === wId; }), db = SV_WEAPON_DB[wId];
            var icon = db.img && db.img.src ? '<div class="sv-upgrade-icon"><img src="' + db.img.src + '"></div>' : '<div class="sv-upgrade-icon"></div>';
            if (!w) { if (owned < 6) weaponPool.push({ name: db.name + ' 획득', desc: db.desc, icon: icon, action: function () { sv_addWeapon(wId); }, isNew: NEW_IDS.indexOf(wId) >= 0 }); }
            else if (w.level < 6) {
                var extra = w.level + 1 === 6 ? "<br><span style='color: var(--acc-orange); font-weight:bold;'>[MAX 달성: 특수 형태 진화!]</span>" : '';
                weaponPool.push({ name: db.name + ' 강화 (Lv.' + (w.level + 1) + ')', desc: '피해량 및 능력치 증가' + extra, icon: icon, action: function () { sv_addWeapon(wId); } });
            }
        });
        var ic = function (cls) { return '<div class="sv-upgrade-icon"><i class="fa-solid ' + cls + '"></i></div>'; };
        statPool.push({ name: '공격력 증가', desc: '모든 피해량이 20% 증가합니다.', icon: ic('fa-khanda'), action: function () { sv_player.atkMult += 0.2; } });
        statPool.push({ name: '공속 증가', desc: '무기 발사 주기가 10% 짧아집니다.', icon: ic('fa-bolt'), action: function () { sv_player.cdMult *= 0.9; } });
        statPool.push({ name: '이동 속도', desc: '발걸음이 15% 빨라집니다.', icon: ic('fa-shoe-prints'), action: function () { sv_player.speed *= 1.15; } });
        statPool.push({ name: '아이템 자석', desc: '보석을 끌어당기는 반경이 넓어집니다.', icon: ic('fa-magnet'), action: function () { sv_player.magnetRange += 60; } });
        statPool.push({ name: '최대 체력 증가', desc: '최대 체력이 20 증가합니다.', icon: ic('fa-heart'), action: function () { sv_player.maxHp += 20; sv_player.hp += 20; } });
        if (sv_player.hp <= sv_player.maxHp * 0.5) statPool.push({ name: '긴급 체력 회복', desc: '체력을 50 즉시 회복합니다.', icon: ic('fa-heart-pulse'), action: function () { sv_player.hp = Math.min(sv_player.maxHp, sv_player.hp + 50); } });
        var shuffle = function (a) { return a.sort(function () { return 0.5 - Math.random(); }); };
        var choices = [];
        if (weaponPool.length === 0 || Math.random() < 0.15) choices = shuffle(statPool).slice(0, 3);
        else { shuffle(weaponPool); shuffle(statPool); choices.push(weaponPool.pop()); choices.push.apply(choices, shuffle(weaponPool.concat(statPool)).slice(0, 2)); shuffle(choices); }
        choices.forEach(function (c) {
            var card = document.createElement('div');
            card.className = 'sv-upgrade-card' + (c.isNew ? ' is-new' : '');
            card.innerHTML = c.icon + '<div class="sv-upgrade-name">' + c.name + '</div><div class="sv-upgrade-desc">' + c.desc + '</div>';
            card.onclick = function () {
                c.action(); modal.style.display = 'none'; sv_gameState = 'playing'; sv_lastTime = performance.now();
                sv_updateUI(); sv_updateStatusUI();
                if (sv_reqId !== null) cancelAnimationFrame(sv_reqId);
                sv_reqId = null;
                if (sv_gameState === 'playing') sv_reqId = requestAnimationFrame(sv_gameLoop);
            };
            container.appendChild(card);
        });
        modal.style.display = 'flex';
    };

    /* ---------- HUD names for every weapon ---------- */
    var SHORT = { bow: '활', spear: '창', axe: '도끼', claw: '손톱', boomerang: '부메랑', stone: '돌', fire: '모닥불', totem: '토템', stoneaxe: '돌도끼', evo_bow: '신궁', evo_axe: '소용돌이' };
    sv_updateStatusUI = function () {
        var w = sv_player.weapons.map(function (x) { return (SHORT[x.id] || x.id) + ' ' + (x.level >= 6 ? 'MAX' : 'Lv.' + x.level); }).join(' · ') || '없음';
        var atk = Math.round((sv_player.atkMult - 1) * 100), cd = Math.round((1 - sv_player.cdMult) * 100), spd = Math.round((sv_player.speed / 220 - 1) * 100), mag = sv_player.magnetRange - 100;
        var wd = document.getElementById('sv-ui-weapons'), sd = document.getElementById('sv-ui-stats');
        if (wd) wd.innerText = '[장비] ' + w;
        if (sd) sd.innerText = '[능력치] 공격 +' + atk + '% | 공속 +' + cd + '% | 이속 +' + spd + '% | 자석 +' + mag;
    };

    /* ---------- boss reward shows the chest ---------- */
    var origReward = sv_openBossReward;
    sv_openBossReward = function () {
        origReward.apply(this, arguments);
        var box = document.getElementById('sv-boss-reward-content');
        if (box && P.ART.chest) box.insertAdjacentHTML('afterbegin', '<img class="sv-chest" src="' + P.ART.chest.src + '" alt="">');
    };
})();
