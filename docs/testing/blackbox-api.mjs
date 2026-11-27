// Black-box API test for docs/testing/blackbox-test-cases.md.
// Plays 1-5 fake "phones" against a running server using only public Socket.IO events.
// Usage: npm run build:shared && npm run dev:server   (other terminal)
//        node docs/testing/blackbox-api.mjs [repoRoot] [serverUrl]
// Takes ~2 minutes (TC-27/42 waits for a real 60s time limit).
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const repo = process.argv[2] ?? new URL('../..', import.meta.url).pathname;
const require = createRequire(repo + '/package.json');
const { io } = require('socket.io-client');
const SERVER = process.argv[3] ?? 'http://localhost:3001';

const results = [];
const record = (id, pass, actual) => {
  results.push({ id, pass, actual });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${actual}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const phones = [];

function phone(name, url = SERVER) {
  const s = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const p = { s, id: randomUUID(), name, events: [], code: null };
  s.onAny((ev, payload) => p.events.push({ ev, payload }));
  p.mark = () => p.events.length;
  p.waitFor = (ev, pred = () => true, since = 0, timeout = 4000) =>
    new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const hit = p.events.slice(since).find((e) => e.ev === ev && pred(e.payload));
        if (hit) return resolve(hit.payload);
        if (Date.now() - t0 > timeout) return reject(new Error(`timeout waiting ${ev}`));
        setTimeout(tick, 10);
      };
      tick();
    });
  p.ack = (ev, payload) => s.timeout(4000).emitWithAck(ev, payload);
  p.join = async (roomCode, opts = {}) => {
    const res = await p.ack('JOIN_ROOM', { playerId: p.id, playerName: name, nickname: name, roomCode, ...opts });
    if (res.success) p.code = res.data.room.code;
    return res;
  };
  p.ready = (isReady = true) => p.ack('player:ready', { roomCode: p.code, playerId: p.id, isReady });
  p.start = (extra = {}) => p.ack('match:start', { roomCode: p.code, playerId: p.id, ...extra });
  p.leave = () => p.s.emit('room:leave', { roomCode: p.code, playerId: p.id });
  p.move = (height) =>
    p.s.emit('player:move', { roomCode: p.code, playerId: p.id, x: 0.5, height, action: 'CLIMB', clientTimestamp: Date.now() });
  p.connected = new Promise((r, j) => { s.on('connect', r); s.on('connect_error', j); });
  phones.push(p);
  return p;
}

async function room(n) {
  const ps = Array.from({ length: n }, (_, i) => phone(`P${i + 1}`));
  await Promise.all(ps.map((p) => p.connected));
  await ps[0].join();
  for (const p of ps.slice(1)) await p.join(ps[0].code);
  return ps;
}

async function startedRoom(n, settings) {
  const ps = await room(n);
  if (settings) await ps[0].ack('room:update_settings', { roomCode: ps[0].code, playerId: ps[0].id, settings });
  for (const p of ps.slice(1)) await p.ready(true);
  const marks = ps.map((p) => p.mark());
  const res = await ps[0].start();
  if (!res.success) throw new Error('start failed ' + JSON.stringify(res.error));
  const started = await Promise.all(ps.map((p, i) => p.waitFor('match:started', () => true, marks[i], 5000)));
  return { ps, started };
}

async function climb(p, to, from = 0) {
  for (let h = from + 10; h <= to; h += 10) { p.move(h); await sleep(100); } // 100 m/s < server cap 110 m/s
}

const run = async (id, fn) => {
  try { await fn(); } catch (e) { record(id, false, 'ERROR ' + e.message); }
};

// ---------------- 1. Nickname ----------------
await run('TC-01', async () => {
  const [a] = await room(1);
  const me = (await a.join()).data.room.players[0];
  record('TC-01', me.nickname === 'P1', `nickname server lưu = "${me.nickname}"`);
});
await run('TC-02', async () => {
  const a = phone(''); await a.connected;
  const r = await a.ack('JOIN_ROOM', { playerId: a.id, playerName: '', nickname: '' });
  record('TC-02', !r.success, `success=${r.success}, lỗi="${r.error?.message}"`);
});
await run('TC-03', async () => {
  const a = phone('   '); await a.connected;
  const r = await a.ack('JOIN_ROOM', { playerId: a.id, playerName: '     ', nickname: '     ' });
  record('TC-03', !r.success, `success=${r.success}, lỗi="${r.error?.message}"`);
});
await run('TC-04', async () => {
  const a = phone('abcdefghijklmnopqrst'); await a.connected;
  const r = await a.join();
  const nick = r.data.room.players[0].nickname;
  record('TC-04', nick === 'abcdefghijklmnopqrst', `nickname = "${nick}" (${nick.length} ký tự)`);
});
await run('TC-05', async () => {
  const long = 'x'.repeat(30);
  const a = phone(long); await a.connected;
  const r = await a.join();
  const nick = r.data.room.players[0].nickname;
  record('TC-05', nick.length <= 24, `gửi 30 ký tự (bỏ qua UI) → server cắt còn ${nick.length} ký tự`);
});
await run('TC-06', async () => {
  const a = phone('  Minh  '); await a.connected;
  const nick = (await a.join()).data.room.players[0].nickname;
  record('TC-06', nick === 'Minh', `nickname = "${nick}"`);
});

// ---------------- 2. Create / join room ----------------
await run('TC-08', async () => {
  const [a] = await room(1);
  const r = await a.join(); // same player re-creates
  const st = r.data.room;
  record('TC-08', /^[A-Z0-9]{4}$/.test(st.code) && st.hostId === a.id, `mã=${st.code}, host=${st.hostId === a.id}`);
});
await run('TC-09', async () => {
  const a = phone('gen'); await a.connected;
  const codes = new Set(); let bad = [];
  for (let i = 0; i < 100; i++) {
    const c = (await a.join()).data.room.code;
    codes.add(c);
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(c)) bad.push(c);
  }
  record('TC-09', bad.length === 0, `100 mã, ${codes.size} mã khác nhau, mã chứa 0/O/1/I: ${bad.length}`);
});
await run('TC-10', async () => {
  const a = phone('x'); await a.connected;
  const r = await a.join('AB2');
  record('TC-10', r.error?.code === 'INVALID_ROOM_CODE', `(server) mã 3 ký tự → ${r.error?.code}`);
});
await run('TC-11', async () => {
  const [a] = await room(1);
  const b = phone('B'); await b.connected;
  const m = a.mark();
  const r = await b.join(a.code);
  const upd = await a.waitFor('ROOM_UPDATED', (x) => x.room.players.some((p) => p.id === b.id), m);
  record('TC-11', r.success && upd.room.players.length === 2, `B vào ${r.data?.room.code}, A thấy ${upd.room.players.length} người`);
});
await run('TC-12', async () => {
  const a = phone('x'); await a.connected;
  const r = await a.join('AB2C3');
  record('TC-12', r.error?.code === 'INVALID_ROOM_CODE', `(server) mã 5 ký tự → ${r.error?.code}`);
});
await run('TC-13', async () => {
  const [a] = await room(1);
  const b = phone('B'); await b.connected;
  const r = await b.join(a.code.toLowerCase());
  record('TC-13', r.success, `nhập "${a.code.toLowerCase()}" → success=${r.success}`);
});
await run('TC-14', async () => {
  const a = phone('x'); await a.connected;
  const r = await a.join('0000');
  record('TC-14', r.error?.code === 'ROOM_NOT_FOUND', `"${r.error?.message}"`);
});
await run('TC-15', async () => {
  const { ps } = await startedRoom(2);
  const c = phone('C'); await c.connected;
  const r = await c.join(ps[0].code);
  record('TC-15', r.error?.code === 'GAME_ALREADY_STARTED', `"${r.error?.message}"`);
});
await run('TC-16', async () => {
  const dead = phone('x', 'http://localhost:3998');
  const ok = await dead.connected.then(() => false, () => true);
  record('TC-16', ok, `(socket) server tắt → connect_error=${ok}`);
});

// ---------------- 3. Player count ----------------
await run('TC-17', async () => {
  const [a] = await room(1);
  const r = await a.start();
  record('TC-17', r.error?.code === 'NOT_ENOUGH_PLAYERS', `(server) start 1 người → ${r.error?.code}`);
});
await run('TC-18', async () => {
  const [a, b] = await room(2);
  await b.ready(true);
  const r = await a.start();
  record('TC-18', r.success, `start 2 người sẵn sàng → success=${r.success}`);
});
await run('TC-19', async () => {
  const ps = await room(4);
  const st = (await ps[3].ready(true)).data;
  record('TC-19', st.players.length === 4, `${st.players.length}/${st.maxPlayers} người`);
});
await run('TC-20', async () => {
  const ps = await room(4);
  const e = phone('P5'); await e.connected;
  const r = await e.join(ps[0].code);
  record('TC-20', r.error?.code === 'ROOM_FULL', `"${r.error?.message}"`);
});
await run('TC-21', async () => {
  const [a, b, c] = await room(3);
  const m = b.mark();
  a.leave();
  const upd = await b.waitFor('ROOM_UPDATED', (x) => x.changeReason === 'HOST_TRANSFERRED', m);
  const newHost = upd.room.players.find((p) => p.isHost);
  record('TC-21', upd.room.hostId !== a.id && !!newHost && [b.id, c.id].includes(newHost.id), `host mới = ${newHost?.nickname}`);
});
await run('TC-22', async () => {
  const [a] = await room(1);
  const code = a.code;
  a.leave(); await sleep(100);
  const x = phone('x'); await x.connected;
  const r = await x.join(code);
  record('TC-22', r.error?.code === 'ROOM_NOT_FOUND', `vào lại ${code} → ${r.error?.code}`);
});

// ---------------- 4. Colour & settings ----------------
await run('TC-23', async () => {
  const ps = await room(4);
  const st = (await ps[3].ready(true)).data;
  const colours = st.players.map((p) => p.color);
  record('TC-23', new Set(colours).size === 4, `màu: ${colours.join(' ')}`);
});
await run('TC-24', async () => {
  const [a, b] = await room(2);
  const st = (await a.ready(true)).data;
  const aColour = st.players.find((p) => p.id === a.id).color;
  const r = await b.ack('player:select_color', { roomCode: b.code, playerId: b.id, color: aColour });
  record('TC-24', r.error?.code === 'COLOR_ALREADY_TAKEN', `(server) chọn màu của A → ${r.error?.code}`);
});
await run('TC-25', async () => {
  const [a, b] = await room(2);
  const m = a.mark();
  const r = await b.ack('player:select_color', { roomCode: b.code, playerId: b.id, color: '#EC4899' });
  const upd = await a.waitFor('ROOM_UPDATED', (x) => x.room.players.some((p) => p.id === b.id && p.color === '#EC4899'), m);
  record('TC-25', r.success && !!upd, `B đổi sang #EC4899, A nhận cập nhật`);
});
await run('TC-26', async () => {
  const [, b] = await room(2);
  const r = await b.ack('room:update_settings', { roomCode: b.code, playerId: b.id, settings: { timeLimitSec: 60 } });
  record('TC-26', r.error?.code === 'UNAUTHORIZED_NOT_HOST', `(server) khách đổi cài đặt → ${r.error?.code}`);
});
await run('TC-28', async () => {
  const { started } = await startedRoom(2, { enableIce: false, enableBoulders: false });
  const shared = require('@climb/shared');
  const s = started[0].config.settings;
  const steps = shared.generateMountainSteps(started[0].seed, started[0].targetHeight, s);
  const hazards = steps.filter((x) => x.type === 'SLIPPERY_LEDGE' || x.type === 'FALLING_ROCK').length;
  record('TC-28', !s.enableIce && !s.enableBoulders && hazards === 0, `settings gửi xuống ice=${s.enableIce} boulders=${s.enableBoulders}, bậc băng+đá = ${hazards}`);
});

// ---------------- 5. Decision table ----------------
await run('TC-29', async () => {
  const [, b] = await room(2);
  await b.ready(true);
  const r = await b.start();
  record('TC-29', r.error?.code === 'UNAUTHORIZED_NOT_HOST', `(server) khách bấm start → ${r.error?.code}`);
});
await run('TC-30', async () => {
  const [a] = await room(1);
  const r = await a.start();
  record('TC-30', r.error?.code === 'NOT_ENOUGH_PLAYERS', `(server) → ${r.error?.code}`);
});
await run('TC-31', async () => {
  const [a, b] = await room(2);
  await b.ready(false);
  const r = await a.start();
  record('TC-31', r.error?.code === 'NOT_ALL_PLAYERS_READY', `(server) → ${r.error?.code}`);
});
await run('TC-32', async () => {
  const [a, b] = await room(2);
  await b.ready(true);
  const m = b.mark();
  await a.start();
  const ticks = [];
  for (const sec of [3, 2, 1]) ticks.push((await b.waitFor('match:countdown', (x) => x.secondsRemaining === sec, m)).secondsRemaining);
  const [sa, sb] = await Promise.all([a.waitFor('match:started'), b.waitFor('match:started', () => true, m)]);
  record('TC-32', ticks.join() === '3,2,1' && sa.startTimestamp === sb.startTimestamp, `đếm ${ticks.join('-')}, startTimestamp giống nhau=${sa.startTimestamp === sb.startTimestamp}`);
});

// ---------------- 6. In match ----------------
await run('TC-33', async () => {
  const [a, b, c] = await room(3);
  await b.ready(true); await c.ready(true);
  const m = a.mark();
  await a.start();
  await a.waitFor('match:countdown', (x) => x.secondsRemaining === 3, m);
  c.leave();
  const upd = await a.waitFor('ROOM_UPDATED', (x) => x.changeReason === 'COUNTDOWN_ABORTED', m);
  await sleep(3500);
  const started = a.events.slice(m).some((e) => e.ev === 'match:started');
  record('TC-33', upd.room.phase === 'WAITING' && !started, `phase=${upd.room.phase}, vẫn vào trận=${started}`);
});
await run('TC-34', async () => {
  const { started } = await startedRoom(4);
  const shared = require('@climb/shared');
  const seeds = new Set(started.map((x) => x.seed));
  const maps = new Set(started.map((x) => JSON.stringify(shared.generateMountainSteps(x.seed, x.targetHeight, x.config.settings))));
  record('TC-34', seeds.size === 1 && maps.size === 1, `4 máy: ${seeds.size} seed, ${maps.size} bản đồ khác nhau`);
});
await run('TC-39', async () => {
  const { ps: [a, b] } = await startedRoom(2);
  const m = b.mark();
  const t0 = Date.now();
  a.move(10);
  const st = await b.waitFor('match:state', (x) => x.players.some((p) => p.id === a.id && p.height === 10), m);
  record('TC-39', !!st, `B thấy A ở 10m sau ${Date.now() - t0}ms`);
});
await run('TC-46', async () => {
  const { ps: [a, b] } = await startedRoom(2);
  a.move(200); // teleport cheat
  await sleep(300);
  const last = [...b.events].reverse().find((e) => e.ev === 'match:state');
  const h = last?.payload.players.find((p) => p.id === a.id)?.height ?? 0;
  record('TC-46', h === 0, `(chống gian lận) A gửi nhảy thẳng 200m → server giữ ${h}m`);
});
await run('TC-40/41/43', async () => {
  const { ps: [a, b, c] } = await startedRoom(3);
  const m = b.mark();
  await climb(a, 500);
  const fin = await b.waitFor('ROOM_UPDATED', (x) => x.changeReason === 'PLAYER_FINISHED', m, 8000);
  const ended = b.events.slice(m).some((e) => e.ev === 'match:finished');
  record('TC-40', fin.room.phase === 'PLAYING' && !ended, `A về đích, phase vẫn ${fin.room.phase}, trận kết thúc=${ended}`);
  await climb(b, 500);
  await climb(c, 200);
  c.leave(); // c bỏ cuộc, mọi người còn lại đã về đích
  const done = await a.waitFor('match:finished', () => true, 0, 8000);
  record('TC-41', done.reason === 'ALL_FINISHED', `match:finished reason=${done.reason}`);
  const order = done.rankings.map((r) => `${r.nickname}(${r.finishTimeMs ?? r.height + 'm'})`);
  record('TC-43', done.rankings[0].playerId === a.id && done.rankings[1].playerId === b.id, `xếp hạng: ${order.join(' > ')}`);
});
await run('TC-44', async () => {
  const { ps: [a, b] } = await startedRoom(2);
  await climb(a, 500); await climb(b, 500);
  await a.waitFor('match:finished', () => true, 0, 8000);
  const r = await a.ack('match:rematch', { roomCode: a.code, playerId: a.id });
  const guest = r.data.players.find((p) => p.id === b.id);
  record('TC-44', r.data.phase === 'WAITING' && r.data.players.every((p) => p.height === 0) && guest.isReady === false,
    `host bấm → phase=${r.data.phase}, độ cao tất cả = 0, khách isReady=${guest.isReady}`);
});
await run('TC-45', async () => {
  const { ps: [a, b] } = await startedRoom(2);
  await climb(a, 500); await climb(b, 500);
  await a.waitFor('match:finished', () => true, 0, 8000);
  const m = a.mark();
  const g = await b.ack('match:rematch', { roomCode: b.code, playerId: b.id });
  const upd = await a.waitFor('ROOM_UPDATED', (x) => x.changeReason === 'REMATCH_RESET', m);
  const outsider = phone('X'); await outsider.connected;
  const o = await outsider.ack('match:rematch', { roomCode: a.code, playerId: outsider.id });
  record('TC-45', g.success && upd.room.phase === 'WAITING' && upd.room.hostId === a.id && !o.success,
    `khách bấm → success=${g.success}, cả phòng về ${upd.room.phase}, host giữ nguyên; người ngoài phòng → "${o.error?.message}"`);
});
await run('TC-27/42', async () => {
  const { ps: [a, b] } = await startedRoom(2, { timeLimitSec: 60 });
  const t0 = Date.now();
  const done = await a.waitFor('match:finished', () => true, 0, 70_000);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  record('TC-27', Math.abs(sec - 60) < 1.5, `cài 60s → trận kết thúc sau ${sec}s`);
  record('TC-42', done.reason === 'TIME_LIMIT', `không ai về đích → reason=${done.reason}`);
  const r = await a.ack('room:update_settings', { roomCode: a.code, playerId: a.id, settings: { timeLimitSec: 300 } });
  await a.ack('match:rematch', { roomCode: a.code, playerId: a.id }).catch(() => {});
  const r2 = await a.ack('room:update_settings', { roomCode: a.code, playerId: a.id, settings: { timeLimitSec: 300 } });
  record('TC-27b', r2.success && r2.data.settings.timeLimitSec === 300, `cài 300s → settings.timeLimitSec=${r2.data?.settings.timeLimitSec} (khi đang FINISHED: ${r.error?.code ?? 'ok'})`);
  void b;
});

phones.forEach((p) => p.s.close());
const fail = results.filter((r) => !r.pass);
console.log(`\nTOTAL ${results.length}, PASS ${results.length - fail.length}, FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
