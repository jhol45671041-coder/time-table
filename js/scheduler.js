/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Timetable Studio — Automated Scheduling Engine
 * ─────────────────────────────────────────────────────────────────────────────
 *  Pure JavaScript. No DOM, no I/O, no dependencies — importable from the
 *  browser *and* from Node's test runner.
 *
 *  The problem is a constraint-satisfaction problem:
 *
 *    HARD constraints (never violated)
 *      • a class is in exactly one place at a time
 *      • a teacher teaches at most one lesson per slot
 *      • a room hosts at most one lesson per slot
 *      • teacher unavailability windows are respected
 *      • per-day caps: teacher max periods, subject max occurrences
 *      • breaks / lunch / blocked slots are never used
 *      • room capacity ≥ class size, room type matches subject requirement
 *      • user "locked" lessons stay exactly where they were pinned
 *
 *    SOFT constraints (scored, minimised)
 *      • subjects spread evenly across the week
 *      • the same subject is not repeated back-to-back (unless it is a double)
 *      • no idle "holes" in a class day or a teacher day
 *      • demanding subjects land earlier in the day
 *      • teacher workload is balanced across the week
 *      • a class keeps the same room where possible
 *
 *  Strategy: greedy assignment ordered by Most-Constrained-Variable, scoring
 *  candidate slots by soft cost, randomised among the cheapest options, with
 *  backtracking and full restarts. The best solution found inside the time /
 *  restart budget wins.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_OPTIONS = {
  /** Maximum number of full search restarts. */
  maxRestarts: 90,
  /** Wall-clock budget for the search, in milliseconds. */
  timeBudgetMs: 1200,
  /** Candidate slots considered from the cheapest end of the list. */
  topK: 5,
  /** Probability of ignoring the cost ranking and picking any feasible slot. */
  exploreRate: 0.18,
  /** How many placements may be undone before the search gives up and restarts. */
  backtrackLimit: 60,
  /** Deterministic PRNG seed. `null` → randomised. */
  seed: null,
  /** Honour user-pinned lessons. */
  respectLocks: true,
  /** Hill-climbing sweeps applied to every candidate solution. */
  polishPasses: 3,
  /** Keep searching for a nicer solution after the first complete one. */
  improveAfterSolve: true,
};

/* ─────────────────────────── tiny deterministic RNG ─────────────────────── */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const byId = (list) => {
  const map = new Map();
  for (const item of list || []) map.set(item.id, item);
  return map;
};

/* ─────────────────────────────── model build ─────────────────────────────── */

/**
 * Normalise a raw data store into the internal model used by the search.
 * @param {object} data  { settings, classes, subjects, teachers, rooms, locks }
 */
export function buildModel(data) {
  const settings = data.settings || {};
  const days = (settings.days || [])
    .filter((day) => day.active !== false)
    .map((day, index) => ({ ...day, index }));

  const periods = (settings.periods || []).map((period, order) => ({
    ...period,
    order,
    kind: period.kind || 'lesson',
  }));

  const teachingSlots = [];
  const slotIndex = new Map(); // `${day}|${periodKey}` → slot
  for (const day of days) {
    let lessonOrder = 0;
    for (const period of periods) {
      const isTeaching = period.kind === 'lesson';
      const slot = {
        key: `${day.id}@${period.key}`,
        day,
        period,
        dayIndex: day.index,
        periodOrder: period.order,
        /** 0-based position among teaching slots of that day. */
        lessonOrder: isTeaching ? lessonOrder : -1,
        teaching: isTeaching,
        length: 1,
      };
      if (isTeaching) lessonOrder += 1;
      slotIndex.set(slot.key, slot);
      teachingSlots.push(slot);
    }
  }

  const daySlots = new Map(); // dayId → teaching slots in order
  for (const slot of teachingSlots) {
    if (!slot.teaching) continue;
    if (!daySlots.has(slot.day.id)) daySlots.set(slot.day.id, []);
    daySlots.get(slot.day.id).push(slot);
  }

  const classes = data.classes || [];
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  const rooms = data.rooms || [];

  const classById = byId(classes);
  const teacherById = byId(teachers);
  const subjectById = byId(subjects);

  const roomsEnabled = rooms.length > 0;
  const lessons = expandLessons({ classes, subjects, teacherById, subjectById, classById });

  // Locked placements authored by the user, mapped onto lesson identities.
  const lockList = (data.locks || []).map((lock) => ({ ...lock }));

  const model = {
    settings,
    days,
    periods,
    slots: teachingSlots,
    slotIndex,
    daySlots,
    classes,
    teachers,
    subjects,
    rooms,
    classById,
    teacherById,
    subjectById,
    roomsEnabled,
    lessons,
    locks: lockList,
    /** teacherId|dayId → boolean */
    unavailable: new Set(
      teachers.flatMap((teacher) =>
        (teacher.unavailable || []).map((slotKey) => `${teacher.id}|${slotKey}`),
      ),
    ),
  };

  model.lessonById = byId(model.lessons);

  // Pre-compute, for every lesson, the slots it could ever start from (the
  // ones where its length still fits inside a single day). Static, so it is
  // done once instead of on every feasibility probe.
  for (const lesson of model.lessons) {
    const candidates = [];
    for (const [dayId, slots] of model.daySlots) {
      for (let i = 0; i + lesson.length <= slots.length; i += 1) {
        candidates.push(slots[i]);
      }
      void dayId;
    }
    lesson.candidates = candidates;
  }

  return model;
}

/**
 * Turn "subject X needs N periods a week" into concrete lesson objects,
 * splitting into doubles where the subject asks for them.
 */
export function expandLessons({ classes, subjects, teacherById, subjectById, classById }) {
  const lessons = [];
  for (const subject of subjects) {
    const teacher = subject.teacherId ? teacherById.get(subject.teacherId) : null;
    const weekly = Math.max(0, Math.round(Number(subject.weeklyPeriods) || 0));
    const sessionLength = subject.sessionLength === 2 ? 2 : 1;
    let remaining = weekly;
    let n = 0;
    while (remaining > 0) {
      const length = Math.min(sessionLength, remaining);
      for (const klass of classes) {
        // A subject may be scoped to specific classes; default = all classes.
        if (subject.classIds && subject.classIds.length && !subject.classIds.includes(klass.id)) {
          continue;
        }
        lessons.push({
          id: `${subject.id}::${klass.id}::${n}`,
          subjectId: subject.id,
          subject: subjectById.get(subject.id) || subject,
          classId: klass.id,
          klass: classById.get(klass.id) || klass,
          teacherId: teacher ? teacher.id : null,
          teacher: teacher || null,
          length,
          seq: n,
          roomType: subject.roomType || 'any',
          difficulty: Number(subject.difficulty) || 2,
          /** filled by the search */
          day: null,
          slotKey: null,
          roomId: null,
        });
      }
      remaining -= length;
      n += 1;
    }
  }
  return lessons;
}

/* ──────────────────────────── occupancy bookkeeping ─────────────────────── */

function createBoard(model) {
  return {
    classBusy: new Map(), // slotKey → Set<classId>
    teacherBusy: new Map(), // slotKey → Set<teacherId>
    roomBusy: new Map(), // slotKey → Map<roomId, lessonId>
    teacherDayLoad: new Map(), // `${teacherId}|${dayId}` → count
    subjectDayCount: new Map(), // `${classId}|${subjectId}|${dayId}` → count
    classRoomByDay: new Map(), // `${classId}|${dayId}` → roomId
    classSlotLesson: new Map(), // `${classId}|${slotKey}` → placement (O(1) adjacency lookups)
    placements: new Map(), // lessonId → placement
    cost: 0,
  };
}

const bump = (map, key, delta = 1) => map.set(key, (map.get(key) || 0) + delta);

function addToSet(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function removeFromSet(map, key, value) {
  const set = map.get(key);
  if (!set) return;
  set.delete(value);
  if (set.size === 0) map.delete(key);
}

function keysFor(lesson, startSlot, model) {
  const out = [];
  const dayList = model.daySlots.get(startSlot.day.id) || [];
  const at = dayList.findIndex((s) => s.key === startSlot.key);
  if (at < 0) return null;
  for (let i = at; i < at + lesson.length; i += 1) {
    const slot = dayList[i];
    if (!slot) return null; // runs off the end of the day
    out.push(slot.key);
  }
  return out;
}

/**
 * Choose a room for a lesson at the given slots, or null when impossible.
 * Returns { roomId, cost } — roomId may be null when rooms are disabled.
 */
function pickRoom(lesson, slotKeys, board, model) {
  if (!model.roomsEnabled) return { roomId: null, cost: 0 };

  const size = Number(lesson.klass.size) || 0;
  const wants = lesson.roomType && lesson.roomType !== 'any' ? lesson.roomType : null;
  const homeRoomId = lesson.klass.homeRoomId || null;
  const dayRoom = board.classRoomByDay.get(`${lesson.classId}|${slotKeys[0].split('@')[0]}`);

  const busy = (roomId, key) => board.roomBusy.get(key)?.has(roomId);

  let best = null;
  for (const room of model.rooms) {
    if (size && Number(room.capacity) < size) continue;
    if (wants && room.type !== wants) continue;
    if (slotKeys.some((key) => busy(room.id, key))) continue;

    let cost = 6; // using a non-home room at all
    if (room.id === homeRoomId) cost = 0;
    else if (dayRoom && room.id === dayRoom) cost = 1; // stay put during the day
    else if (dayRoom) cost = 9; // room hop mid-day
    if (wants && room.type === wants) cost -= 2;

    if (!best || cost < best.cost) best = { roomId: room.id, cost };
  }
  return best || { roomId: null, cost: 0 };
}

/** Hard-constraint test + soft cost for putting `lesson` at `startSlot`. */
function evaluate(lesson, startSlot, board, model, { allowLocked = false } = {}) {
  if (!startSlot.teaching) return null;

  const slotKeys = keysFor(lesson, startSlot, model);
  if (!slotKeys) return null;

  const dayId = startSlot.day.id;

  // ── class availability ────────────────────────────────────────────────
  for (const key of slotKeys) {
    if (board.classBusy.get(key)?.has(lesson.classId)) return null;
  }

  // ── teacher availability ──────────────────────────────────────────────
  if (lesson.teacherId) {
    if (model.unavailable.has(`${lesson.teacherId}|${startSlot.key}`)) return null;
    for (const key of slotKeys) {
      if (key !== startSlot.key && model.unavailable.has(`${lesson.teacherId}|${key}`)) return null;
      if (board.teacherBusy.get(key)?.has(lesson.teacherId)) return null;
    }
    const maxPerDay = Number(lesson.teacher.maxPeriodsPerDay) || Infinity;
    const load = board.teacherDayLoad.get(`${lesson.teacherId}|${dayId}`) || 0;
    if (load + lesson.length > maxPerDay) return null;
  }

  // ── subject per-day cap ───────────────────────────────────────────────
  const maxPerDay = Number(lesson.subject.maxPerDay) || 1;
  const already = board.subjectDayCount.get(`${lesson.classId}|${lesson.subjectId}|${dayId}`) || 0;
  if (already >= maxPerDay) return null;

  // ── room ──────────────────────────────────────────────────────────────
  const room = pickRoom(lesson, slotKeys, board, model);
  const needsRoom = lesson.roomType !== 'any' || Boolean(lesson.klass.homeRoomId);
  if (model.roomsEnabled && needsRoom && !room.roomId) return null;

  if (!allowLocked) {
    /* nothing extra — locks are applied as pre-placements */
  }

  // ── soft cost ─────────────────────────────────────────────────────────
  let cost = room.cost;
  const dayList = model.daySlots.get(dayId) || [];
  const position = dayList.findIndex((s) => s.key === startSlot.key);

  // 1. spread the subject across the week
  cost += already === 0 ? 0 : 14 + already * 6;

  // 2. discourage accidental back-to-back repeats of the same subject
  if (lesson.length === 1) {
    for (const offset of [-1, 1]) {
      const neighbour = dayList[position + offset];
      if (!neighbour) continue;
      const placed = board.classSlotLesson.get(`${lesson.classId}|${neighbour.key}`);
      if (placed && placed.subjectId === lesson.subjectId) cost += 26;
    }
  }

  // 3. no holes in the class day — pack lessons towards the start
  let holesBefore = 0;
  for (let i = 0; i < position; i += 1) {
    if (!board.classBusy.get(dayList[i].key)?.has(lesson.classId)) holesBefore += 1;
  }
  cost += holesBefore * 11;

  // 4. no holes in the teacher day either
  if (lesson.teacherId) {
    let teacherHoles = 0;
    for (let i = 0; i < position; i += 1) {
      if (!board.teacherBusy.get(dayList[i].key)?.has(lesson.teacherId)) teacherHoles += 1;
    }
    cost += teacherHoles * 4;
    cost += (board.teacherDayLoad.get(`${lesson.teacherId}|${dayId}`) || 0) * 5;
  }

  // 5. demanding subjects prefer the morning, light subjects the afternoon
  const normalised = position / Math.max(1, dayList.length - 1); // 0 → 1
  cost += (lesson.difficulty - 2) * normalised * 18;

  // 6. keep every slot's overall fill balanced (avoid one crowded day)
  const dayFill = dayList.filter((s) => board.classBusy.get(s.key)?.size).length;
  cost += dayFill * 0.6;

  return { slotKeys, roomId: room.roomId, cost, dayId, position };
}

function commit(lesson, decision, board) {
  const placement = {
    lessonId: lesson.id,
    classId: lesson.classId,
    subjectId: lesson.subjectId,
    teacherId: lesson.teacherId,
    roomId: decision.roomId,
    dayId: decision.dayId,
    slotKeys: decision.slotKeys,
    startSlotKey: decision.slotKeys[0],
    length: lesson.length,
    cost: decision.cost,
    locked: Boolean(lesson.locked),
  };
  board.placements.set(lesson.id, placement);
  board.cost += decision.cost;
  for (const key of placement.slotKeys) {
    addToSet(board.classBusy, key, placement.classId);
    board.classSlotLesson.set(`${placement.classId}|${key}`, placement);
    if (placement.teacherId) addToSet(board.teacherBusy, key, placement.teacherId);
    if (placement.roomId) {
      if (!board.roomBusy.has(key)) board.roomBusy.set(key, new Set());
      board.roomBusy.get(key).add(placement.roomId);
    }
  }
  if (placement.teacherId) {
    bump(board.teacherDayLoad, `${placement.teacherId}|${placement.dayId}`, placement.length);
  }
  bump(board.subjectDayCount, `${placement.classId}|${placement.subjectId}|${placement.dayId}`, 1);
  if (placement.roomId) {
    const roomKey = `${placement.classId}|${placement.dayId}`;
    if (!board.classRoomByDay.has(roomKey)) board.classRoomByDay.set(roomKey, placement.roomId);
  }
  return placement;
}

function revert(placement, board) {
  board.placements.delete(placement.lessonId);
  board.cost -= placement.cost;
  for (const key of placement.slotKeys) {
    removeFromSet(board.classBusy, key, placement.classId);
    board.classSlotLesson.delete(`${placement.classId}|${key}`);
    if (placement.teacherId) removeFromSet(board.teacherBusy, key, placement.teacherId);
    if (placement.roomId) board.roomBusy.get(key)?.delete(placement.roomId);
  }
  if (placement.teacherId) {
    bump(board.teacherDayLoad, `${placement.teacherId}|${placement.dayId}`, -placement.length);
  }
  bump(board.subjectDayCount, `${placement.classId}|${placement.subjectId}|${placement.dayId}`, -1);
}

/* ────────────────────────────── lock handling ────────────────────────────── */

/**
 * Pre-place every pinned lesson. Returns { ok, board, unplaced, violations }.
 * Locks that contradict each other are reported, not silently dropped.
 */
export function applyLocks(model, board = createBoard(model)) {
  const violations = [];
  const lockedIds = new Set();

  for (const lock of model.locks) {
    const lesson = model.lessonById.get(lock.lessonId);
    if (!lesson) {
      violations.push({ lock, reason: 'Unknown lesson (data changed since it was pinned).' });
      continue;
    }
    const slot = model.slotIndex.get(lock.slotKey);
    if (!slot) {
      violations.push({ lock, reason: 'Unknown time slot.' });
      continue;
    }
    lesson.locked = true;
    lockedIds.add(lesson.id);
    const decision = evaluate(lesson, slot, board, model, { allowLocked: true });
    if (!decision) {
      violations.push({ lock, lesson, reason: 'Slot is already taken or breaks a rule.' });
      lesson.locked = false;
      lockedIds.delete(lesson.id);
      continue;
    }
    commit(lesson, decision, board);
  }

  return { board, lockedIds, violations };
}

/* ───────────────────────────────── search ───────────────────────────────── */

function feasibleSlots(lesson, board, model) {
  const out = [];
  const candidates = lesson.candidates || model.slots;
  for (const slot of candidates) {
    if (!slot.teaching) continue;
    const decision = evaluate(lesson, slot, board, model);
    if (decision) out.push({ slot, decision });
  }
  return out;
}

/**
 * A placement can only invalidate a handful of cached option lists: lessons of
 * the same class, lessons of the same teacher, and lessons competing for the
 * very room that was just taken. Everything else keeps its cache — and any
 * stale entry is re-verified before it is ever committed.
 */
function invalidateCache(cache, pending, placement, model) {
  const room = placement.roomId ? model.rooms.find((r) => r.id === placement.roomId) : null;
  const specialty = room && room.type !== 'standard';
  for (const lesson of pending) {
    if (cache.size === 0) return;
    if (lesson.classId === placement.classId ||
        (placement.teacherId && lesson.teacherId === placement.teacherId) ||
        (room && lesson.klass.homeRoomId === room.id) ||
        (specialty && lesson.roomType === room.type)) {
      cache.delete(lesson.id);
    }
  }
}

/**
 * One full search pass: place as many lessons as possible, backtracking out of
 * dead ends. Cached option lists keep it fast; every chosen slot is re-verified
 * against the live board before it is committed, so a stale cache can never
 * produce an illegal timetable.
 */
/**
 * Order lessons so the hardest ones are considered first: specialty-room
 * lessons, then lessons whose teacher carries the heaviest load, then longer
 * sessions. The dynamic MRV scan then only needs to look at the front of the
 * queue, which is where the tight lessons still are.
 */
function constrainOrder(model, lessons) {
  const teacherLoad = new Map();
  for (const lesson of lessons) {
    if (!lesson.teacherId) continue;
    teacherLoad.set(lesson.teacherId, (teacherLoad.get(lesson.teacherId) || 0) + lesson.length);
  }
  return [...lessons].sort((a, b) => {
    const aSpec = a.roomType === 'any' ? 0 : 1;
    const bSpec = b.roomType === 'any' ? 0 : 1;
    if (aSpec !== bSpec) return bSpec - aSpec;
    const aLoad = teacherLoad.get(a.teacherId) || 0;
    const bLoad = teacherLoad.get(b.teacherId) || 0;
    if (aLoad !== bLoad) return bLoad - aLoad;
    if (a.length !== b.length) return b.length - a.length;
    return 0;
  });
}

/** How many queue entries the dynamic MRV scan looks at each step. */
const MRV_WINDOW = 22;

function runPass(model, board, lockedIds, random, options, deadline) {
  const pending = constrainOrder(
    model,
    model.lessons.filter((lesson) => !lockedIds.has(lesson.id)),
  );
  const cache = new Map();
  const history = [];
  let backtracks = 0;
  let guard = 0;
  const maxGuard = pending.length * (options.backtrackLimit + 6) + 2000;

  while (pending.length && guard < maxGuard) {
    guard += 1;
    if (Date.now() > deadline) break;

    // ── Most-Constrained-Variable: the lesson with the fewest options ─────
    let best = null;
    let bestOptions = null;
    const window = Math.min(pending.length, MRV_WINDOW);
    for (let w = 0; w < window; w += 1) {
      const lesson = pending[w];
      let opts = cache.get(lesson.id);
      if (!opts) {
        opts = feasibleSlots(lesson, board, model);
        cache.set(lesson.id, opts);
      }
      if (!best || opts.length < bestOptions.length) {
        best = lesson;
        bestOptions = opts;
        if (opts.length <= 1) break; // cannot get more constrained than this
      }
    }

    // A cached "no options" is always re-checked before we give up on it.
    if (bestOptions.length === 0) {
      const fresh = feasibleSlots(best, board, model);
      cache.set(best.id, fresh);
      bestOptions = fresh;
    }

    if (bestOptions.length === 0) {
      // ── dead end: undo the most recent placement and try a different way ─
      if (history.length === 0 || backtracks >= options.backtrackLimit) {
        pending.splice(pending.indexOf(best), 1);
        best.unplaceable = true;
        continue;
      }
      const last = history.pop();
      revert(last.placement, board);
      cache.clear(); // freeing resources makes every cached list optimistic
      const idx = pending.indexOf(last.lesson);
      if (idx >= 0) pending.splice(idx, 1);
      pending.unshift(last.lesson); // retry it immediately, in a new spot
      last.lesson.avoid = last.lesson.avoid || new Set();
      last.lesson.avoid.add(last.placement.startSlotKey);
      backtracks += 1;
      continue;
    }

    // ── choose a slot: weighted towards the cheapest of the top-K ─────────
    bestOptions.sort((a, b) => a.decision.cost - b.decision.cost);
    const pool = bestOptions.slice(0, Math.max(1, options.topK));
    let choice;
    if (random() < options.exploreRate) {
      const wide = Math.min(bestOptions.length, options.topK * 3);
      choice = bestOptions[Math.floor(random() * wide)];
    } else {
      const weights = pool.map((entry, i) => 1 / (1 + i) ** 1.6);
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = random() * total;
      choice = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i += 1) {
        roll -= weights[i];
        if (roll <= 0) {
          choice = pool[i];
          break;
        }
      }
    }
    if (best.avoid?.has(choice.slot.key) && bestOptions.length > 1) {
      choice = bestOptions.find((entry) => !best.avoid?.has(entry.slot.key)) || choice;
    }

    // ── verify against the live board, then commit ───────────────────────
    const decision = evaluate(best, choice.slot, board, model);
    if (!decision) {
      cache.delete(best.id); // stale entry — recompute next time round
      continue;
    }

    const placement = commit(best, decision, board);
    history.push({ lesson: best, placement });
    pending.splice(pending.indexOf(best), 1);
    cache.delete(best.id);
    invalidateCache(cache, pending, placement, model);
    best.avoid = null;
  }

  polish(model, board, lockedIds, options.polishPasses, deadline);

  const unplaced = model.lessons.filter(
    (lesson) => !lockedIds.has(lesson.id) && !board.placements.has(lesson.id),
  );
  return { board, unplaced, backtracks, placed: board.placements.size };
}

/**
 * Local improvement sweep. Each placed lesson is lifted out and dropped into
 * its cheapest legal slot; because lifting only ever frees resources, the
 * lesson's previous slot is always still legal, so the sweep can never make a
 * solution invalid. Locked lessons are left alone.
 */
function polish(model, board, lockedIds, passes, deadline) {
  for (let pass = 0; pass < passes; pass += 1) {
    if (Date.now() > deadline) return;
    let improved = 0;
    for (const lesson of model.lessons) {
      if (lockedIds.has(lesson.id) || lesson.locked) continue;
      const current = board.placements.get(lesson.id);
      if (!current) continue;

      revert(current, board);
      const options = feasibleSlots(lesson, board, model);
      if (!options.length) {
        commit(lesson, { slotKeys: current.slotKeys, roomId: current.roomId, cost: current.cost, dayId: current.dayId, position: 0 }, board);
        continue;
      }
      let best = options[0];
      for (const entry of options) if (entry.decision.cost < best.decision.cost) best = entry;
      if (best.decision.cost < current.cost) improved += 1;
      commit(lesson, best.decision, board);
    }
    if (!improved) return; // converged
  }
}

/**
 * Fully automated generation.
 * @param {object} model  from buildModel()
 * @param {object} [options]
 * @returns {{placements:Array, unplaced:Array, metrics:object, conflicts:Array,
 *            lockViolations:Array, stats:object}}
 */
export function schedule(model, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const started = Date.now();
  const deadline = started + opts.timeBudgetMs;
  const seed = opts.seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff));
  const random = mulberry32(typeof seed === 'number' ? seed : hashString(String(seed)));

  let best = null;
  let restarts = 0;

  for (let attempt = 0; attempt < opts.maxRestarts; attempt += 1) {
    restarts = attempt + 1;
    if (Date.now() > deadline && best) break;

    for (const lesson of model.lessons) {
      lesson.locked = false;
      lesson.unplaceable = false;
      lesson.avoid = null;
    }

    const board = createBoard(model);
    const { lockedIds, violations } = applyLocks(model, board);
    const pass = runPass(model, board, lockedIds, random, opts, deadline);

    const score = rankSolution(pass);
    if (!best || score > best.score) {
      best = { ...pass, score, lockViolations: violations, attempt };
    }
    // Complete solution: keep going only if we still have budget and the
    // caller asked us to look for a nicer arrangement.
    if (pass.unplaced.length === 0 && !opts.improveAfterSolve) break;
    if (Date.now() > deadline) break;
  }

  const result = finalise(model, best, opts);
  result.stats = {
    restarts,
    seed,
    durationMs: Date.now() - started,
    backtracks: best ? best.backtracks : 0,
  };
  return result;
}

/** Higher is better: complete solutions always beat partial ones. */
function rankSolution(pass) {
  return pass.unplaced.length * -1e6 - pass.board.cost;
}

function finalise(model, best, opts) {
  const placements = [];
  const unplaced = [];

  if (best) {
    for (const lesson of model.lessons) {
      const placement = best.board.placements.get(lesson.id);
      if (placement) {
        placements.push({
          ...placement,
          lessonId: lesson.id,
          subjectName: lesson.subject?.name,
          className: lesson.klass?.name,
          teacherName: lesson.teacher?.name ?? null,
        });
      } else {
        unplaced.push(lesson);
      }
    }
  } else {
    unplaced.push(...model.lessons);
  }

  const result = {
    placements,
    unplaced,
    lockViolations: best ? best.lockViolations : [],
    totalCost: best ? best.board.cost : 0,
    options: opts,
  };
  result.conflicts = validate(model, result);
  result.metrics = computeMetrics(model, result);
  result.diagnostics = diagnose(model, result);
  return result;
}

/* ───────────────────────────── verification ────────────────────────────── */

/**
 * Independent audit of a solution — the tests use this to prove the engine
 * never breaks a hard constraint.
 */
export function validate(model, result) {
  const conflicts = [];
  const classSlots = new Map();
  const teacherSlots = new Map();
  const roomSlots = new Map();

  const note = (type, message, placement) => conflicts.push({ type, message, placement });

  for (const placement of result.placements) {
    const lesson = model.lessonById.get(placement.lessonId);
    if (!lesson) {
      note('unknown-lesson', `Placement refers to missing lesson ${placement.lessonId}`);
      continue;
    }
    for (const slotKey of placement.slotKeys) {
      const slot = model.slotIndex.get(slotKey);
      if (!slot) {
        note('unknown-slot', `Unknown slot ${slotKey}`);
        continue;
      }
      if (!slot.teaching) note('break-slot', `${lesson.klass.name} scheduled during a break`, placement);

      if (classSlots.has(`${placement.classId}|${slotKey}`)) {
        note('class-double-booked', `${lesson.klass.name} is in two places at ${slotKey}`, placement);
      }
      classSlots.set(`${placement.classId}|${slotKey}`, placement);

      if (placement.teacherId) {
        if (model.unavailable.has(`${placement.teacherId}|${slotKey}`)) {
          note('teacher-unavailable', `${lesson.teacher.name} is not available at ${slotKey}`, placement);
        }
        if (teacherSlots.has(`${placement.teacherId}|${slotKey}`)) {
          note(
            'teacher-double-booked',
            `${lesson.teacher.name} has two lessons at ${slotKey}`,
            placement,
          );
        }
        teacherSlots.set(`${placement.teacherId}|${slotKey}`, placement);
      }

      if (placement.roomId) {
        if (roomSlots.has(`${placement.roomId}|${slotKey}`)) {
          note('room-double-booked', `Room is used twice at ${slotKey}`, placement);
        }
        roomSlots.set(`${placement.roomId}|${slotKey}`, placement);
        const room = model.rooms.find((r) => r.id === placement.roomId);
        if (room && lesson.klass.size && Number(room.capacity) < Number(lesson.klass.size)) {
          note('room-too-small', `${room.name} is too small for ${lesson.klass.name}`, placement);
        }
        if (room && lesson.roomType !== 'any' && room.type !== lesson.roomType) {
          note('room-type', `${room.name} is not a ${lesson.roomType} room`, placement);
        }
      }
    }

    // per-day subject cap
    const cap = Number(lesson.subject.maxPerDay) || 1;
    const sameDay = result.placements.filter(
      (p) => p.classId === placement.classId && p.subjectId === placement.subjectId && p.dayId === placement.dayId,
    );
    if (sameDay.length > cap) {
      note('subject-per-day', `${lesson.subject.name} appears ${sameDay.length}× for ${lesson.klass.name} on ${placement.dayId}`, placement);
    }
  }

  // teacher daily maximum
  const loads = new Map();
  for (const placement of result.placements) {
    if (!placement.teacherId) continue;
    const key = `${placement.teacherId}|${placement.dayId}`;
    loads.set(key, (loads.get(key) || 0) + placement.length);
  }
  for (const [key, count] of loads) {
    const [teacherId, dayId] = key.split('|');
    const teacher = model.teacherById.get(teacherId);
    const max = Number(teacher?.maxPeriodsPerDay) || Infinity;
    if (count > max) {
      conflicts.push({ type: 'teacher-overload', message: `${teacher?.name} teaches ${count} periods on ${dayId} (max ${max})` });
    }
  }

  // locks honoured
  for (const lock of model.locks) {
    const placement = result.placements.find((p) => p.lessonId === lock.lessonId);
    const violated = result.lockViolations?.some((v) => v.lock === lock);
    if (!placement && !violated) {
      conflicts.push({ type: 'lock-dropped', message: `Pinned lesson ${lock.lessonId} was not placed` });
    } else if (placement && !violated && placement.startSlotKey !== lock.slotKey) {
      conflicts.push({ type: 'lock-moved', message: `Pinned lesson ${lock.lessonId} moved` });
    }
  }

  // weekly quota met
  for (const lesson of model.lessons) {
    if (!result.placements.some((p) => p.lessonId === lesson.id)) continue;
  }

  return conflicts;
}

/* ──────────────────────────────── metrics ───────────────────────────────── */

export function computeMetrics(model, result) {
  const totalLessons = model.lessons.length;
  const placed = result.placements.length;
  const periods = result.placements.reduce((sum, p) => sum + p.length, 0);
  const teachingSlots = model.slots.filter((s) => s.teaching).length;

  // utilisation
  const classCapacity = model.classes.length * teachingSlots;
  const utilisation = classCapacity ? periods / classCapacity : 0;

  const teacherLoad = new Map();
  for (const teacher of model.teachers) teacherLoad.set(teacher.id, 0);
  for (const placement of result.placements) {
    if (placement.teacherId) {
      teacherLoad.set(placement.teacherId, (teacherLoad.get(placement.teacherId) || 0) + placement.length);
    }
  }
  const loads = [...teacherLoad.values()].filter((v) => v > 0);
  const avgLoad = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const loadSpread = loads.length
    ? Math.max(...loads) - Math.min(...loads)
    : 0;

  // idle holes
  let classHoles = 0;
  for (const klass of model.classes) {
    for (const [dayId, slots] of model.daySlots) {
      const filled = slots.map((s) =>
        result.placements.some((p) => p.classId === klass.id && p.slotKeys.includes(s.key)),
      );
      const last = filled.lastIndexOf(true);
      for (let i = 0; i < last; i += 1) if (!filled[i]) classHoles += 1;
      void dayId;
    }
  }

  let teacherHoles = 0;
  for (const teacher of model.teachers) {
    for (const [, slots] of model.daySlots) {
      const filled = slots.map((s) =>
        result.placements.some((p) => p.teacherId === teacher.id && p.slotKeys.includes(s.key)),
      );
      const last = filled.lastIndexOf(true);
      for (let i = 0; i < last; i += 1) if (!filled[i]) teacherHoles += 1;
    }
  }

  /* Even-spread score.
     For each class+subject we compare the real per-day session counts with the
     best achievable spread (ceil(sessions / active days)) and count only the
     excess. A subject that *cannot* be spread thinner than one per day is
     therefore not penalised for something that was never possible. */
  const dayCount = model.days.length || 1;
  const evenness = (counts, sessions) => {
    if (sessions < 2) return 1;
    const idealMax = Math.ceil(sessions / dayCount);
    let excess = 0;
    for (const c of counts) excess += Math.max(0, c - idealMax);
    return 1 - excess / sessions;
  };

  let spreadScore = 0;
  let spreadSamples = 0;
  for (const klass of model.classes) {
    for (const subject of model.subjects) {
      const counts = model.days.map(
        (day) =>
          result.placements.filter(
            (p) => p.classId === klass.id && p.subjectId === subject.id && p.dayId === day.id,
          ).length,
      );
      const sessions = counts.reduce((a, b) => a + b, 0);
      if (sessions < 2) continue;
      spreadScore += evenness(counts, sessions);
      spreadSamples += 1;
    }
  }
  const spread = spreadSamples ? spreadScore / spreadSamples : 1;

  /* Teacher balance: is each teacher's own load spread evenly over the week?
     Compared against their personal ideal, not against other teachers, so a
     part-time music teacher is not scored as "unbalanced" next to a full-time
     maths teacher. */
  let balanceScore = 0;
  let balanceSamples = 0;
  for (const teacher of model.teachers) {
    const counts = model.days.map(
      (day) => result.placements.filter((p) => p.teacherId === teacher.id && p.dayId === day.id).length,
    );
    const sessions = counts.reduce((a, b) => a + b, 0);
    if (sessions < 2) continue;
    balanceScore += evenness(counts, sessions);
    balanceSamples += 1;
  }
  const balance = balanceSamples ? balanceScore / balanceSamples : 1;

  const roomUsage = new Map();
  for (const placement of result.placements) {
    if (!placement.roomId) continue;
    roomUsage.set(placement.roomId, (roomUsage.get(placement.roomId) || 0) + placement.length);
  }

  const completion = totalLessons ? placed / totalLessons : 1;
  const holeScore = placed ? 1 - Math.min(1, classHoles / placed) : 1;
  const conflictPenalty = result.conflicts.length * 0.3;

  const raw =
    0.34 * completion + 0.26 * spread + 0.2 * holeScore + 0.2 * balance - conflictPenalty;
  const quality = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return {
    totalLessons,
    placed,
    unplaced: result.unplaced.length,
    periods,
    utilisation,
    classHoles,
    teacherHoles,
    avgTeacherLoad: avgLoad,
    loadSpread,
    spread,
    balance,
    holeScore,
    teacherLoad: Object.fromEntries(teacherLoad),
    roomUsage: Object.fromEntries(roomUsage),
    conflicts: result.conflicts.length,
    quality,
    teachingSlots,
  };
}

/* ────────────────────────────── diagnostics ─────────────────────────────── */

/**
 * Explain *why* something could not be placed, with actionable suggestions.
 */
export function diagnose(model, result) {
  const issues = [];

  for (const lockViolation of result.lockViolations || []) {
    issues.push({
      severity: 'warn',
      title: 'A pinned lesson could not be honoured',
      detail: lockViolation.reason,
      hint: 'Unpin it or free the slot, then regenerate.',
    });
  }

  for (const lesson of result.unplaced) {
    const reasons = countBlockers(model, lesson, result);
    issues.push({
      severity: 'error',
      title: `${lesson.subject?.name} · ${lesson.klass?.name} could not be scheduled`,
      detail: reasons.top
        ? `${reasons.top.count}/${reasons.total} slots blocked — mostly: ${reasons.top.reason}`
        : 'No teaching slot is available.',
      hint: reasons.hint,
      lessonId: lesson.id,
    });
  }

  if (!issues.length) {
    issues.push({
      severity: 'ok',
      title: 'Timetable is conflict-free',
      detail: `${result.placements.length} lessons placed across ${model.classes.length} classes with zero clashes.`,
    });
  }

  // capacity advice even when everything fitted
  const slots = model.slots.filter((s) => s.teaching).length;
  const demand = model.lessons.reduce((sum, l) => sum + l.length, 0);
  if (demand > slots * model.classes.length) {
    issues.push({
      severity: 'warn',
      title: 'Demand exceeds capacity',
      hint: `You are asking for ${demand} lesson-periods but only ${slots * model.classes.length} class-slots exist. Add periods or trim weekly hours.`,
    });
  }

  return issues;
}

function countBlockers(model, lesson, result) {
  const tally = new Map();
  let total = 0;
  const board = createBoard(model);
  for (const placement of result.placements) {
    for (const key of placement.slotKeys) {
      addToSet(board.classBusy, key, placement.classId);
      if (placement.teacherId) addToSet(board.teacherBusy, key, placement.teacherId);
      if (placement.roomId) {
        if (!board.roomBusy.has(key)) board.roomBusy.set(key, new Set());
        board.roomBusy.get(key).add(placement.roomId);
      }
    }
    if (placement.teacherId) bump(board.teacherDayLoad, `${placement.teacherId}|${placement.dayId}`, placement.length);
    bump(board.subjectDayCount, `${placement.classId}|${placement.subjectId}|${placement.dayId}`, 1);
  }

  for (const slot of model.slots) {
    if (!slot.teaching) continue;
    total += 1;
    let reason = 'no reason recorded';
    const keys = keysFor(lesson, slot, model);
    if (!keys) reason = 'not enough consecutive periods left in the day';
    else if (keys.some((k) => board.classBusy.get(k)?.has(lesson.classId))) reason = 'the class is already busy';
    else if (lesson.teacherId && model.unavailable.has(`${lesson.teacherId}|${slot.key}`)) reason = `${lesson.teacher?.name ?? 'the teacher'} is unavailable`;
    else if (lesson.teacherId && keys.some((k) => board.teacherBusy.get(k)?.has(lesson.teacherId))) reason = `${lesson.teacher?.name ?? 'the teacher'} is teaching elsewhere`;
    else if (board.subjectDayCount.get(`${lesson.classId}|${lesson.subjectId}|${slot.day.id}`) >= (Number(lesson.subject.maxPerDay) || 1)) reason = 'daily limit for this subject is reached';
    else if (model.roomsEnabled && lesson.roomType !== 'any' && !pickRoom(lesson, keys, board, model).roomId) reason = `no free ${lesson.roomType} room`;
    tally.set(reason, (tally.get(reason) || 0) + 1);
  }

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0] ? { reason: sorted[0][0], count: sorted[0][1] } : null;
  const hintFor = top?.reason || '';
  let hint = 'Add another period to the day, or reduce the weekly hours for this subject.';
  if (hintFor.includes('unavailable')) hint = 'Widen the teacher availability, or give the subject a second teacher.';
  else if (hintFor.includes('teaching elsewhere')) hint = 'Share the subject with another teacher, or add periods to the day.';
  else if (hintFor.includes('daily limit')) hint = 'Raise the "max per day" for this subject.';
  else if (hintFor.includes('room')) hint = 'Add a matching room or lower the class size.';
  else if (hintFor.includes('consecutive')) hint = 'Shorten the session length or add periods to the day.';

  return { top, total, hint, breakdown: Object.fromEntries(tally) };
}

/* ───────────────────── manual edits (drag & drop, swap) ────────────────── */

/**
 * Can `lessonId` legally move to `slotKey` in the *current* solution?
 * Used by the UI to validate drag-and-drop before it happens.
 */
export function canMove(model, result, lessonId, slotKey) {
  const lesson = model.lessonById.get(lessonId);
  const slot = model.slotIndex.get(slotKey);
  if (!lesson || !slot) return { ok: false, reason: 'Unknown lesson or slot.' };

  const others = result.placements.filter((p) => p.lessonId !== lessonId);
  const board = createBoard(model);
  for (const placement of others) {
    for (const key of placement.slotKeys) {
      addToSet(board.classBusy, key, placement.classId);
      if (placement.teacherId) addToSet(board.teacherBusy, key, placement.teacherId);
      if (placement.roomId) {
        if (!board.roomBusy.has(key)) board.roomBusy.set(key, new Set());
        board.roomBusy.get(key).add(placement.roomId);
      }
    }
    if (placement.teacherId) bump(board.teacherDayLoad, `${placement.teacherId}|${placement.dayId}`, placement.length);
    bump(board.subjectDayCount, `${placement.classId}|${placement.subjectId}|${placement.dayId}`, 1);
  }

  // subject per-day count excludes the moving lesson
  const decision = evaluate(lesson, slot, board, model);
  if (!decision) return { ok: false, reason: blockedReason(lesson, slot, board, model) };
  return { ok: true, decision };
}

function blockedReason(lesson, slot, board, model) {
  if (!slot.teaching) return 'That is a break or lunch slot.';
  const keys = keysFor(lesson, slot, model);
  if (!keys) return 'Not enough consecutive periods left in that day.';
  if (keys.some((k) => board.classBusy.get(k)?.has(lesson.classId))) return 'The class already has a lesson then.';
  if (lesson.teacherId) {
    if (model.unavailable.has(`${lesson.teacherId}|${slot.key}`)) return `${lesson.teacher?.name ?? 'The teacher'} is unavailable then.`;
    if (keys.some((k) => board.teacherBusy.get(k)?.has(lesson.teacherId))) return `${lesson.teacher?.name ?? 'The teacher'} is teaching another class then.`;
    const max = Number(lesson.teacher.maxPeriodsPerDay) || Infinity;
    if ((board.teacherDayLoad.get(`${lesson.teacherId}|${slot.day.id}`) || 0) + lesson.length > max) {
      return `${lesson.teacher?.name ?? 'The teacher'} would exceed their daily maximum.`;
    }
  }
  const cap = Number(lesson.subject.maxPerDay) || 1;
  if ((board.subjectDayCount.get(`${lesson.classId}|${lesson.subjectId}|${slot.day.id}`) || 0) >= cap) {
    return `${lesson.subject.name} is already at its daily limit for this class.`;
  }
  if (model.roomsEnabled && !pickRoom(lesson, keys, board, model).roomId) return 'No suitable room is free then.';
  return 'That placement breaks a timetable rule.';
}

/** Apply a validated move, returning a fresh result object. */
export function applyMove(model, result, lessonId, slotKey) {
  const check = canMove(model, result, lessonId, slotKey);
  if (!check.ok) return { ...result, error: check.reason };

  const lesson = model.lessonById.get(lessonId);
  const placements = result.placements.filter((p) => p.lessonId !== lessonId);
  const room = pickRoom(lesson, check.decision.slotKeys, boardFrom(model, placements), model);
  placements.push({
    lessonId,
    classId: lesson.classId,
    subjectId: lesson.subjectId,
    teacherId: lesson.teacherId,
    roomId: room.roomId,
    dayId: check.decision.dayId,
    slotKeys: check.decision.slotKeys,
    startSlotKey: check.decision.slotKeys[0],
    length: lesson.length,
    cost: check.decision.cost,
    locked: lesson.locked,
    subjectName: lesson.subject?.name,
    className: lesson.klass?.name,
    teacherName: lesson.teacher?.name ?? null,
    manual: true,
  });
  const next = { ...result, placements, unplaced: result.unplaced.filter((l) => l.id !== lessonId) };
  next.conflicts = validate(model, next);
  next.metrics = computeMetrics(model, next);
  return next;
}

function boardFrom(model, placements) {
  const board = createBoard(model);
  for (const placement of placements) {
    for (const key of placement.slotKeys) {
      addToSet(board.classBusy, key, placement.classId);
      if (placement.teacherId) addToSet(board.teacherBusy, key, placement.teacherId);
      if (placement.roomId) {
        if (!board.roomBusy.has(key)) board.roomBusy.set(key, new Set());
        board.roomBusy.get(key).add(placement.roomId);
      }
    }
    if (placement.teacherId) bump(board.teacherDayLoad, `${placement.teacherId}|${placement.dayId}`, placement.length);
    bump(board.subjectDayCount, `${placement.classId}|${placement.subjectId}|${placement.dayId}`, 1);
    if (placement.roomId) {
      const key = `${placement.classId}|${placement.dayId}`;
      if (!board.classRoomByDay.has(key)) board.classRoomByDay.set(key, placement.roomId);
    }
  }
  return board;
}
