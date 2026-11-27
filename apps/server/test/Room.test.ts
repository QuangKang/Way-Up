import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIMBER_COLORS } from '@climb/shared';
import { Room } from '../src/rooms/Room';

const RED = CLIMBER_COLORS[0];
const BLUE = CLIMBER_COLORS[1];

const fullRoom = (): Room => {
  const room = new Room('abcd', 'p1', 'Host');
  room.addPlayer('p2', 'Two');
  room.addPlayer('p3', 'Three');
  room.addPlayer('p4', 'Four');
  return room;
};

describe('Room lobby', () => {
  test('host is created ready, code is upper-cased, name trimmed', () => {
    const room = new Room('abcd', 'p1', '  Host  ');
    const host = room.getPlayer('p1')!;
    assert.equal(room.code, 'ABCD');
    assert.equal(room.hostId, 'p1');
    assert.equal(host.isHost, true);
    assert.equal(host.isReady, true);
    assert.equal(host.nickname, 'Host');
  });

  test('accepts up to 4 players and rejects the 5th (ROOM_FULL)', () => {
    const room = fullRoom();
    assert.equal(room.getPlayerCount(), 4);
    assert.deepEqual(room.addPlayer('p5', 'Five'), { success: false, error: 'ROOM_FULL' });
    assert.equal(room.getPlayerCount(), 4);
  });

  test('re-joining with the same id updates the name instead of duplicating', () => {
    const room = new Room('ABCD', 'p1', 'Host');
    room.addPlayer('p2', 'Old');
    const res = room.addPlayer('p2', 'New');
    assert.equal(res.success, true);
    assert.equal(room.getPlayerCount(), 2);
    assert.equal(room.getPlayer('p2')!.nickname, 'New');
  });

  test('cannot join once the match is not WAITING', () => {
    const room = new Room('ABCD', 'p1', 'Host');
    room.phase = 'PLAYING';
    assert.deepEqual(room.addPlayer('p2', 'Late'), { success: false, error: 'GAME_ALREADY_STARTED' });
  });

  test('every player gets a distinct colour even if they ask for a taken one', () => {
    const room = new Room('ABCD', 'p1', 'Host', RED);
    room.addPlayer('p2', 'Two', RED);
    room.addPlayer('p3', 'Three', RED);
    room.addPlayer('p4', 'Four', 'not-a-colour');
    const colours = room.getAllPlayers().map((p) => p.color);
    assert.equal(colours[0], RED);
    assert.equal(new Set(colours).size, 4);
  });

  test('selectPlayerColor validates colour and ownership', () => {
    const room = new Room('ABCD', 'p1', 'Host', RED);
    room.addPlayer('p2', 'Two', BLUE);
    assert.deepEqual(room.selectPlayerColor('p2', RED), { success: false, error: 'COLOR_ALREADY_TAKEN' });
    assert.deepEqual(room.selectPlayerColor('p2', '#000000'), { success: false, error: 'INVALID_COLOR' });
    assert.deepEqual(room.selectPlayerColor('ghost', BLUE), { success: false, error: 'ROOM_NOT_FOUND' });
    assert.deepEqual(room.selectPlayerColor('p2', CLIMBER_COLORS[2]), { success: true });
  });

  test('only the host can change settings, and values are clamped', () => {
    const room = new Room('ABCD', 'p1', 'Host');
    room.addPlayer('p2', 'Two');
    assert.deepEqual(room.updateSettings('p2', { timeLimitSec: 100 }), {
      success: false,
      error: 'UNAUTHORIZED_NOT_HOST'
    });
    assert.deepEqual(room.updateSettings('p1', { timeLimitSec: 9999, enableIce: false }), { success: true });
    assert.equal(room.settings.timeLimitSec, 300);
    assert.equal(room.settings.enableIce, false);
  });

  test('canStart checks host, player count and readiness in order', () => {
    const room = new Room('ABCD', 'p1', 'Host');
    assert.equal(room.canStart('p1').error, 'NOT_ENOUGH_PLAYERS');
    room.addPlayer('p2', 'Two');
    assert.equal(room.canStart('p2').error, 'UNAUTHORIZED_NOT_HOST');
    assert.equal(room.canStart('p1').error, 'NOT_ALL_PLAYERS_READY');
    room.setPlayerReady('p2', true);
    assert.deepEqual(room.canStart('p1'), { canStart: true });
  });

  test('host leaving promotes the next player; last player leaving empties room', () => {
    const room = new Room('ABCD', 'p1', 'Host');
    room.addPlayer('p2', 'Two');
    const r1 = room.removePlayer('p1');
    assert.equal(r1.wasHost, true);
    assert.equal(r1.newHostId, 'p2');
    assert.equal(room.getPlayer('p2')!.isHost, true);
    assert.equal(room.removePlayer('p2').isEmpty, true);
  });
});

describe('Room match (fake clock)', () => {
  const noop = () => {};
  let room: Room;
  let started: number;

  const startMatch = (targetHeight = 100): void => {
    room = new Room('ABCD', 'p1', 'Host');
    room.addPlayer('p2', 'Two');
    room.setPlayerReady('p2', true);
    started = 0;
    room.beginCountdown({ onTick: noop, onStarted: () => started++, onTimeLimit: noop }, targetHeight);
    mock.timers.tick(3000);
  };

  const move = (playerId: string, height: number) =>
    room.applyPlayerMove({ playerId, x: 0.5, height } as never);

  beforeEach(() => mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 1_000_000 }));
  afterEach(() => {
    room?.dispose();
    mock.timers.reset();
  });

  test('countdown ticks 3s then switches to PLAYING with a seed', () => {
    room = new Room('ABCD', 'p1', 'Host');
    room.addPlayer('p2', 'Two');
    const ticks: number[] = [];
    let startedCount = 0;
    room.beginCountdown({
      onTick: (p) => ticks.push(p.secondsRemaining),
      onStarted: () => startedCount++,
      onTimeLimit: noop
    });
    assert.equal(room.phase, 'COUNTDOWN');
    mock.timers.tick(2999);
    assert.equal(startedCount, 0);
    mock.timers.tick(1);
    assert.deepEqual(ticks, [3, 2, 1]);
    assert.equal(startedCount, 1);
    assert.equal(room.phase, 'PLAYING');
    assert.equal(room.targetHeight, 500);
  });

  test('target height outside [100, 5000] falls back to default', () => {
    startMatch(99);
    assert.equal(room.targetHeight, 500);
    room.dispose();
    startMatch(5001);
    assert.equal(room.targetHeight, 500);
    room.dispose();
    startMatch(100);
    assert.equal(room.targetHeight, 100);
  });

  test('player leaving during countdown aborts it', () => {
    room = new Room('ABCD', 'p1', 'Host');
    room.addPlayer('p2', 'Two');
    room.addPlayer('p3', 'Three');
    room.beginCountdown({ onTick: noop, onStarted: noop, onTimeLimit: noop });
    assert.equal(room.removePlayer('p3').countdownAborted, true);
    assert.equal(room.phase, 'WAITING');
    mock.timers.tick(5000);
    assert.equal(room.phase, 'WAITING');
  });

  test('moves are rejected before the match starts', () => {
    room = new Room('ABCD', 'p1', 'Host');
    assert.equal(move('p1', 10).reason, 'ROOM_NOT_PLAYING');
  });

  test('anti-cheat: a single jump above 60m is rejected', () => {
    startMatch(500);
    assert.equal(move('p1', 60).accepted, true);
    mock.timers.tick(1000);
    assert.equal(move('p1', 121).reason, 'UPWARD_TELEPORT_REJECTED');
  });

  test('anti-cheat: burst allowance drains and refills over time', () => {
    startMatch(500);
    assert.equal(move('p1', 50).accepted, true); // allowance 80 -> 30
    assert.equal(move('p1', 90).reason, 'UPWARD_TELEPORT_REJECTED'); // +40 > 30
    mock.timers.tick(1000); // refills (capped at 80)
    assert.equal(move('p1', 90).accepted, true);
  });

  test('non-finite coordinates are rejected; moving down is always allowed', () => {
    startMatch(500);
    assert.equal(move('p1', NaN).reason, 'NON_FINITE_COORDINATES');
    move('p1', 40);
    assert.equal(move('p1', 0).accepted, true);
    assert.equal(room.getPlayer('p1')!.height, 0);
  });

  test('reaching the target finishes the player and locks further moves', () => {
    startMatch(100);
    move('p1', 50);
    mock.timers.tick(1000);
    const res = move('p1', 100);
    assert.equal(res.reachedTarget, true);
    assert.equal(res.allFinished, false);
    const p1 = room.getPlayer('p1')!;
    assert.equal(p1.status, 'FINISHED');
    assert.equal(p1.finishTimeMs, 1000);
    assert.equal(move('p1', 50).reason, 'PLAYER_NOT_ACTIVE');
  });

  test('rankings: finishers by time, then the rest by height', () => {
    startMatch(100);
    move('p1', 30);
    move('p2', 50);
    mock.timers.tick(1000);
    move('p2', 100); // p2 finishes first
    const result = room.finishMatch('TIME_LIMIT');
    assert.deepEqual(result.rankings.map((r) => r.playerId), ['p2', 'p1']);
    assert.equal(result.winnerId, 'p2');
    assert.equal(room.phase, 'FINISHED');
  });

  test('rematch resets positions and guest readiness', () => {
    startMatch(100);
    move('p2', 50);
    room.finishMatch('TIME_LIMIT');
    room.resetForRematch();
    assert.equal(room.phase, 'WAITING');
    assert.equal(room.getPlayer('p2')!.height, 0);
    assert.equal(room.getPlayer('p2')!.isReady, false);
    assert.equal(room.getPlayer('p1')!.isReady, true);
  });
});
