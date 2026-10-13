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
      return this.req('PATCH', '', {
        ['events/' + id + '/data']: JSON.stringify(doc),
        ['event_list/' + id]: summary,
        ['event_proof/' + id]: key,
      });
    },
    verify(id, key) {
      return this.req('PATCH', '', { ['event_proof/' + id]: key, ['events/' + id + '/checkedAt']: Date.now() });
    },
    remove(id, key) {
      return this.req('PATCH', '', { ['events/' + id]: null, ['event_list/' + id]: null, ['event_proof/' + id]: key });
    },
  };

  // 같은 규칙을 흉내 내는 이 브라우저 전용 저장소 (Firebase 규칙 게시 전 미리보기용)
  const local = {
    shared: false,
    read() { try { return JSON.parse(localStorage.getItem(LOCAL)) || { events: {}, list: {}, keys: {} }; } catch (e) { return { events: {}, list: {}, keys: {} }; } },
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
  };

  root.EventStore = { store: root.EVENT_SHARED ? remote : local, hashKey, newId, WrongPassword };
})(this);
