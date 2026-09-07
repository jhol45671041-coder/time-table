/**
 * Engine test-suite — run with `npm test` (Node's built-in runner, no deps).
 *
 * The point of these tests is to prove the automation is *trustworthy*:
 * every generated timetable must satisfy every hard constraint, the auditor
 * must actually catch violations, and pinned lessons must survive a rebuild.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildModel,
  schedule,
  validate,
  computeMetrics,
  diagnose,
  canMove,
  applyMove,
  mulberry32,
} from '../js/scheduler.js';
import { demoData, randomSchool } from '../js/seed.js';

const HARD_TYPES = new Set([
  'class-double-booked',
  'teacher-double-booked',
  'room-double-booked',
  'teacher-unavailable',
  'teacher-overload',
  'room-too-small',
  'room-type',
  'break-slot',
  'subject-per-day',
  'lock-moved',
  'lock-dropped',
]);

test('demo school: every lesson is placed with zero conflicts', () => {
  const model = buildModel(demoData());
  const result = schedule(model, { seed: 1234, timeBudgetMs: 800 });

  assert.equal(result.unplaced.length, 0, `unplaced: ${JSON.stringify(result.unplaced.map((l) => l.id))}`);
  assert.equal(result.placements.length, model.lessons.length);
  assert.deepEqual(result.conflicts, []);
  assert.ok(result.metrics.quality >= 90, `quality was ${result.metrics.quality}`);
});

test('demo school: weekly quota is met exactly for every class + subject', () => {
  const data = demoData();
  const model = buildModel(data);
  const result = schedule(model, { seed: 99, timeBudgetMs: 800 });

  for (const klass of data.classes) {
    for (const subject of data.subjects) {
      const periods = result.placements
        .filter((p) => p.classId === klass.id && p.subjectId === subject.id)
        .reduce((sum, p) => sum + p.length, 0);
      assert.equal(periods, subject.weeklyPeriods, `${subject.name} for ${klass.name}`);
    }
  }
});

test('demo school: no idle holes inside a class day', () => {
  const model = buildModel(demoData());
  const result = schedule(model, { seed: 7, timeBudgetMs: 800 });
  assert.ok(result.metrics.classHoles <= 1, `classHoles = ${result.metrics.classHoles}`);
});

test('breaks and lunch are never taught in', () => {
  const data = demoData();
  const model = buildModel(data);
  const result = schedule(model, { seed: 5, timeBudgetMs: 800 });
  const periodByKey = new Map(data.settings.periods.map((p) => [p.key, p]));

  for (const placement of result.placements) {
    for (const slotKey of placement.slotKeys) {
      const periodKey = slotKey.split('@')[1];
      assert.equal(periodByKey.get(periodKey).kind, 'lesson', `${slotKey} is not a teaching slot`);
    }
  }
});

test('the same seed always produces the same timetable', () => {
  const model = buildModel(demoData());
  const a = schedule(model, { seed: 424242, timeBudgetMs: 400 });
  const b = schedule(model, { seed: 424242, timeBudgetMs: 400 });
  assert.deepEqual(
    a.placements.map((p) => [p.lessonId, p.startSlotKey, p.roomId]),
    b.placements.map((p) => [p.lessonId, p.startSlotKey, p.roomId]),
  );
});

test('locked lessons stay exactly where they were pinned', () => {
  const data = demoData();
  const baseline = schedule(buildModel(data), { seed: 31337, timeBudgetMs: 600 });
  const model0 = buildModel(data);

  // Pick lessons that cannot possibly contradict each other: distinct classes,
  // distinct teachers, and each pinned to a different day.
  const usedClasses = new Set();
  const usedTeachers = new Set();
  const picks = [];
  for (const placement of baseline.placements) {
    if (usedClasses.has(placement.classId)) continue;
    if (placement.teacherId && usedTeachers.has(placement.teacherId)) continue;
    usedClasses.add(placement.classId);
    if (placement.teacherId) usedTeachers.add(placement.teacherId);
    picks.push(placement);
    if (picks.length === Math.min(4, model0.days.length)) break;
  }

  data.locks = picks.map((placement, i) => {
    const day = model0.days[i];
    const slot = model0.daySlots.get(day.id)[0];
    return { lessonId: placement.lessonId, slotKey: slot.key, dayId: day.id };
  });
  assert.ok(data.locks.length >= 3, 'test needs a few pinnable lessons');

  const result = schedule(buildModel(data), { seed: 2, timeBudgetMs: 900 });

  assert.deepEqual(result.lockViolations, [], 'these pins are mutually compatible');
  for (const lock of data.locks) {
    const placement = result.placements.find((p) => p.lessonId === lock.lessonId);
    assert.ok(placement, `locked lesson ${lock.lessonId} was not placed`);
    assert.equal(placement.startSlotKey, lock.slotKey, `locked lesson ${lock.lessonId} moved`);
    assert.equal(placement.locked, true, 'placement should be flagged as locked');
  }
  assert.deepEqual(result.conflicts.filter((c) => HARD_TYPES.has(c.type)), []);
  assert.equal(result.unplaced.length, 0, 'the rest of the week still fits around the pins');
});

test('contradictory pins are reported, not silently satisfied', () => {
  const data = demoData();
  const model0 = buildModel(data);
  const sameTeacher = model0.lessons.filter(
    (l) => l.teacherId && l.teacherId === model0.lessons.find((x) => x.teacherId).teacherId,
  ).slice(0, 2);
  const slot = model0.daySlots.get(model0.days[0].id)[0];

  data.locks = sameTeacher.map((lesson) => ({
    lessonId: lesson.id,
    slotKey: slot.key,
    dayId: slot.day.id,
  }));

  const result = schedule(buildModel(data), { seed: 4, timeBudgetMs: 700 });
  assert.equal(result.lockViolations.length, 1, 'exactly one of the two pins must be rejected');
  assert.match(result.lockViolations[0].reason, /taken|breaks a rule/i);
  assert.deepEqual(result.conflicts.filter((c) => HARD_TYPES.has(c.type)), []);
  assert.ok(result.diagnostics.some((d) => d.title.includes('pinned')));
});

test('the auditor catches a hand-made clash', () => {
  const model = buildModel(demoData());
  const result = schedule(model, { seed: 8, timeBudgetMs: 600 });
  assert.deepEqual(result.conflicts, []);

  // Force two lessons of the same teacher into the same slot.
  const broken = { ...result, placements: [...result.placements] };
  const victim = broken.placements.find((p) => p.teacherId && p.lessonId !== broken.placements[0].lessonId);
  const target = broken.placements.find((p) => p.teacherId === victim.teacherId && p !== victim);
  broken.placements[broken.placements.indexOf(target)] = {
    ...target,
    dayId: victim.dayId,
    slotKeys: [...victim.slotKeys],
    startSlotKey: victim.startSlotKey,
  };

  const conflicts = validate(model, broken);
  assert.ok(
    conflicts.some((c) => c.type === 'teacher-double-booked'),
    `expected a teacher clash, got ${JSON.stringify(conflicts.map((c) => c.type))}`,
  );
});

test('the auditor catches teaching during a break', () => {
  const data = demoData();
  const model = buildModel(data);
  const result = schedule(model, { seed: 11, timeBudgetMs: 500 });
  const breakSlot = model.slots.find((s) => !s.teaching);
  assert.ok(breakSlot, 'demo data should contain a break');

  const broken = { ...result, placements: [...result.placements] };
  broken.placements[0] = {
    ...broken.placements[0],
    dayId: breakSlot.day.id,
    slotKeys: [breakSlot.key],
    startSlotKey: breakSlot.key,
  };
  assert.ok(validate(model, broken).some((c) => c.type === 'break-slot'));
});

test('an impossible dataset reports the reason instead of failing silently', () => {
  const data = demoData();
  // Shrink the music room so no class fits any more.
  data.rooms = data.rooms.map((room) => (room.id === 'r-music' ? { ...room, capacity: 4 } : room));

  const model = buildModel(data);
  const result = schedule(model, { seed: 3, timeBudgetMs: 700 });

  assert.ok(result.unplaced.length > 0, 'expected unplaceable lessons');
  assert.ok(result.diagnostics.some((d) => d.severity === 'error' && d.hint));
  assert.deepEqual(result.conflicts.filter((c) => HARD_TYPES.has(c.type)), [], 'never break a rule to fit');
});

test('manual moves are validated and applied', () => {
  const data = demoData();
  const model = buildModel(data);
  const result = schedule(model, { seed: 77, timeBudgetMs: 600 });

  const placement = result.placements.find((p) => p.length === 1);
  const current = placement.startSlotKey;

  // Illegal target: the slot already occupied by another lesson of that class.
  const busy = result.placements.find(
    (p) => p.classId === placement.classId && p.startSlotKey !== current,
  );
  const blocked = canMove(model, result, placement.lessonId, busy.startSlotKey);
  assert.equal(blocked.ok, false);

  // Legal target: any slot the engine says is fine.
  const free = model.slots.find((slot) => slot.teaching && canMove(model, result, placement.lessonId, slot.key).ok);
  assert.ok(free, 'there should be at least one free slot');
  const moved = applyMove(model, result, placement.lessonId, free.key);
  assert.equal(moved.error, undefined);
  assert.deepEqual(moved.conflicts.filter((c) => HARD_TYPES.has(c.type)), []);
  assert.equal(
    moved.placements.find((p) => p.lessonId === placement.lessonId).startSlotKey,
    free.key,
  );
});

test('random schools of many shapes all come out conflict-free', () => {
  const shapes = [
    { classes: 2, teachers: 6, subjects: 5, days: 3, periods: 5, seed: 1 },
    { classes: 4, teachers: 9, subjects: 7, days: 4, periods: 6, seed: 2 },
    { classes: 6, teachers: 12, subjects: 9, days: 5, periods: 7, seed: 3 },
    { classes: 8, teachers: 16, subjects: 11, days: 5, periods: 8, seed: 4 },
    { classes: 5, teachers: 10, subjects: 8, days: 6, periods: 6, seed: 5 },
    { classes: 10, teachers: 18, subjects: 12, days: 5, periods: 8, seed: 6 },
    { classes: 3, teachers: 8, subjects: 6, days: 5, periods: 4, seed: 7 },
    { classes: 7, teachers: 14, subjects: 10, days: 4, periods: 8, seed: 8 },
  ];

  for (const shape of shapes) {
    const data = randomSchool(shape);
    const model = buildModel(data);
    const result = schedule(model, { seed: shape.seed * 977, timeBudgetMs: 900 });

    const hard = result.conflicts.filter((c) => HARD_TYPES.has(c.type));
    assert.deepEqual(hard, [], `${JSON.stringify(shape)} produced ${JSON.stringify(hard)}`);
    assert.equal(
      result.unplaced.length,
      0,
      `${JSON.stringify(shape)} left ${result.unplaced.length} lessons unplaced`,
    );
    assert.equal(result.placements.length, model.lessons.length);
    assert.ok(result.metrics.quality >= 80, `${JSON.stringify(shape)} quality ${result.metrics.quality}`);
  }
});

test('teacher availability and daily maxima are respected on random data', () => {
  const data = randomSchool({ classes: 6, teachers: 12, subjects: 9, days: 5, periods: 7, seed: 4242 });
  const model = buildModel(data);
  const result = schedule(model, { seed: 21, timeBudgetMs: 800 });

  for (const placement of result.placements) {
    if (!placement.teacherId) continue;
    const teacher = data.teachers.find((t) => t.id === placement.teacherId);
    for (const slotKey of placement.slotKeys) {
      assert.ok(!teacher.unavailable.includes(slotKey), `${teacher.name} booked while unavailable`);
    }
  }

  const perDay = new Map();
  for (const placement of result.placements) {
    if (!placement.teacherId) continue;
    const key = `${placement.teacherId}|${placement.dayId}`;
    perDay.set(key, (perDay.get(key) || 0) + placement.length);
  }
  for (const [key, count] of perDay) {
    const teacher = data.teachers.find((t) => t.id === key.split('|')[0]);
    assert.ok(count <= teacher.maxPeriodsPerDay, `${teacher.name} teaches ${count} > ${teacher.maxPeriodsPerDay}`);
  }
});

test('metrics agree with an independent recount', () => {
  const model = buildModel(demoData());
  const result = schedule(model, { seed: 555, timeBudgetMs: 600 });
  const metrics = computeMetrics(model, result);

  assert.equal(metrics.placed, result.placements.length);
  assert.equal(metrics.periods, result.placements.reduce((s, p) => s + p.length, 0));
  assert.equal(metrics.conflicts, validate(model, result).length);
  assert.ok(metrics.quality >= 0 && metrics.quality <= 100);
  assert.ok(metrics.utilisation > 0 && metrics.utilisation <= 1);
});

test('diagnose is silent when everything is fine and loud when it is not', () => {
  const good = schedule(buildModel(demoData()), { seed: 909, timeBudgetMs: 600 });
  assert.ok(good.diagnostics.some((d) => d.severity === 'ok'));
  assert.ok(!good.diagnostics.some((d) => d.severity === 'error'));

  const data = demoData();
  data.rooms = data.rooms.map((r) => (r.type === 'lab' ? { ...r, capacity: 2 } : r));
  const bad = schedule(buildModel(data), { seed: 909, timeBudgetMs: 600 });
  assert.ok(bad.diagnostics.some((d) => d.severity === 'error'));
  assert.ok(bad.diagnostics.filter((d) => d.severity === 'error').every((d) => d.hint));
});

test('mulberry32 is deterministic and well distributed', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  const xs = Array.from({ length: 5 }, () => a());
  const ys = Array.from({ length: 5 }, () => b());
  assert.deepEqual(xs, ys);
  assert.ok(xs.every((v) => v >= 0 && v < 1));
  assert.equal(new Set(xs).size, xs.length);
});
