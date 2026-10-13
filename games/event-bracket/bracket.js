// 만득월드 이벤트 대진표: 참가자 → 팀 → 토너먼트(최대 64강). 기록은 이 브라우저에만 저장.
(function (root) {
  'use strict';

  const MAX_TEAMS = 64;

  function nextPow2(n) { let s = 2; while (s < n) s *= 2; return s; }

  // 표준 시드 배치: 1번 시드와 마지막 시드가 만나도록. 부전승(빈 시드)은 상위 시드와만 붙는다.
  function seedOrder(size) {
    let order = [1, 2];
    while (order.length < size) {
      const n = order.length * 2;
      order = order.flatMap(s => [s, n + 1 - s]);
    }
    return order;
  }

  function shuffle(list, rand = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function roundName(teamsInRound) {
    if (teamsInRound === 2) return '결승';
    if (teamsInRound === 4) return '4강';
    return teamsInRound + '강';
  }

  // players: 이름 배열, teamSize: 1|3|5
  function makeTeams(players, teamSize, random, rand) {
    const list = random ? shuffle(players, rand) : players.slice();
    const count = Math.floor(list.length / teamSize);
    const teams = [];
    for (let i = 0; i < count; i++) {
      const members = list.slice(i * teamSize, (i + 1) * teamSize);
      teams.push({ name: teamSize === 1 ? members[0] : (i + 1) + '팀', members });
    }
    return { teams, waiting: list.slice(count * teamSize) };
  }

  // 팀 직접 구성: 한 줄에 한 팀. "팀이름: 멤버, 멤버" 또는 "멤버, 멤버"(이름 자동)
  function parseTeams(text, teamSize) {
    const teams = [], wrong = [];
    text.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
      const m = line.match(/^([^:：]+)[:：](.*)$/);
      const name = m ? m[1].trim() : '';
      const members = (m ? m[2] : line).split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const team = { name: name || (teams.length + 1) + '팀', members };
      if (members.length !== teamSize) wrong.push(team.name);
      teams.push(team);
    });
    return { teams, wrong };
  }

  function createBracket(teams, random, rand) {
    if (teams.length < 2) throw new Error('팀이 2개 이상 필요해요.');
    if (teams.length > MAX_TEAMS) throw new Error('최대 64팀까지 만들 수 있어요.');
    const order = random ? shuffle(teams.map((_, i) => i), rand) : teams.map((_, i) => i);
    const size = nextPow2(teams.length);
    // slots[k] = 첫 라운드 k번째 자리의 팀 번호, -1은 부전승 빈자리
    const slots = seedOrder(size).map(seed => (seed <= teams.length ? order[seed - 1] : -1));
    const winners = [];
    for (let n = size / 2; n >= 1; n /= 2) winners.push(new Array(n).fill(null));
    const b = { size, slots, winners };
    autoByes(b);
    return b;
  }

  // 라운드 r, 경기 m의 두 자리(팀 번호, -1=빈자리, null=아직 미정)
  function matchSides(b, r, m) {
    if (r === 0) return [b.slots[2 * m], b.slots[2 * m + 1]];
    return [winnerOf(b, r - 1, 2 * m), winnerOf(b, r - 1, 2 * m + 1)];
  }

  function winnerOf(b, r, m) {
    const w = b.winners[r][m];
    if (w === null) return null;
    return matchSides(b, r, m)[w];
  }

  function autoByes(b) {
    b.winners[0].forEach((_, m) => {
      const [x, y] = matchSides(b, 0, m);
      if (x === -1) b.winners[0][m] = 1;
      else if (y === -1) b.winners[0][m] = 0;
    });
  }

  // 승자 지정. 같은 쪽을 다시 누르면 취소. 이후 라운드 결과는 지운다.
  function setWinner(b, r, m, side) {
    const [x, y] = matchSides(b, r, m);
    if (x === null || y === null || x === -1 || y === -1) return false;
    b.winners[r][m] = b.winners[r][m] === side ? null : side;
    for (let rr = r + 1, mm = m >> 1; rr < b.winners.length; rr++, mm >>= 1) b.winners[rr][mm] = null;
    if (r < b.winners.length - 1) b.third = null;
    return true;
  }

  // 3·4위전: 4강에서 진 두 팀. 4강이 없으면(2팀) null, 아직 미정인 자리는 null
  function thirdSides(b) {
    const semi = b.winners.length - 2;
    if (semi < 0) return null;
    return [0, 1].map(m => {
      const w = b.winners[semi][m];
      return w === null ? null : matchSides(b, semi, m)[1 - w];
    });
  }

  // 3·4위전 승자 쪽(0|1). 한쪽이 부전승 빈자리면 상대가 자동 3위
  function thirdWinner(b) {
    const s = thirdSides(b);
    if (!s || s.includes(null)) return null;
    if (s[0] === -1) return 1;
    if (s[1] === -1) return 0;
    return b.third == null ? null : b.third;
  }

  function setThird(b, side) {
    const s = thirdSides(b);
    if (!s || s.some(x => x === null || x === -1)) return false;
    b.third = b.third === side ? null : side;
    return true;
  }

  // 최종 순위: 팀 번호 배열 [1위, 2위, 3위, 4위], 미정이면 null
  function standings(b) {
    const last = b.winners.length - 1;
    const champ = champion(b);
    if (champ === null) return null;
    const f = matchSides(b, last, 0);
    const out = [champ, f[1 - b.winners[last][0]]];
    const s = thirdSides(b), tw = thirdWinner(b);
    if (s) {
      if (tw === null) return null;
      out.push(s[tw]);
      if (s[1 - tw] >= 0) out.push(s[1 - tw]);
    }
    return out;
  }

  function champion(b) { return winnerOf(b, b.winners.length - 1, 0); }

  const api = { MAX_TEAMS, nextPow2, seedOrder, shuffle, roundName, makeTeams, parseTeams, createBracket, matchSides, setWinner, champion, thirdSides, thirdWinner, setThird, standings };
  if (typeof module !== 'undefined') module.exports = api; else root.Bracket = api;
})(this);
