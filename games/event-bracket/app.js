(function () {
  'use strict';
  const B = window.Bracket;
  const S = window.EventStore;
  const LEGACY = 'mandeuk_event_bracket_v1';   // 예전 단일 대진표(이 브라우저)
  const DRAFT = 'mandeuk_event_draft_v1';      // 등록 전 작성 중인 글
  const $ = id => document.getElementById(id);
  const INFO = ['title', 'host', 'when', 'where', 'rules', 'prize1', 'prize2', 'prize3', 'prize4', 'prize5'];
  let state = null; // { mode, teams, waiting, bracket }
  const thirdBox = $('third-box'); // 렌더 때마다 결승 경기 아래로 옮겨 붙임

  // view: 'list' 목록 | 'new' 글쓰기 | 'event' 글 보기(editing이면 수정 중)
  const params = new URLSearchParams(location.search);
  const view = params.get('id') ? 'event' : params.get('new') ? 'new' : 'list';
  const eventId = params.get('id');
  let editing = false, key = null, saveTimer = null;
  const meta = { createdAt: 0 };
  let decisions = { accepted: [], rejected: [] }, applications = {};
  const editable = () => view === 'new' || editing;

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }

  function doc() { return { draft: readForm(), state, createdAt: meta.createdAt, decisions }; }

  function listSummary() {
    const f = readForm();
    const st = state && B.standings(state.bracket);
    return {
      title: (f.title || '이벤트 대진표').slice(0, 60), host: f.host.slice(0, 30), when: f.when.slice(0, 40),
      mode: f.mode, teams: state ? state.teams.length : 0,
      status: !state ? 'ready' : st ? 'done' : 'live',
      champion: st ? state.teams[st[0]].name.slice(0, 40) : '',
      createdAt: meta.createdAt, updatedAt: Date.now(),
    };
  }

  function setSaveState(text, bad) {
    $('save-state').textContent = text;
    $('save-state').classList.toggle('bad', !!bad);
  }

  function save() {
    if (view === 'new') { try { localStorage.setItem(DRAFT, JSON.stringify(doc())); } catch (e) { /* 저장 불가 환경 */ } return; }
    if (!editing) return;
    setSaveState('저장 중…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { await S.store.update(eventId, key, doc(), listSummary()); setSaveState('✔ 저장됨'); }
      catch (e) { setSaveState(e instanceof S.WrongPassword ? '저장 실패: 권한이 없어요' : '저장 실패: 연결을 확인하세요', true); }
    }, 500);
  }

  function fill(d) {
    d = d || {};
    INFO.forEach(k => { $(k).value = d[k] || ''; });
    $('players').value = (d.players || []).join('\n');
    $('team-list').value = d.teamList || '';
    const radio = document.querySelector(`input[name=mode][value="${d.mode || 1}"]`);
    if (radio) radio.checked = true;
    const method = document.querySelector(`input[name=method][value="${d.method || 'random'}"]`);
    if (method) method.checked = true;
    $('random-seed').checked = d.randomSeed !== false;
    $('apply-open').checked = d.applyOpen !== false;
  }

  function readForm() {
    const f = {
      mode: +document.querySelector('input[name=mode]:checked').value,
      method: document.querySelector('input[name=method]:checked').value,
      players: $('players').value.split('\n').map(s => s.trim()).filter(Boolean),
      teamList: $('team-list').value,
      randomSeed: $('random-seed').checked,
      applyOpen: $('apply-open').checked,
    };
    INFO.forEach(k => { f[k] = $(k).value.trim(); });
    return f;
  }
  const fixedTeams = f => f.mode > 1 && f.method === 'fixed';

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // 대회 정보(제목·주최·일시·규칙·상품)는 입력 즉시 화면에 반영
  function renderInfo() {
    const f = readForm();
    $('title-view').textContent = f.title || '이벤트 대진표';
    document.title = (f.title || '이벤트 대진표') + ' · 만득월드';
    const meta = [f.host && '주최 ' + f.host, f.when, f.where].filter(Boolean);
    if (state) meta.push(`${state.mode}:${state.mode} · ${state.teams.length}팀 · ${B.roundName(state.bracket.size)}`);
    $('meta-view').textContent = meta.join('  ·  ');

    const rules = f.rules.split('\n').map(s => s.trim()).filter(Boolean);
    $('rules-view').replaceChildren(...rules.map(r => el('p', '', r)));
    $('rules-box').hidden = !rules.length;

    const prizes = [['🥇', '우승', f.prize1], ['🥈', '준우승', f.prize2], ['🥉', '3위', f.prize3], ['🏅', '4위', f.prize5], ['🎈', '참가상', f.prize4]].filter(p => p[2]);
    $('prize-view').replaceChildren(...prizes.map(([ic, name, text]) => {
      const li = el('li');
      li.append(el('span', 'medal', ic), el('b', '', name), el('span', 'prize-text', text));
      return li;
    }));
    $('prize-box').hidden = !prizes.length;
    $('info-view').hidden = !rules.length && !prizes.length;
  }

  // 대전 방식·팀 구성 방식에 따라 입력 칸 전환
  function syncInputs() {
    const f = readForm();
    $('team-method').hidden = f.mode === 1;
    $('players-field').hidden = fixedTeams(f);
    $('teams-field').hidden = !fixedTeams(f);
    $('players-label').textContent = f.mode === 1 ? '참가자' : '참가자 (팀은 무작위로 나눠요)';
    const sample = Array.from({ length: f.mode }, (_, i) => '멤버' + (i + 1)).join(', ');
    $('teams-help').textContent = `한 줄에 한 팀 · "팀이름: 멤버, 멤버" 형식 · 팀당 ${f.mode}명`;
    $('team-list').placeholder = `불꽃팀: ${sample}\n물결팀: ${sample}\n...`;
  }

  function plan(f) {
    if (fixedTeams(f)) {
      const { teams, wrong } = B.parseTeams(f.teamList, f.mode);
      return { teams, waiting: [], wrong };
    }
    return { ...B.makeTeams(f.players, f.mode, f.mode > 1), wrong: [] };
  }

  function summary() {
    syncInputs();
    const f = readForm();
    const p = plan(f);
    const n = p.teams.length;
    let msg;
    if (n < 2) msg = fixedTeams(f) ? '팀을 2개 이상 적어 주세요.' : `참가자 ${f.players.length}명 · ${f.mode}:${f.mode}은 최소 ${f.mode * 2}명이 필요해요.`;
    else if (n > B.MAX_TEAMS) msg = `팀이 ${n}개예요. 최대 64팀(64강)까지 가능해요.`;
    else {
      const size = B.nextPow2(n);
      msg = (fixedTeams(f) ? `${n}팀` : f.mode === 1 ? `참가자 ${n}명` : `참가자 ${f.players.length}명 → ${n}팀`) + ` → ${B.roundName(size)}`;
      if (size > n) msg += ` (부전승 ${size - n}팀)`;
      if (p.waiting.length) msg += ` · 대기 ${p.waiting.length}명`;
    }
    const names = fixedTeams(f) ? p.teams.map(t => t.name) : f.players;
    const dup = names.length - new Set(names).size;
    if (dup) msg += ` · 같은 이름 ${dup}개 있음`;
    if (p.wrong.length) msg += ` · 인원이 ${f.mode}명이 아닌 팀: ${p.wrong.join(', ')}`;
    $('summary').textContent = msg;
    $('make').disabled = n < 2 || n > B.MAX_TEAMS;
  }

  function make() {
    if (state && !confirm('새 대진표를 만들면 지금 결과가 사라져요. 계속할까요?')) return;
    const f = readForm();
    const { teams, waiting } = plan(f);
    state = { mode: f.mode, teams, waiting, bracket: B.createBracket(teams, f.randomSeed) };
    save(); render();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const real = ti => ti !== null && ti >= 0;

  function sideButton(b, r, m, sides, side, w, onPick) {
    const ti = sides[side];
    const btn = el('button', 'side');
    btn.type = 'button';
    if (ti === -1) { btn.classList.add('bye'); btn.append(el('span', 'name', '부전승')); }
    else if (ti === null) { btn.classList.add('empty'); btn.append(el('span', 'name', '승자 대기')); }
    else {
      btn.append(el('span', 'name', state.teams[ti].name));
      if (state.mode > 1) btn.append(el('span', 'members', state.teams[ti].members.join(', ')));
    }
    if (w === side) btn.classList.add('win');
    if (w !== null && w !== side) btn.classList.add('lose');
    btn.disabled = !editable() || !(real(ti) && real(sides[1 - side]));
    btn.addEventListener('click', () => { if (onPick ? onPick(side) : B.setWinner(b, r, m, side)) { save(); render(); } });
    return btn;
  }

  function renderBracket() {
    const b = state.bracket;
    const last = b.winners.length - 1;
    const box = $('bracket');
    box.replaceChildren();
    let no = 0, played = 0, total = 0;
    b.winners.forEach((round, r) => {
      const col = el('div', 'round' + (r === last ? ' final' : ''));
      const head = el('div', 'round-head');
      head.append(el('b', '', B.roundName(b.size >> r)), el('small', '', round.length + '경기'));
      col.append(head);
      const list = el('div', 'matches');
      let pair = null;
      round.forEach((w, m) => {
        const sides = B.matchSides(b, r, m);
        const match = el('div', 'match');
        const bye = sides.includes(-1);
        match.append(el('span', 'match-no', bye ? '부전승' : (++no) + '경기'));
        if (!bye) { total++; if (w !== null) played++; }
        if (bye) match.classList.add('is-bye');
        if (w !== null && !bye) match.classList.add('done');
        match.append(sideButton(b, r, m, sides, 0, w), sideButton(b, r, m, sides, 1, w));
        if (r === last) { list.append(match, thirdBox); return; }
        if (m % 2 === 0) { pair = el('div', 'pair'); list.append(pair); }
        pair.append(match);
      });
      col.append(list);
      box.append(col);
    });
    const c = B.champion(b);
    const col = el('div', 'round champ-col');
    const head = el('div', 'round-head');
    head.append(el('b', '', '우승'), el('small', '', '🏆'));
    const slot = el('div', 'champ-slot' + (c !== null ? ' decided' : ''));
    slot.append(el('span', 'trophy', '🏆'), el('b', '', c !== null ? state.teams[c].name : '?'));
    const list = el('div', 'matches');
    list.append(slot);
    col.append(head, list);
    box.append(col);
    const ts = B.thirdSides(b);
    thirdBox.hidden = !ts;
    if (ts) {
      const tw = B.thirdWinner(b);
      const tbye = ts.includes(-1);
      const match = el('div', 'match third' + (tbye ? ' is-bye' : '') + (tw !== null && !tbye ? ' done' : ''));
      match.append(el('span', 'match-no', tbye ? '부전승' : (++no) + '경기'));
      if (!tbye) { total++; if (tw !== null) played++; }
      match.append(sideButton(b, -1, 0, ts, 0, tw, s => B.setThird(b, s)), sideButton(b, -1, 0, ts, 1, tw, s => B.setThird(b, s)));
      thirdBox.querySelector('#third-match').replaceChildren(match);
    }
    const st = B.standings(b);
    $('progress').textContent = st ? '경기 종료' : `진행 ${played} / ${total}경기`;
  }

  function renderResults() {
    const st = B.standings(state.bracket);
    $('results').hidden = !st;
    if (!st) return;
    const f = readForm();
    const place = (rank, medal, label, i, prize) => {
      const d = el('div', 'place p' + rank);
      const who = el('div', 'who');
      who.append(el('span', 'medal', medal), el('small', '', label), el('b', '', state.teams[i].name));
      if (state.mode > 1) who.append(el('span', 'members', state.teams[i].members.join(', ')));
      if (prize) who.append(el('em', '', prize));
      d.append(who, el('div', 'step', String(rank)));
      return d;
    };
    const items = [place(2, '🥈', '준우승', st[1], f.prize2), place(1, '🥇', '우승', st[0], f.prize1)];
    if (st[2] !== undefined) items.push(place(3, '🥉', '3위', st[2], f.prize3));
    $('podium').replaceChildren(...items);
    $('podium').classList.toggle('no-third', st[2] === undefined);
    const fourth = $('fourth');
    fourth.hidden = st[3] === undefined;
    if (st[3] !== undefined) {
      const t4 = state.teams[st[3]];
      fourth.replaceChildren(el('span', 'medal', '🏅'), el('small', '', '4위'), el('b', '', t4.name));
      if (state.mode > 1) fourth.append(el('span', 'members', t4.members.join(', ')));
      if (f.prize5) fourth.append(el('em', '', f.prize5));
    }
  }

  function render() {
    renderInfo();
    $('result').hidden = !state;
    if (!state) return;
    renderBracket();
    renderResults();
    $('bracket-hint').hidden = !editable();
    $('waiting').hidden = !state.waiting.length;
    $('waiting').textContent = '대기: ' + state.waiting.join(', ');
  }

  function reset() {
    if (state && !confirm('현재 대진표를 지울까요? (대회 정보는 남아요)')) return;
    state = null; save(); render();
  }

  document.querySelectorAll('input[name=mode], input[name=method], #players, #team-list, #random-seed').forEach(i => i.addEventListener('input', () => { summary(); save(); }));
  INFO.forEach(k => $(k).addEventListener('input', () => { renderInfo(); if (state) renderResults(); save(); }));
  $('make').addEventListener('click', make);
  $('reset').addEventListener('click', reset);
  $('print').addEventListener('click', () => window.print());

  // ---------- 참가 신청 ----------
  const DISCORD = /^(?=.{2,32}$)[a-z0-9_.]+$|^.{2,32}#\d{4}$/i;
  async function loadApplications() {
    try { applications = await S.store.listApply(eventId); } catch (e) { applications = {}; }
    renderApply();
  }

  function renderApply() {
    if (view !== 'event') return;
    const mine = applications[S.browserId()];
    const open = $('apply-open').checked;
    const n = Object.keys(applications).length;
    $('apply-box').hidden = editing || (!open && !mine);
    $('apply-count').textContent = n ? `신청 ${n}${teamMode() ? '팀' : '명'}` : '';
    $('apply-form').hidden = !!mine || !open;
    setupApplyForm();
    let msg = '';
    if (mine) {
      const st = decisions.accepted.includes(S.browserId()) ? '✅ 수락됨' : decisions.rejected.includes(S.browserId()) ? '❌ 거절됨' : '⏳ 주최자 확인 대기 중';
      msg = (mine.team ? `${mine.team} (대표 ${mine.nick})로` : `${mine.nick} 님으로`) + ` 신청했어요 · ${st}`;
    } else if (!open) msg = '신청이 마감되었어요.';
    $('apply-status').textContent = msg;
    renderApplicants();
  }

  function renderApplicants() {
    $('applicants').hidden = !editing;
    if (!editing) return;
    const items = Object.entries(applications).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
    $('applicants-count').textContent = items.length ? items.length + (teamMode() ? '팀' : '명') : '';
    if (!items.length) { $('applicant-list').replaceChildren(el('p', 'hint-sm', '아직 신청자가 없어요.')); return; }
    $('applicant-list').replaceChildren(...items.map(([bid, a]) => {
      const row = el('div', 'applicant');
      const acc = decisions.accepted.includes(bid), rej = decisions.rejected.includes(bid);
      if (acc) row.classList.add('accepted');
      if (rej) row.classList.add('rejected');
      const who = el('div', 'applicant-who');
      who.append(el('b', '', a.team ? `${a.team} · 대표 ${a.nick}` : a.nick));
      if (a.team) who.append(el('span', 'team-members', '팀원: ' + a.members));
      who.append(el('span', '', 'Discord: ' + a.discord));
      row.append(who, el('span', 'applicant-state', acc ? '수락됨' : rej ? '거절됨' : '대기'));
      const yes = el('button', 'btn btn-sm', acc ? '수락 취소' : '수락');
      yes.type = 'button';
      yes.addEventListener('click', () => decide(bid, a, acc ? null : 'accepted'));
      const no = el('button', 'btn btn-sm', rej ? '거절 취소' : '거절');
      no.type = 'button';
      no.addEventListener('click', () => decide(bid, a, rej ? null : 'rejected'));
      row.append(yes, no);
      return row;
    }));
  }

  function decide(bid, a, to) {
    decisions.accepted = decisions.accepted.filter(x => x !== bid);
    decisions.rejected = decisions.rejected.filter(x => x !== bid);
    if (to) decisions[to].push(bid);
    if (a.team) {
      // 팀 신청: 팀 직접 구성 목록에 "팀이름: 팀원, 팀원" 한 줄로 넣고 빼기
      const line = `${a.team}: ${a.members}`;
      const lines = $('team-list').value.split('\n').map(s => s.trim()).filter(Boolean).filter(l => l !== line);
      if (to === 'accepted') {
        lines.push(line);
        document.querySelector('input[name=method][value="fixed"]').checked = true;
      }
      $('team-list').value = lines.join('\n');
    } else {
      const lines = $('players').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (to === 'accepted' && !lines.includes(a.nick)) lines.push(a.nick);
      if (to !== 'accepted') { const i = lines.indexOf(a.nick); if (i >= 0) lines.splice(i, 1); }
      $('players').value = lines.join('\n');
    }
    summary(); save(); renderApply();
  }

  const teamMode = () => readForm().mode > 1;

  // 팀전이면 대표자가 팀 이름과 팀원 닉네임을 한 번에 입력
  function setupApplyForm() {
    const n = readForm().mode, team = n > 1;
    $('apply-form').classList.toggle('is-team', team);
    $('apply-team-field').hidden = !team;
    $('apply-team').required = team;
    $('apply-nick-label').textContent = team ? '대표자(팀장) 닉네임' : '인게임 닉네임';
    const box = $('team-apply');
    box.hidden = !team;
    if (box.childElementCount !== Math.max(0, n - 1)) {
      box.replaceChildren(...Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
        const l = el('label', 'field', `팀원 ${i + 2} 닉네임`);
        const inp = el('input', 'apply-member');
        inp.maxLength = 16;
        inp.placeholder = '인게임 닉네임';
        l.append(inp);
        return l;
      }));
    }
    box.querySelectorAll('input').forEach(i => { i.required = team; });
  }

  async function submitApply(e) {
    e.preventDefault();
    const nick = $('apply-nick').value.trim().replace(/[,，:：]/g, ' ').trim(), discord = $('apply-discord').value.trim().replace(/^@/, '');
    const err = $('apply-error');
    if (!nick) { err.textContent = '인게임 닉네임을 입력하세요.'; return; }
    const entry = { nick: nick.slice(0, 16), discord, at: Date.now() };
    if (teamMode()) {
      const team = $('apply-team').value.trim().replace(/[:：,，]/g, ' ').trim();
      const members = [nick, ...[...document.querySelectorAll('.apply-member')].map(i => i.value.trim())].map(s => s.replace(/[,，:：]/g, ' ').trim());
      if (!team) { err.textContent = '팀 이름을 입력하세요.'; return; }
      if (members.some(m => !m)) { err.textContent = '팀원 닉네임을 모두 입력하세요.'; return; }
      if (new Set(members).size !== members.length) { err.textContent = '팀원 닉네임이 겹쳐요.'; return; }
      entry.team = team.slice(0, 20);
      entry.members = members.map(m => m.slice(0, 16)).join(', ');
    }
    if (discord.includes('@') || !DISCORD.test(discord)) { err.textContent = '디스코드 아이디를 확인하세요. 이메일은 넣을 수 없어요. (영문·숫자·_·. 2~32자)'; return; }
    err.textContent = '신청 중…';
    const bid = S.browserId();
    try {
      entry.discord = discord.slice(0, 32);
      await S.store.apply(eventId, bid, entry);
      err.textContent = '';
    } catch (ex) {
      err.textContent = ex instanceof S.WrongPassword ? '이 브라우저에서는 이미 신청했어요.' : '신청하지 못했어요. 잠시 후 다시 시도하세요.';
    }
    await loadApplications();
  }

  // ---------- 목록 ----------
  const STATUS = { ready: ['준비 중', 'ready'], live: ['진행 중', 'live'], done: ['종료', 'done'] };
  async function showList() {
    $('title-view').textContent = '만득월드 이벤트';
    $('meta-view').textContent = '대회를 열고 대진표를 함께 확인하세요';
    $('list-view').hidden = false;
    $('store-note').textContent = S.store.shared ? '' : '⚠ 미리보기: 지금은 글이 이 브라우저에만 저장돼요. 공개 저장소를 연결하면 모두에게 보여요.';
    $('legacy').hidden = !readJSON(LEGACY);
    let items = [];
    try { items = Object.entries(await S.store.list()); }
    catch (e) { $('store-note').textContent = '목록을 불러오지 못했어요. 잠시 후 다시 시도하세요.'; }
    items.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
    $('list-empty').hidden = items.length > 0;
    $('event-list').replaceChildren(...items.map(([id, e]) => {
      const card = el('a', 'event-card');
      card.href = '?id=' + encodeURIComponent(id);
      const [label, cls] = STATUS[e.status] || STATUS.ready;
      card.append(el('span', 'status ' + cls, label), el('b', 'event-title', e.title || '이벤트'));
      card.append(el('span', 'event-meta', [e.host && '주최 ' + e.host, e.when].filter(Boolean).join(' · ') || '일정 미정'));
      const foot = el('span', 'event-foot', `${e.mode}:${e.mode}` + (e.teams ? ` · ${e.teams}팀` : ''));
      if (e.champion) foot.append(el('em', '', '🏆 ' + e.champion));
      card.append(foot);
      return card;
    }));
  }

  // ---------- 글쓴이 확인 ----------
  function askPassword() {
    return new Promise(resolve => {
      const dlg = $('pw-dialog'), form = $('pw-form');
      let settled = false;
      const finish = k => { if (settled) return; settled = true; form.onsubmit = null; dlg.onclose = null; if (dlg.open) dlg.close(); resolve(k); };
      $('pw-input').value = '';
      $('pw-error').textContent = '';
      $('pw-cancel').onclick = () => finish(null);
      dlg.onclose = () => finish(null); // Esc
      form.onsubmit = async e => {
        e.preventDefault();
        $('pw-error').textContent = '확인 중…';
        const k = await S.hashKey(eventId, $('pw-input').value);
        try { await S.store.verify(eventId, k); finish(k); }
        catch (err) {
          $('pw-error').textContent = err instanceof S.WrongPassword ? '비밀번호가 맞지 않아요.' : '연결을 확인하세요.';
          $('pw-input').select();
        }
      };
      dlg.showModal();
    });
  }

  function setEditing(on) {
    editing = on;
    $('setup').hidden = !on;
    $('setup').open = on;
    $('edit').hidden = on;
    $('done').hidden = !on;
    $('delete').hidden = !on;
    if (!on) setSaveState('');
    summary(); render(); renderApply();
  }

  async function showEvent() {
    $('toolbar').hidden = false;
    $('setup').hidden = true;
    let d = null;
    try { d = await S.store.get(eventId); } catch (e) { /* 아래에서 안내 */ }
    if (!d) {
      $('title-view').textContent = '글을 찾을 수 없어요';
      $('meta-view').textContent = '삭제되었거나 주소가 잘못되었어요.';
      return;
    }
    $('event-view').hidden = false;
    meta.createdAt = d.createdAt || 0;
    fill(d.draft); state = d.state || null;
    decisions = Object.assign({ accepted: [], rejected: [] }, d.decisions);
    $('edit').hidden = false;
    await loadApplications();
    summary(); render();
  }

  async function register() {
    const pw = $('pw-new').value, pw2 = $('pw-new2').value;
    const err = $('register-error');
    if (pw.length < 4) { err.textContent = '비밀번호를 4자 이상 입력하세요.'; return; }
    if (pw !== pw2) { err.textContent = '비밀번호 확인이 맞지 않아요.'; return; }
    err.textContent = '';
    $('register-btn').disabled = true;
    const id = S.newId();
    meta.createdAt = Date.now();
    try {
      await S.store.create(id, await S.hashKey(id, pw), doc(), listSummary());
      localStorage.removeItem(DRAFT);
      location.href = '?id=' + id;
    } catch (e) {
      err.textContent = '등록하지 못했어요. 연결을 확인하고 다시 시도하세요.';
      $('register-btn').disabled = false;
    }
  }

  function showNew() {
    $('event-view').hidden = false;
    $('toolbar').hidden = false;
    $('register').hidden = false;
    $('setup').open = true;
    const d = (params.get('legacy') && readJSON(LEGACY)) || readJSON(DRAFT);
    if (d) { fill(d.draft); state = d.state || null; }
    summary(); render();
  }

  $('edit').addEventListener('click', async () => { const k = await askPassword(); if (k) { key = k; setEditing(true); } });
  $('done').addEventListener('click', () => setEditing(false));
  $('delete').addEventListener('click', async () => {
    if (!confirm('이 글과 대진표를 삭제할까요? 되돌릴 수 없어요.')) return;
    try { await S.store.remove(eventId, key); location.href = './'; }
    catch (e) { setSaveState('삭제 실패', true); }
  });
  $('register-btn').addEventListener('click', register);
  $('apply-form').addEventListener('submit', submitApply);
  $('apply-open').addEventListener('input', renderApply);

  if (view === 'list') showList();
  else if (view === 'new') showNew();
  else showEvent();
})();
