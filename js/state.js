/**
 * Application state: a tiny observable store with localStorage persistence.
 */
import { demoData, defaultPrefs, randomSchool } from './seed.js';
import { buildModel, schedule, applyMove, validate, computeMetrics, diagnose } from './scheduler.js';

const STORAGE_KEY = 'timetable-studio:v3';
const CURRENT_VERSION = 3;

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoData();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== CURRENT_VERSION || !parsed.settings) return demoData();
    parsed.ui = { ...defaultPrefs(), ...(parsed.ui || {}) };
    parsed.locks = parsed.locks || [];
    parsed.result = parsed.result || null;
    return parsed;
  } catch {
    return demoData();
  }
}

function persist() {
  try {
    // The generated result can be large; drop it if we are close to the quota.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    try {
      const slim = { ...state, result: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch {
      /* storage unavailable — run in memory */
    }
  }
}

export function getState() {
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(detail = {}) {
  persist();
  for (const fn of listeners) fn(state, detail);
}

export function update(mutator, detail) {
  const next = structuredClone(state);
  const changed = mutator(next) ?? next;
  state = changed === next ? next : changed;
  notify(detail);
  return state;
}

/* ────────────────────────────── preferences ────────────────────────────── */

export function setPrefs(patch) {
  update((draft) => {
    draft.ui = { ...draft.ui, ...patch };
  }, { scope: 'prefs' });
}

/* ─────────────────────────────── entities ──────────────────────────────── */

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function upsert(collection, item) {
  update((draft) => {
    const list = draft[collection];
    const at = list.findIndex((row) => row.id === item.id);
    if (at >= 0) list[at] = { ...list[at], ...item };
    else list.push(item);
  }, { scope: 'data', collection });
}

export function remove(collection, id) {
  update((draft) => {
    draft[collection] = draft[collection].filter((row) => row.id !== id);
    if (collection === 'teachers') {
      for (const subject of draft.subjects) {
        if (subject.teacherId === id) subject.teacherId = draft.teachers[0]?.id ?? null;
      }
    }
    if (collection === 'rooms') {
      for (const klass of draft.classes) {
        if (klass.homeRoomId === id) klass.homeRoomId = draft.rooms[0]?.id ?? null;
      }
    }
    draft.locks = [];
  }, { scope: 'data', collection });
}

export function setSettings(patch) {
  update((draft) => {
    draft.settings = { ...draft.settings, ...patch };
    draft.locks = [];
  }, { scope: 'data' });
}

/* ───────────────────────────────── locks ───────────────────────────────── */

export function toggleLock(lessonId, slotKey, dayId) {
  let added = false;
  update((draft) => {
    const at = draft.locks.findIndex((l) => l.lessonId === lessonId);
    if (at >= 0) {
      if (draft.locks[at].slotKey === slotKey) draft.locks.splice(at, 1);
      else draft.locks[at] = { lessonId, slotKey, dayId, at: Date.now() };
      added = draft.locks[at]?.slotKey === slotKey;
    } else {
      draft.locks.push({ lessonId, slotKey, dayId, at: Date.now() });
      added = true;
    }
  }, { scope: 'locks' });
  return added;
}

export function clearLocks() {
  update((draft) => {
    draft.locks = [];
  }, { scope: 'locks' });
}

/* ───────────────────────────── generation ─────────────────────────────── */

/**
 * Run the automated engine. Produces several candidate solutions with
 * different seeds and keeps them ranked by quality, so the user can compare.
 *
 * @param {object} [opts]
 * @param {number} [opts.candidates=3]
 * @param {number} [opts.seed]
 * @returns {Promise<object>} the winning result (with `.alternatives`)
 */
export function generate({ candidates = 3, seed = null } = {}) {
  return new Promise((resolve) => {
    // Let the browser paint the "generating" state before we block on maths.
    setTimeout(() => {
      const model = buildModel(state);
      const size = model.lessons.length;

      /* Budget scales with the problem: a normal school solves in well under
         200 ms, so we keep each candidate cheap and spend the savings on
         comparing several solutions. Tight datasets get more time. */
      const budget = Math.max(200, Math.min(700, Math.round(120 + size * 0.9)));

      const runs = [];
      for (let i = 0; i < Math.max(1, candidates); i += 1) {
        const useSeed = seed != null ? (seed + i * 7919) >>> 0 : (Date.now() ^ (i * 2654435761)) >>> 0;
        const result = schedule(model, { seed: useSeed, timeBudgetMs: budget });
        runs.push(describeRun(useSeed, result));
        // A flawless solution on the second pass or later — stop searching,
        // but always keep at least two candidates so they can be compared.
        const perfect = result.unplaced.length === 0 && result.conflicts.length === 0 &&
          result.metrics.quality >= 99 && result.metrics.classHoles === 0;
        if (perfect && i >= 1) break;
      }

      /* Escalate only when the data is genuinely tight: one deep run with a
         much larger budget, a longer backtrack tail and more polish. */
      runs.sort(rankRuns);
      if (runs[0].unplaced.length > 0) {
        const deepSeed = (runs[0].seed ^ 0x9e3779b9) >>> 0;
        const deep = schedule(model, {
          seed: deepSeed,
          timeBudgetMs: Math.min(4000, budget * 6),
          backtrackLimit: 220,
          polishPasses: 4,
          maxRestarts: 400,
        });
        runs.push(describeRun(deepSeed, deep));
        runs.sort(rankRuns);
      }

      const winner = runs[0];
      const full = winner.result;
      full.alternatives = runs;
      full.chosenSeed = winner.seed;

      update((draft) => {
        draft.result = serialise(full);
        draft.result.signature = dataSignature(draft);
        draft.settings.generatedAt = new Date().toISOString();
        draft.settings.seed = winner.seed;
      }, { scope: 'result' });

      resolve(state.result);
    }, 16);
  });
}

/** Fewest unplaced wins; then fewest conflicts; then the best quality score. */
function rankRuns(a, b) {
  return a.unplaced - b.unplaced || a.conflicts - b.conflicts || b.quality - a.quality || a.holes - b.holes;
}

function describeRun(seed, result) {
  return {
    seed,
    quality: result.metrics.quality,
    conflicts: result.conflicts.length,
    unplaced: result.unplaced.length,
    utilisation: result.metrics.utilisation,
    holes: result.metrics.classHoles,
    spread: result.metrics.spread,
    balance: result.metrics.balance,
    stats: result.stats,
    placements: result.placements.map(stripPlacement),
    result,
  };
}

/**
 * Fingerprint of everything the solver consumes. When it differs from the
 * fingerprint stored with the current result, the timetable is stale and the
 * UI offers to regenerate.
 */
export function dataSignature(source = state) {
  return JSON.stringify({
    c: source.classes,
    s: source.subjects,
    t: source.teachers,
    r: source.rooms,
    d: source.settings.days,
    p: source.settings.periods,
  });
}

export function isStale(source = state) {
  if (!source.result) return false;
  return source.result.signature !== dataSignature(source);
}

function stripPlacement(p) {
  return {
    lessonId: p.lessonId,
    classId: p.classId,
    subjectId: p.subjectId,
    teacherId: p.teacherId,
    roomId: p.roomId,
    dayId: p.dayId,
    slotKeys: p.slotKeys,
    startSlotKey: p.startSlotKey,
    length: p.length,
    locked: p.locked,
    manual: p.manual,
  };
}

/** The result object is kept JSON-friendly so it survives a page reload. */
function serialise(result) {
  return {
    generatedAt: new Date().toISOString(),
    seed: result.chosenSeed ?? null,
    stats: result.stats,
    placements: result.placements.map(stripPlacement),
    unplaced: result.unplaced.map((l) => ({ id: l.id, subjectId: l.subjectId, classId: l.classId, length: l.length })),
    conflicts: result.conflicts,
    metrics: result.metrics,
    diagnostics: result.diagnostics,
    alternatives: (result.alternatives || []).map((a) => ({
      seed: a.seed,
      quality: a.quality,
      conflicts: a.conflicts,
      unplaced: a.unplaced,
      utilisation: a.utilisation,
      stats: a.stats,
      placements: a.placements,
    })),
  };
}

export function currentModel() {
  return buildModel(state);
}

/** Apply a manual drag-and-drop move to the stored result. */
export function moveLesson(lessonId, slotKey) {
  if (!state.result) return { ok: false, reason: 'Generate a timetable first.' };
  const model = buildModel(state);
  const result = {
    placements: state.result.placements ?? [],
    unplaced: state.result.unplaced ?? [],
    conflicts: [],
    lockViolations: [],
  };
  const moved = applyMove(model, result, lessonId, slotKey);
  if (moved.error) return { ok: false, reason: moved.error };

  update((draft) => {
    draft.result.placements = moved.placements.map((p) => ({
      lessonId: p.lessonId,
      classId: p.classId,
      subjectId: p.subjectId,
      teacherId: p.teacherId,
      roomId: p.roomId,
      dayId: p.dayId,
      slotKeys: p.slotKeys,
      startSlotKey: p.startSlotKey,
      length: p.length,
      locked: p.locked,
      manual: p.manual,
    }));
    draft.result.metrics = moved.metrics;
    draft.result.conflicts = moved.conflicts;
    draft.result.unplaced = moved.unplaced.map((l) => ({
      id: l.id, subjectId: l.subjectId, classId: l.classId, length: l.length,
    }));
    draft.result.diagnostics = diagnose(model, draft.result);
  }, { scope: 'result' });

  return { ok: true, result: state.result };
}

/** Adopt one of the alternative candidate solutions. */
export function chooseAlternative(seed) {
  const alt = state.result?.alternatives?.find((a) => a.seed === seed);
  if (!alt || !Array.isArray(alt.placements)) return null;

  const model = buildModel(state);
  const candidate = { placements: alt.placements, unplaced: [], conflicts: [], lockViolations: [] };
  candidate.conflicts = validate(model, candidate);
  candidate.metrics = computeMetrics(model, candidate);

  update((draft) => {
    draft.result.placements = alt.placements;
    draft.result.seed = alt.seed;
    draft.result.metrics = candidate.metrics;
    draft.result.conflicts = candidate.conflicts;
    draft.result.unplaced = model.lessons
      .filter((l) => !alt.placements.some((p) => p.lessonId === l.id))
      .map((l) => ({ id: l.id, subjectId: l.subjectId, classId: l.classId, length: l.length }));
    draft.result.diagnostics = diagnose(model, draft.result);
    draft.settings.seed = alt.seed;
  }, { scope: 'result' });

  return state.result;
}

/* ─────────────────────────── dataset operations ───────────────────────── */

export function resetDemo() {
  state = demoData();
  state.ui = { ...defaultPrefs(), ...state.ui };
  notify({ scope: 'dataset' });
  return state;
}

export function loadRandomSchool(opts) {
  const prefs = state.ui;
  state = randomSchool(opts);
  state.ui = { ...defaultPrefs(), ...prefs, activeClassId: state.classes[0]?.id, activeTeacherId: state.teachers[0]?.id, activeRoomId: state.rooms[0]?.id };
  notify({ scope: 'dataset' });
  return state;
}

export function importData(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || !parsed.settings || !Array.isArray(parsed.classes)) {
    throw new Error('That file does not look like a Timetable Studio dataset.');
  }
  state = {
    ...demoData(),
    ...parsed,
    ui: { ...defaultPrefs(), ...(parsed.ui || {}) },
    locks: parsed.locks || [],
    result: null,
  };
  notify({ scope: 'dataset' });
  return state;
}

export function exportData() {
  return JSON.stringify(state, null, 2);
}

