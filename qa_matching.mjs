// Independent behavioral audit. This deliberately imports the production scorer.
// Uniform random answers are a stress test, never an estimate of real users.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { QUESTIONS, SERVANTS, AXES, calculateResult } from './data.js';
import { buildAnswerReading } from './reading.js';
import { createAffinityMatcher } from './matching.js';

const argv = process.argv.slice(2);
const argument = (name, fallback) => {
  const at = argv.indexOf(name);
  return at < 0 ? fallback : argv[at + 1];
};
const sampleCount = Number(argument('--samples', '20000'));
assert(Number.isInteger(sampleCount) && sampleCount > 0);
const fixturePath = new URL('./qa_matching_fixtures.json', import.meta.url);
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
let checks = 0;
const failures = [];
const ok = (condition, message) => { assert(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const requireResult = (condition, message) => { checks++; if (!condition) failures.push(message); };
let seed = 0x7a138b4f;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const randomAnswers = () => QUESTIONS.map(q => Math.floor(random() * q.options.length));
const neutral = QUESTIONS.map(q => q.options.findIndex(o => o.neutral));
const cultureIndexes = QUESTIONS.flatMap((q, i) => q.category === 'culture' ? [i] : []);
const idSet = new Set(SERVANTS.map(s => s.id));
const readingAxisByTitle = new Map([
  ['先保全能够延续的现实',0], ['有些界限，你不愿只按得失交换',0],
  ['你会认真对待身处其中的判断',1], ['先把关键条件弄清，再作判断',1],
  ['为个人的决定保留边界',2], ['把同行者也放进决定里',2],
  ['重要的立场，也可以留在私下',3], ['愿意让别人知道你站在哪里',3],
  ['旧安排失效时，愿意重新选择',4], ['看重能够让人互相依赖的约定',4],
  ['给决定留一点时间',5], ['愿意先作决定，再承担后果',5],
]);

function independentlyScore(answers) {
  return AXES.map((_, axis) => {
    let total = 0, minimum = 0, maximum = 0;
    QUESTIONS.forEach((q, i) => {
      const selected = q.options[answers[i]];
      if (selected.neutral) return;
      const options = q.options.filter(o => !o.neutral).map(o => o.scores[axis]);
      total += selected.scores[axis] * q.weight;
      minimum += Math.min(...options) * q.weight;
      maximum += Math.max(...options) * q.weight;
    });
    return maximum === minimum ? 50 : Math.round(100 * (total - minimum) / (maximum - minimum));
  });
}

function auditExplanation(answers, result) {
  equal(result.scores, independentlyScore(answers), 'displayed axes must equal actual weighted answers');
  ok(idSet.has(result.best.id), 'valid matched servant');
  ok(Number.isFinite(result.resonance) && result.resonance >= 0 && result.resonance <= 100, 'finite bounded resonance');
  ok(result.runnersUp.length === 2 && new Set([result.best.id, ...result.runnersUp.map(s => s.id)]).size === 3, 'distinct ranked candidates');
  ok(result.evidence.length === 3 && result.reasons.length === 3, 'three reasons and evidence');
  equal(new Set(result.evidence.map(e => e.questionIndex)).size, 3, 'evidence questions are distinct');
  equal(new Set(result.evidence.map(e => e.axisId)).size, 3, 'evidence axes are distinct');
  result.evidence.forEach((e, i) => {
    const q = QUESTIONS[e.questionIndex], selected = q.options[answers[e.questionIndex]];
    const axis = AXES.findIndex(a => a.id === e.axisId), value = selected.scores[axis];
    equal(e.answerIndex, answers[e.questionIndex], 'evidence answer index is real');
    equal(e.answerText, selected.text, 'evidence answer text is real');
    ok(!selected.neutral && value !== 0, 'neutral/zero cannot supply evidence');
    ok(q.options.some(o => !o.neutral && o.scores[axis] !== value), 'unchanging question trait cannot supply evidence');
    equal(e.shared, result.best.profile[axis] !== 50 && Math.sign(result.best.profile[axis] - 50) === Math.sign(value), 'shared trait has correct character direction');
    equal(e.coherent, result.scores[axis] !== 50 && Math.sign(result.scores[axis] - 50) === Math.sign(value), 'coherent trait has correct user direction');
    equal(e.supportive, e.shared && e.coherent, 'supportive flag cannot turn disagreement into proof');
    ok(result.reasons[i].includes(selected.excerpt), 'reason cites actual selected excerpt');
    if (!e.coherent) ok(result.reasons[i].includes('不能只凭这一题'), 'contextual answer must be qualified');
    else if (!e.shared) ok(result.reasons[i].includes('未必会选同一条路'), 'difference must remain explicit');
    if (q.category === 'culture' && e.supportive) ok(result.reasons[i].includes('不会单凭这一题'), 'aesthetic support must be qualified');
  });
  const readings = buildAnswerReading(answers, result);
  ok(readings.length <= 3, 'at most three personal readings');
  readings.forEach(reading => {
    const mixed = reading.title.endsWith('面对不同处境，你会换一种选择');
    const axis = mixed ? AXES.findIndex(a => reading.title.startsWith(`${a.name}：`)) : readingAxisByTitle.get(reading.title);
    ok(Number.isInteger(axis) && axis >= 0, 'reading axis is recognized');
    equal(reading.evidence.length, mixed ? 4 : 2, 'personal reading needs repeated actual evidence');
    equal(new Set(reading.evidence.map(e => e.questionIndex)).size, reading.evidence.length, 'reading evidence questions are distinct');
    const signs = reading.evidence.map(e => {
      const q = QUESTIONS[e.questionIndex], selected = q.options[answers[e.questionIndex]];
      equal(e.answerText, selected.text, 'personal reading cites real chosen answer');
      ok(!selected.neutral && q.category !== 'culture' && q.weight >= 0.65, 'only core answers prove personal reading');
      ok(Math.abs(selected.scores[axis]) >= 0.6 && q.options.some(o => !o.neutral && o.scores[axis] !== selected.scores[axis]), 'reading signal is informative');
      return Math.sign(selected.scores[axis]);
    });
    if (mixed) equal(signs.filter(s => s > 0).length, 2, 'mixed reading needs two actual answers on each side');
    else equal(signs[0], signs[1], 'dominant reading has repeated same direction');
  });
}

const semantic = fixtures.map(fixture => {
  fixture.keyChoices.forEach(key => equal(fixture.answers[QUESTIONS.findIndex(q => q.id === key.question)], key.answerIndex, `${fixture.id}: real key choices`));
  const result = calculateResult(fixture.answers);
  auditExplanation(fixture.answers, result);
  equal(calculateResult([...fixture.answers]), result, `${fixture.id}: same answers must be stable`);
  for (const name of ['', '张三', 'Sakura', 'Émile', 'マスター']) {
    // The scorer's public input is answers alone; extra data must not influence it.
    equal(calculateResult(fixture.answers, name), result, 'names must not affect matching');
  }
  for (const [axisId, direction] of Object.entries(fixture.expectedDirection)) {
    const value = result.scores[AXES.findIndex(a => a.id === axisId)];
    ok(direction === 'high' ? value > 50 : value < 50, `${fixture.id}: expected ${axisId} direction`);
  }
  requireResult(fixture.expectedFamily.includes(result.best.id), `${fixture.id}: ${result.best.id} falls outside intended semantic family ${fixture.expectedFamily.join('/')}`);
  const cultureCounts = {};
  let combinations = 0;
  function varyCulture(position, answers) {
    if (position === cultureIndexes.length) {
      const id = calculateResult(answers).best.id;
      cultureCounts[id] = (cultureCounts[id] || 0) + 1;
      combinations++;
      return;
    }
    const i = cultureIndexes[position];
    QUESTIONS[i].options.forEach((_, option) => { const next = [...answers]; next[i] = option; varyCulture(position + 1, next); });
  }
  varyCulture(0, fixture.answers);
  return { id: fixture.id, best: result.best.id, runnersUp: result.runnersUp.map(s => s.id), scores: result.scores, cultureCombinations: combinations, cultureCounts };
});

const counts = Object.fromEntries(SERVANTS.map(s => [s.id, 0]));
const witnesses = {};
for (let i = 0; i < sampleCount; i++) {
  const answers = randomAnswers(), result = calculateResult(answers);
  counts[result.best.id]++;
  witnesses[result.best.id] ??= answers;
  if (i < 100) {
    auditExplanation(answers, result);
    equal(calculateResult(answers), result, 'random replay is deterministic');
    const skipped = answers.map((a, index) => neutral[index] >= 0 ? neutral[index] : a);
    const neutralResult = calculateResult(skipped);
    equal(neutralResult.scores, independentlyScore(skipped), 'aesthetic skips are excluded from both totals and ranges');
    ok(!neutralResult.evidence.some(e => QUESTIONS[e.questionIndex].options[skipped[e.questionIndex]].neutral), 'aesthetic skips never supply evidence');
  }
}
const distribution = SERVANTS.map(s => ({ id: s.id, count: counts[s.id], percent: Number((100 * counts[s.id] / sampleCount).toFixed(3)) })).sort((a, b) => b.count - a.count);
const reachable = distribution.filter(row => row.count > 0).length;
requireResult(distribution[0].percent < 20, 'uniform random stress test must not be dominated by a single role');
requireResult(reachable === SERVANTS.length, 'every role must have an actual reproducible answer witness');

// These metamorphic checks transform the inputs without reproducing the model's
// formula. They protect the meaning of directions, active sets and neutral data.
const matcher = createAffinityMatcher(QUESTIONS, SERVANTS);
const sameRanking = (actual, expected, message) => {
  equal(actual.ranked.map(row => row.servant.id), expected.ranked.map(row => row.servant.id), `${message}: ranking`);
  actual.ranked.forEach((row, i) => ok(Math.abs(row.distance - expected.ranked[i].distance) < 1e-10, `${message}: distance`));
  equal(actual.weakSignal, expected.weakSignal, `${message}: weak signal`);
};
let activeContexts = 0;
for (let mask = 0; mask < 2 ** cultureIndexes.length; mask++) {
  const answers = fixtures[0].answers.map((answer, i) => {
    const optional = cultureIndexes.indexOf(i);
    return optional < 0 ? answer : (mask & (1 << optional) ? neutral[i] : 0);
  });
  const active = QUESTIONS.map((q, i) => !q.options[answers[i]].neutral);
  const omitted = createAffinityMatcher(QUESTIONS.filter((_, i) => active[i]), SERVANTS);
  sameRanking(matcher(answers), omitted(answers.filter((_, i) => active[i])), 'neutral question equals omitted question');
  activeContexts++;
}
const permutations = [
  { order: [5,4,3,2,1,0], signs: [1,1,1,1,1,1] },
  { order: [1,2,3,4,5,0], signs: [-1,1,-1,1,-1,1] },
  { order: [0,1,2,3,4,5], signs: [-1,-1,-1,-1,-1,-1] },
];
for (const { order, signs } of permutations) {
  const transformedQuestions = QUESTIONS.map(q => ({ ...q, options: q.options.map(option => ({
    ...option, scores: order.map((axis, i) => option.scores[axis] * signs[i]),
  })) }));
  const transformedServants = SERVANTS.map(servant => ({ ...servant,
    profile: order.map((axis, i) => 50 + (servant.profile[axis] - 50) * signs[i]),
  }));
  const transformed = createAffinityMatcher(transformedQuestions, transformedServants);
  fixtures.forEach(fixture => sameRanking(transformed(fixture.answers), matcher(fixture.answers), 'axis permutation/sign reversal'));
}
const extraNeutral = createAffinityMatcher(QUESTIONS.map(q => ({ ...q, options: [
  ...q.options, { text: 'Unchosen neutral audit option', neutral: true, scores: AXES.map(() => 99999) },
] })), SERVANTS);
const scaledWeights = createAffinityMatcher(QUESTIONS.map(q => ({ ...q, weight: q.weight * 3.7 })), SERVANTS);
const shiftedScores = createAffinityMatcher(QUESTIONS.map(q => ({ ...q, options: q.options.map(option => ({
  ...option, scores: option.scores.map((value, axis) => value + axis + 3),
})) })), SERVANTS);
fixtures.forEach(fixture => {
  const expected = matcher(fixture.answers);
  sameRanking(extraNeutral(fixture.answers), expected, 'unchosen neutral option is irrelevant');
  sameRanking(scaledWeights(fixture.answers), expected, 'global weight units do not affect direction');
  sameRanking(shiftedScores(fixture.answers), expected, 'constant option scores cannot imply a trait');
});
const centreQuestion = { weight: 1, options: [
  { scores: AXES.map(() => 0) }, { scores: AXES.map(() => 1) }, { scores: AXES.map(() => -1) },
] };
const centered = createAffinityMatcher([centreQuestion], SERVANTS)([0]);
ok(centered.weakSignal, 'exactly centred answer has weak evidence');
ok(centered.ranked.every(row => Number.isFinite(row.distance)), 'centred answer never yields NaN');
ok(centered.ranked.every(row => Math.abs(row.distance - centered.ranked[0].distance) < 1e-12), 'no centre profile wins merely by being closer to origin');
equal(centered.ranked.map(row => row.servant.id), [...SERVANTS].sort((a,b) => a.id.localeCompare(b.id, 'en')).map(row => row.id), 'centre ties are deterministic');
const app = fs.readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const calls = [...app.matchAll(/calculateResult\(([^)]*)\)/g)].map(match => match[1].trim());
ok(calls.length >= 2 && calls.every(call => call === 'state.answers'), 'application passes answers alone to scorer');
const report = {
  passed: failures.length === 0, failures, checks, sampleCount, seed: '0x7a138b4f',
  modelVersion: calculateResult(fixtures[0].answers).modelVersion,
  sourceDigests: Object.fromEntries(['matching.js','data.js','reading.js','qa_matching_fixtures.json'].map(name =>
    [name, createHash('sha256').update(fs.readFileSync(new URL(name, import.meta.url))).digest('hex')])),
  note: 'Every displayed option is equally likely in this deterministic stress test. This is not real-user analytics or a target of equal quotas.',
  activeContexts, semantic, coverage: `${reachable}/${SERVANTS.length}`, distribution, witnesses,
};
const reportPath = new URL(argument('--report', './qa/matching-audit.json'), import.meta.url);
fs.mkdirSync(new URL('./', reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: report.passed, failures, checks, sampleCount, activeContexts, coverage: report.coverage, semantic, distribution, report: fileURLToPath(reportPath) }, null, 2));
if (failures.length) process.exitCode = 1;
