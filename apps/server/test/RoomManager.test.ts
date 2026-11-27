import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/rooms/RoomManager';
import { CONFIG } from '../src/config';

// RoomManager is a process-wide singleton, so every test uses unique player ids.
const manager = RoomManager.getInstance();
let n = 0;
const uid = (): string => `player-${++n}`;

test('getInstance always returns the same manager', () => {
  assert.equal(RoomManager.getInstance(), manager);
});

test('room codes are 4 chars from the unambiguous alphabet and unique', () => {
  const codes = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const code = manager.createRoom(uid(), 'Host').code;
    assert.match(code, new RegExp(`^[${CONFIG.ROOM_CODE_CHARS}]{4}$`));
    codes.add(code);
  }
  assert.equal(codes.size, 200);
});

test('empty or blank code creates a new room with the player as host', () => {
  const id = uid();
  const res = manager.joinOrCreateRoom(id, 'Host', '   ');
  assert.equal(res.success, true);
  assert.equal(res.room!.hostId, id);
  assert.equal(manager.getRoomByPlayerId(id), res.room);
});

test('joining is case-insensitive and trims whitespace', () => {
  const host = manager.createRoom(uid(), 'Host');
  const res = manager.joinOrCreateRoom(uid(), 'Guest', ` ${host.code.toLowerCase()} `);
  assert.equal(res.success, true);
  assert.equal(res.room, host);
  assert.equal(host.getPlayerCount(), 2);
});

test('code with wrong length is INVALID_ROOM_CODE', () => {
  assert.deepEqual(manager.joinOrCreateRoom(uid(), 'G', 'ABC'), { success: false, error: 'INVALID_ROOM_CODE' });
  assert.deepEqual(manager.joinOrCreateRoom(uid(), 'G', 'ABCDE'), { success: false, error: 'INVALID_ROOM_CODE' });
});

test('unknown code is ROOM_NOT_FOUND', () => {
  // '0' is excluded from the alphabet, so this code can never exist.
  assert.deepEqual(manager.joinOrCreateRoom(uid(), 'G', '0000'), { success: false, error: 'ROOM_NOT_FOUND' });
});

test('5th player gets ROOM_FULL from the manager', () => {
  const room = manager.createRoom(uid(), 'Host');
  for (let i = 0; i < 3; i++) manager.joinOrCreateRoom(uid(), 'G', room.code);
  const fifth = uid();
  assert.deepEqual(manager.joinOrCreateRoom(fifth, 'G', room.code), { success: false, error: 'ROOM_FULL' });
  assert.equal(manager.getRoomByPlayerId(fifth), undefined);
});

test('joining another room leaves the previous one', () => {
  const a = manager.createRoom(uid(), 'A');
  const b = manager.createRoom(uid(), 'B');
  const guest = uid();
  manager.joinOrCreateRoom(guest, 'G', a.code);
  manager.joinOrCreateRoom(guest, 'G', b.code);
  assert.equal(a.hasPlayer(guest), false);
  assert.equal(b.hasPlayer(guest), true);
  assert.equal(manager.getRoomByPlayerId(guest), b);
});

test('last player leaving deletes the room', () => {
  const host = uid();
  const room = manager.createRoom(host, 'Host');
  const before = manager.getTotalRoomsCount();
  assert.equal(manager.leaveCurrentRoom(host).roomDeleted, true);
  assert.equal(manager.getRoom(room.code), undefined);
  assert.equal(manager.getTotalRoomsCount(), before - 1);
});

test('leaving when not in a room is a no-op', () => {
  assert.deepEqual(manager.leaveCurrentRoom('nobody'), {});
});
