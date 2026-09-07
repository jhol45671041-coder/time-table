/**
 * Demo dataset — a realistic secondary school used to seed the app, plus a
 * random-school generator so the engine can be stress-tested in the browser.
 */

export const SLOT = (day, period) => `${day}@${period}`;

const DEFAULT_DAYS = [
  { id: 'mon', label: 'Mon', full: 'Monday', active: true },
  { id: 'tue', label: 'Tue', full: 'Tuesday', active: true },
  { id: 'wed', label: 'Wed', full: 'Wednesday', active: true },
  { id: 'thu', label: 'Thu', full: 'Thursday', active: true },
  { id: 'fri', label: 'Fri', full: 'Friday', active: true },
  { id: 'sat', label: 'Sat', full: 'Saturday', active: false },
];

const DEFAULT_PERIODS = [
  { key: 'p1', label: 'Period 1', short: '1', start: '08:30', end: '09:15', kind: 'lesson' },
  { key: 'p2', label: 'Period 2', short: '2', start: '09:15', end: '10:00', kind: 'lesson' },
  { key: 'br1', label: 'Morning break', short: '☕', start: '10:00', end: '10:20', kind: 'break' },
  { key: 'p3', label: 'Period 3', short: '3', start: '10:20', end: '11:05', kind: 'lesson' },
  { key: 'p4', label: 'Period 4', short: '4', start: '11:05', end: '11:50', kind: 'lesson' },
  { key: 'lu', label: 'Lunch', short: '🍽', start: '11:50', end: '12:40', kind: 'lunch' },
  { key: 'p5', label: 'Period 5', short: '5', start: '12:40', end: '13:25', kind: 'lesson' },
  { key: 'p6', label: 'Period 6', short: '6', start: '13:25', end: '14:10', kind: 'lesson' },
  { key: 'p7', label: 'Period 7', short: '7', start: '14:10', end: '14:55', kind: 'lesson' },
  { key: 'p8', label: 'Period 8', short: '8', start: '14:55', end: '15:40', kind: 'lesson' },
];

const TEACHERS = [
  { id: 't-amara', name: 'Amara Osei', initials: 'AO', maxPeriodsPerDay: 6, unavailable: [SLOT('wed', 'p7'), SLOT('wed', 'p8')] },
  { id: 't-daniel', name: 'Daniel Reyes', initials: 'DR', maxPeriodsPerDay: 6, unavailable: [SLOT('mon', 'p1')] },
  { id: 't-priya', name: 'Priya Nair', initials: 'PN', maxPeriodsPerDay: 5, unavailable: [SLOT('fri', 'p7'), SLOT('fri', 'p8')] },
  { id: 't-tomas', name: 'Tomas Lindqvist', initials: 'TL', maxPeriodsPerDay: 6, unavailable: [] },
  { id: 't-grace', name: 'Grace Mwangi', initials: 'GM', maxPeriodsPerDay: 6, unavailable: [SLOT('tue', 'p1'), SLOT('tue', 'p2')] },
  { id: 't-hiro', name: 'Hiroshi Tanaka', initials: 'HT', maxPeriodsPerDay: 5, unavailable: [] },
  { id: 't-elena', name: 'Elena Petrova', initials: 'EP', maxPeriodsPerDay: 6, unavailable: [] },
  { id: 't-marcus', name: 'Marcus Bell', initials: 'MB', maxPeriodsPerDay: 6, unavailable: [SLOT('thu', 'p8')] },
  { id: 't-sofia', name: 'Sofia Marino', initials: 'SM', maxPeriodsPerDay: 5, unavailable: [] },
  { id: 't-yuki', name: 'Yuki Sato', initials: 'YS', maxPeriodsPerDay: 4, unavailable: [] },
  { id: 't-nadia', name: 'Nadia Haddad', initials: 'NH', maxPeriodsPerDay: 4, unavailable: [] },
  { id: 't-owen', name: 'Owen Fletcher', initials: 'OF', maxPeriodsPerDay: 5, unavailable: [SLOT('fri', 'p1')] },
];

const SUBJECTS = [
  { id: 'maths', name: 'Mathematics', code: 'MAT', hue: 222, teacherId: 't-amara', weeklyPeriods: 4, maxPerDay: 1, sessionLength: 1, difficulty: 3, roomType: 'any' },
  { id: 'english', name: 'English', code: 'ENG', hue: 350, teacherId: 't-daniel', weeklyPeriods: 4, maxPerDay: 1, sessionLength: 1, difficulty: 3, roomType: 'any' },
  { id: 'physics', name: 'Physics', code: 'PHY', hue: 190, teacherId: 't-priya', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 3, roomType: 'lab' },
  { id: 'chemistry', name: 'Chemistry', code: 'CHE', hue: 158, teacherId: 't-tomas', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 3, roomType: 'lab' },
  { id: 'biology', name: 'Biology', code: 'BIO', hue: 96, teacherId: 't-grace', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 2, roomType: 'lab' },
  { id: 'history', name: 'History', code: 'HIS', hue: 32, teacherId: 't-hiro', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 2, roomType: 'any' },
  { id: 'geography', name: 'Geography', code: 'GEO', hue: 168, teacherId: 't-elena', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 2, roomType: 'any' },
  { id: 'cs', name: 'Computer Science', code: 'CSC', hue: 262, teacherId: 't-marcus', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 1, difficulty: 2, roomType: 'computer' },
  { id: 'spanish', name: 'Spanish', code: 'SPA', hue: 12, teacherId: 't-sofia', weeklyPeriods: 3, maxPerDay: 1, sessionLength: 1, difficulty: 2, roomType: 'any' },
  { id: 'art', name: 'Art & Design', code: 'ART', hue: 300, teacherId: 't-yuki', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 2, difficulty: 1, roomType: 'studio' },
  { id: 'music', name: 'Music', code: 'MUS', hue: 276, teacherId: 't-nadia', weeklyPeriods: 1, maxPerDay: 1, sessionLength: 1, difficulty: 1, roomType: 'music' },
  { id: 'pe', name: 'Physical Ed.', code: 'PED', hue: 140, teacherId: 't-owen', weeklyPeriods: 2, maxPerDay: 1, sessionLength: 2, difficulty: 1, roomType: 'gym' },
];

const CLASSES = [
  { id: 'c-10a', name: '10A', grade: 'Year 10', size: 28, homeRoomId: 'r-101', hue: 222 },
  { id: 'c-10b', name: '10B', grade: 'Year 10', size: 27, homeRoomId: 'r-102', hue: 158 },
  { id: 'c-11a', name: '11A', grade: 'Year 11', size: 26, homeRoomId: 'r-103', hue: 32 },
  { id: 'c-11b', name: '11B', grade: 'Year 11', size: 29, homeRoomId: 'r-104', hue: 350 },
  { id: 'c-12a', name: '12A', grade: 'Year 12', size: 24, homeRoomId: 'r-105', hue: 262 },
];

const ROOMS = [
  { id: 'r-101', name: 'R101', capacity: 30, type: 'standard' },
  { id: 'r-102', name: 'R102', capacity: 30, type: 'standard' },
  { id: 'r-103', name: 'R103', capacity: 30, type: 'standard' },
  { id: 'r-104', name: 'R104', capacity: 32, type: 'standard' },
  { id: 'r-105', name: 'R105', capacity: 30, type: 'standard' },
  { id: 'r-lab-a', name: 'Lab A', capacity: 32, type: 'lab' },
  { id: 'r-lab-b', name: 'Lab B', capacity: 32, type: 'lab' },
  { id: 'r-ict', name: 'ICT Suite', capacity: 32, type: 'computer' },
  { id: 'r-ict2', name: 'ICT Studio', capacity: 32, type: 'computer' },
  { id: 'r-art', name: 'Art Studio', capacity: 32, type: 'studio' },
  { id: 'r-music', name: 'Music Room', capacity: 32, type: 'music' },
  { id: 'r-gym', name: 'Sports Hall', capacity: 60, type: 'gym' },
];

export function demoData() {
  return structuredClone({
    version: 3,
    settings: {
      schoolName: 'Northgate Academy',
      termName: 'Autumn Term 2026',
      days: DEFAULT_DAYS,
      periods: DEFAULT_PERIODS,
      seed: null,
      generatedAt: null,
    },
    classes: CLASSES,
    subjects: SUBJECTS,
    teachers: TEACHERS,
    rooms: ROOMS,
    locks: [],
    ui: defaultPrefs(),
    result: null,
  });
}

export function defaultPrefs() {
  return {
    theme: 'aurora',
    accent: null, // null → use the theme's own accent
    density: 'cosy', // cosy | compact
    font: 'auto', // auto | grotesk | humanist | serif | mono
    motion: true,
    glass: true,
    grain: true,
    ambient: true,
    view: 'class', // class | teacher | room | agenda
    activeClassId: 'c-10a',
    activeTeacherId: 't-amara',
    activeRoomId: 'r-101',
    page: 'dashboard',
  };
}

/* ───────────────────── random school generator (stress test) ───────────── */

const FIRST = ['Amara', 'Daniel', 'Priya', 'Tomas', 'Grace', 'Hiroshi', 'Elena', 'Marcus', 'Sofia', 'Yuki', 'Nadia', 'Owen', 'Leila', 'Mateo', 'Ingrid', 'Kwame', 'Hana', 'Rafael', 'Zoe', 'Ivan', 'Noor', 'Felix'];
const LAST = ['Osei', 'Reyes', 'Nair', 'Lindqvist', 'Mwangi', 'Tanaka', 'Petrova', 'Bell', 'Marino', 'Sato', 'Haddad', 'Fletcher', 'Karim', 'Alves', 'Berg', 'Mensah', 'Kim', 'Duarte', 'Whitaker', 'Sorokin', 'Rahman', 'Braun'];
const SUBJ = [
  ['Mathematics', 'MAT', 222, 3], ['English', 'ENG', 350, 3], ['Physics', 'PHY', 190, 3],
  ['Chemistry', 'CHE', 158, 3], ['Biology', 'BIO', 96, 2], ['History', 'HIS', 32, 2],
  ['Geography', 'GEO', 168, 2], ['Computing', 'CSC', 262, 2], ['Spanish', 'SPA', 12, 2],
  ['French', 'FRE', 44, 2], ['Art', 'ART', 300, 1], ['Music', 'MUS', 276, 1],
  ['Drama', 'DRA', 320, 1], ['PE', 'PED', 140, 1], ['Economics', 'ECO', 205, 2],
  ['Design Tech', 'DTE', 76, 1],
];

/**
 * Build a random-but-feasible school. Demand is deliberately kept at ~70% of
 * capacity so the solver always has room to work with.
 */
export function randomSchool({ classes = 6, teachers = 14, subjects = 10, days = 5, periods = 8, seed = Date.now() } = {}) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

  const dayPool = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayDefs = dayPool.slice(0, days).map((id, i) => ({
    id,
    label: id[0].toUpperCase() + id.slice(1),
    full: id[0].toUpperCase() + id.slice(1) + 'day',
    active: true,
  }));

  const periodDefs = [];
  const startMinute = 8 * 60 + 30;
  for (let i = 0; i < periods; i += 1) {
    const begin = startMinute + i * 50 + (i === 2 ? 20 : 0) + (i === 4 ? 45 : 0);
    periodDefs.push({
      key: `p${i + 1}`,
      label: `Period ${i + 1}`,
      short: String(i + 1),
      start: fmt(begin),
      end: fmt(begin + 45),
      kind: 'lesson',
    });
    if (i === 1) {
      periodDefs.push({ key: 'br1', label: 'Break', short: '☕', start: fmt(begin + 45), end: fmt(begin + 65), kind: 'break' });
    }
    if (i === 3) {
      periodDefs.push({ key: 'lu', label: 'Lunch', short: '🍽', start: fmt(begin + 45), end: fmt(begin + 90), kind: 'lunch' });
    }
  }

  const usedNames = new Set();
  const teacherDefs = [];
  for (let i = 0; i < teachers; i += 1) {
    let name = `${pick(FIRST)} ${pick(LAST)}`;
    let guard = 0;
    while (usedNames.has(name) && guard < 40) {
      name = `${pick(FIRST)} ${pick(LAST)}`;
      guard += 1;
    }
    usedNames.add(name);
    const unavailable = [];
    if (rnd() < 0.5) {
      const day = pick(dayDefs).id;
      unavailable.push(SLOT(day, periodDefs.filter((p) => p.kind === 'lesson')[int(0, periods - 1)].key));
    }
    teacherDefs.push({
      id: `t-${i}`,
      name,
      initials: name.split(' ').map((n) => n[0]).join(''),
      maxPeriodsPerDay: int(5, 7),
      unavailable,
    });
  }

  const shuffled = [...SUBJ].sort(() => rnd() - 0.5).slice(0, subjects);
  const slotsPerWeek = days * periods;
  const classDefs = [];
  for (let i = 0; i < classes; i += 1) {
    classDefs.push({
      id: `c-${i}`,
      name: `${int(7, 12)}${String.fromCharCode(65 + i)}`,
      grade: `Year ${int(7, 13)}`,
      size: int(20, 30),
      homeRoomId: `r-${i}`,
      hue: int(0, 359),
    });
  }

  const subjectDefs = shuffled.map(([name, code, hue, difficulty], i) => {
    const weekly = int(1, Math.max(1, Math.min(4, Math.floor((slotsPerWeek * 0.7) / subjects))));
    const sessionLength = difficulty === 1 && weekly === 2 && rnd() < 0.5 ? 2 : 1;
    return {
      id: `s-${i}`,
      name,
      code,
      hue,
      teacherId: teacherDefs[i % teacherDefs.length].id,
      weeklyPeriods: weekly,
      maxPerDay: weekly > 3 ? 2 : 1,
      sessionLength,
      difficulty,
      roomType: 'any',
    };
  });

  const roomDefs = classDefs.map((klass, i) => ({
    id: `r-${i}`,
    name: `R${101 + i}`,
    capacity: klass.size + 4,
    type: 'standard',
  }));
  roomDefs.push({ id: 'r-hall', name: 'Assembly Hall', capacity: 200, type: 'standard' });

  return structuredClone({
    version: 3,
    settings: {
      schoolName: `Random School #${int(100, 999)}`,
      termName: 'Generated dataset',
      days: [...dayDefs, { id: 'sun', label: 'Sun', full: 'Sunday', active: false }],
      periods: periodDefs,
      seed,
      generatedAt: null,
    },
    classes: classDefs,
    subjects: subjectDefs,
    teachers: teacherDefs,
    rooms: roomDefs,
    locks: [],
    ui: defaultPrefs(),
    result: null,
  });
}

function fmt(minute) {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
