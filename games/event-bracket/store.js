// 이벤트 글 저장소. EVENT_SHARED=true면 Firebase(모두에게 공개), 아니면 이 브라우저(localStorage)에만 저장.
// 비밀번호는 저장하지 않는다. sha256(글번호:비밀번호)만 비공개 경로(event_keys)에 두고, 수정할 때 같은 값을 증명으로 보낸다.
(function (root) {
  'use strict';
  const DB = 'https://pettraining-933c2-default-rtdb.asia-southeast1.firebasedatabase.app';
  const LOCAL = 'mandeuk_events_local_v1';

  async function hashKey(id, password) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id + ':' + password));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  class WrongPassword extends Error {}

  const remote = {
    shared: true,
    async req(method, path, body) {
      const res = await fetch(`${DB}/${path}.json`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      if (res.status === 401 || res.status === 403) throw new WrongPassword('권한 없음');
      if (!res.ok) throw new Error('저장소 오류 ' + res.status);
      return res.json();
    },
    // 증명값은 한 번만 쓰인다(규칙이 쓰기 직전에 남아 있는 증명값을 거절). 쓰기 전후로 지운다.
    async proved(proofPath, body) {
      await this.req('PUT', proofPath, null);
      try { return await this.req('PATCH', '', body); }
      finally { this.req('PUT', proofPath, null).catch(() => {}); }
    },
    async list() { return (await this.req('GET', 'event_list')) || {}; },
    async get(id) {
      const v = await this.req('GET', 'events/' + encodeURIComponent(id));
      return v && v.data ? JSON.parse(v.data) : null;
    },
    create(id, key, doc, summary) {
      return this.req('PATCH', '', {
        ['events/' + id]: { data: JSON.stringify(doc) },
        ['event_list/' + id]: summary,
        ['event_keys/' + id + '/' + key]: true,
        ['event_proof/' + id]: key,
      });
    },
    update(id, key, doc, summary) {
      return this.proved('event_proof/' + id, {
        ['events/' + id + '/data']: JSON.stringify(doc),
        ['event_list/' + id]: summary,
        ['event_proof/' + id]: key,
      });
    },
    verify(id, key) {
      return this.proved('event_proof/' + id, { ['event_proof/' + id]: key, ['events/' + id + '/checkedAt']: Date.now() });
    },
    remove(id, key) {
      return this.proved('event_proof/' + id, { ['events/' + id]: null, ['event_list/' + id]: null, ['event_proof/' + id]: key });
    },
    async listApply(id) { return (await this.req('GET', 'event_apply/' + id)) || {}; },
    async listApplyLog(id) { return (await this.req('GET', 'event_apply_log/' + id)) || {}; },
    // 신청·수정·취소: 신청서 + 증명(신청자 키) + 이력 한 줄을 한 번에. 처음 신청 때는 비공개 키도 같이 남긴다.
    apply(id, bid, key, entry, log, first) {
      const p = {
        [`event_apply/${id}/${bid}`]: entry,
        [`apply_proof/${id}/${bid}`]: key,
        [`event_apply_log/${id}/${newId()}`]: log,
      };
      if (first) p[`apply_keys/${id}/${bid}/${key}`] = true;
      return this.proved(`apply_proof/${id}/${bid}`, p);
    },
  };

  // 같은 규칙을 흉내 내는 이 브라우저 전용 저장소 (Firebase 규칙 게시 전 미리보기용)
  const local = {
    shared: false,
    read() {
      let db = null;
      try { db = JSON.parse(localStorage.getItem(LOCAL)); } catch (e) { /* 새로 만듦 */ }
      return Object.assign({ events: {}, list: {}, keys: {}, apply: {}, applyKeys: {}, applyLog: {} }, db || {});
    },
    write(db) { localStorage.setItem(LOCAL, JSON.stringify(db)); },
    check(db, id, key) { if (db.keys[id] !== key) throw new WrongPassword('권한 없음'); },
    async list() { return this.read().list; },
    async get(id) { const e = this.read().events[id]; return e ? JSON.parse(e.data) : null; },
    async create(id, key, doc, summary) {
      const db = this.read();
      if (db.events[id]) throw new WrongPassword('이미 있는 글');
      db.events[id] = { data: JSON.stringify(doc) }; db.list[id] = summary; db.keys[id] = key;
      this.write(db);
    },
    async update(id, key, doc, summary) {
      const db = this.read(); this.check(db, id, key);
      db.events[id] = { data: JSON.stringify(doc) }; db.list[id] = summary;
      this.write(db);
    },
    async verify(id, key) { this.check(this.read(), id, key); },
    async remove(id, key) {
      const db = this.read(); this.check(db, id, key);
      delete db.events[id]; delete db.list[id]; delete db.keys[id];
      this.write(db);
    },
    async listApply(id) { return this.read().apply[id] || {}; },
    async listApplyLog(id) { return this.read().applyLog[id] || {}; },
    async apply(id, bid, key, entry, log, first) {
      const db = this.read();
      db.apply[id] = db.apply[id] || {};
      const k = id + '/' + bid;
      if (!db.events[id]) throw new WrongPassword('글 없음');
      if (first ? db.apply[id][bid] || db.applyKeys[k] : db.applyKeys[k] !== key) throw new WrongPassword('권한 없음');
      if (first) db.applyKeys[k] = key;
      if (entry) db.apply[id][bid] = entry; else delete db.apply[id][bid];
      db.applyLog[id] = Object.assign(db.applyLog[id] || {}, { [newId()]: log });
      this.write(db);
    },
  };

  // 이 브라우저 고유 번호. 같은 글에 한 번만 신청할 수 있게 신청 위치로 쓴다.
  function browserId() {
    const K = 'mandeuk_event_browser_id';
    let v = null;
    try { v = localStorage.getItem(K); } catch (e) { /* 저장 불가 */ }
    if (!v || !/^[a-z0-9]{12,32}$/.test(v)) {
      v = (newId() + newId()).slice(0, 20);
      try { localStorage.setItem(K, v); } catch (e) { /* 저장 불가 */ }
    }
    return v;
  }

  // 신청서 주인 증명: 글마다 이 브라우저에만 두는 비밀값 -> sha256. 비밀값을 잃으면(브라우저 데이터 삭제) 수정할 수 없다.
  async function applyKey(id, bid) {
    const K = 'mandeuk_apply_secret_' + id;
    let v = null;
    try { v = localStorage.getItem(K); } catch (e) { /* 저장 불가 */ }
    if (!v) {
      v = newId() + newId();
      try { localStorage.setItem(K, v); } catch (e) { /* 저장 불가 */ }
    }
    return hashKey(id + ':' + bid, v);
  }

  root.EventStore = { store: root.EVENT_SHARED ? remote : local, hashKey, newId, browserId, applyKey, WrongPassword };
})(this);
