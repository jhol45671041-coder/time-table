/**
 * Engine benchmark — how the solver scales, and proof it stays conflict-free.
 *
 *   npm run bench
 */
import { buildModel, schedule, validate } from '../js/scheduler.js';
import { demoData, randomSchool } from '../js/seed.js';

const CASES = [
  { label: 'demo school (Northgate)', data: () => demoData() },
  { label: 'tiny · 2 classes', data: () => randomSchool({ classes: 2, teachers: 6, subjects: 5, days: 3, periods: 5, seed: 11 }) },
  { label: 'small · 4 classes', data: () => randomSchool({ classes: 4, teachers: 9, subjects: 7, days: 4, periods: 6, seed: 22 }) },
  { label: 'medium · 6 classes', data: () => randomSchool({ classes: 6, teachers: 12, subjects: 9, days: 5, periods: 7, seed: 33 }) },
  { label: 'large · 8 classes', data: () => randomSchool({ classes: 8, teachers: 16, subjects: 11, days: 5, periods: 8, seed: 44 }) },
  { label: 'xlarge · 10 classes', data: () => randomSchool({ classes: 10, teachers: 18, subjects: 12, days: 5, periods: 8, seed: 55 }) },
  { label: 'huge · 12 classes', data: () => randomSchool({ classes: 12, teachers: 22, subjects: 14, days: 5, periods: 8, seed: 66 }) },
  { label: 'six-day · 10 classes', data: () => randomSchool({ classes: 10, teachers: 20, subjects: 13, days: 6, periods: 8, seed: 77 }) },
];

const pad = (value, width) => String(value).padStart(width);
const padEnd = (value, width) => String(value).padEnd(width);

process.stdout.write('\n\x1b[1mTimetable Studio — solver benchmark\x1b[0m\n\n');
process.stdout.write(
  `${padEnd('dataset', 26)}${pad('lessons', 8)}${pad('slots', 7)}${pad('first', 8)}${pad('3 runs', 9)}` +
  `${pad('quality', 9)}${pad('holes', 7)}${pad('unplaced', 9)}${pad('clashes', 9)}\n`,
);
process.stdout.write(`${'─'.repeat(93)}\n`);

let totalClashes = 0;
let totalUnplaced = 0;

for (const testCase of CASES) {
  const data = testCase.data();
  const model = buildModel(data);
  const slots = model.slots.filter((s) => s.teaching).length;

  // single run, stopping at the first complete solution
  let t = process.hrtime.bigint();
  const single = schedule(model, { timeBudgetMs: 4000, improveAfterSolve: false });
  const firstMs = Number(process.hrtime.bigint() - t) / 1e6;

  // what the UI actually does: three candidates, best one wins
  t = process.hrtime.bigint();
  const budget = Math.max(200, Math.min(700, Math.round(120 + model.lessons.length * 0.9)));
  const runs = [0, 1, 2].map((i) => schedule(model, { seed: 1000 + i * 7919, timeBudgetMs: budget }));
  const threeMs = Number(process.hrtime.bigint() - t) / 1e6;
  runs.sort((a, b) => a.unplaced.length - b.unplaced.length || b.metrics.quality - a.metrics.quality);
  const best = runs[0];

  // independent re-audit of the winner
  const clashes = validate(model, best).length;
  totalClashes += clashes;
  totalUnplaced += best.unplaced.length;

  process.stdout.write(
    `${padEnd(testCase.label, 26)}${pad(model.lessons.length, 8)}${pad(slots, 7)}` +
    `${pad(`${firstMs.toFixed(0)}ms`, 8)}${pad(`${threeMs.toFixed(0)}ms`, 9)}` +
    `${pad(best.metrics.quality, 9)}${pad(best.metrics.classHoles, 7)}` +
    `${pad(best.unplaced.length, 9)}${pad(clashes, 9)}\n`,
  );
}

process.stdout.write(`${'─'.repeat(93)}\n`);
process.stdout.write(
  totalClashes === 0 && totalUnplaced === 0
    ? `\n\x1b[32m✓ every dataset solved completely with zero clashes\x1b[0m\n\n`
    : `\n\x1b[31m✗ ${totalUnplaced} unplaced lessons, ${totalClashes} clashes\x1b[0m\n\n`,
);

process.exit(totalClashes === 0 ? 0 : 1);
