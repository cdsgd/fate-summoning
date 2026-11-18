// Behavioral contracts and answer-grounded explanation and five-star preference audit for v12.
// Synthetic answers stress the model; they are not measurements of real users.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { AXES, STAGES, QUESTIONS, SERVANTS, STORAGE_KEY, MATCHING_VERSION, FIVE_STAR_SUMMON_BONUS, calculateResult } from './data.js';
import { BEHAVIOR_AXES, SERVANT_BEHAVIOR, analyzeBehavior, rankBehavior } from './behavior.js';
import { buildAnswerReading } from './reading.js';
import { buildValueObservations, buildMatchExplanation } from './explanations.js';
import { createAffinityMatcher } from './matching.js';
import { WISH_PRIORITIES, wishAffinity } from './wish-priorities.js';

const sourceFiles = ['questions-v11.json','data.js','behavior.js','matching.js','reading.js','explanations.js','wish-priorities.js'];
const sourceDigests = () => Object.fromEntries(sourceFiles.map(name => [name,
  createHash('sha256').update(fs.readFileSync(new URL(name,import.meta.url))).digest('hex')]));
const sourcesAtStart = sourceDigests();

const args = process.argv.slice(2);
const argument = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const sampleCount = Number(argument('--samples', '50000'));
assert(Number.isInteger(sampleCount) && sampleCount > 0);
const failures = [], sections = {};
let checks = 0, section = 'structure';
const check = (condition, message, details) => {
  checks++;
  sections[section] = (sections[section] || 0) + 1;
  if (!condition) failures.push({ section, message, ...(details === undefined ? {} : { details }) });
};
const equal = (actual, expected, message) => {
  let pass = true;
  try { assert.deepEqual(actual, expected); } catch { pass = false; }
  check(pass, message, pass ? undefined : { actual, expected });
};
const clone = value => JSON.parse(JSON.stringify(value));
const at = id => QUESTIONS.findIndex(q => q.id === id);
const base = () => QUESTIONS.map(q => q.type === 'scale' ? 3 : 0);
const setChoice = (answers, id, index) => {
  const i = at(id);
  assert(i >= 0 && QUESTIONS[i].options[index], `Unknown choice ${id}:${index}`);
  answers[i] = index;
  return answers;
};
const chooseBehavior = (answers, facetId, signs) => {
  const indexes = QUESTIONS.flatMap((q, i) => q.behaviorFacet === facetId ? [i] : []);
  assert(indexes.length === signs.length, `${facetId}: two declared questions required`);
  indexes.forEach((i, j) => {
    const option = QUESTIONS[i].options.findIndex(o => o.behavior?.[facetId] === signs[j]);
    assert(option >= 0, `${QUESTIONS[i].id}: missing behavior ${signs[j]}`);
    answers[i] = option;
  });
  return answers;
};
const chooseAllBehavior = (answers, directions) => {
  BEHAVIOR_AXES.forEach((axis, i) => chooseBehavior(answers, axis.id, [directions[i], directions[i]]));
  return answers;
};

equal(QUESTIONS.length, 32, '32 questions');
equal(MATCHING_VERSION,'evidence-and-behavior-v12','new ranking has a distinct model version');
equal(FIVE_STAR_SUMMON_BONUS,.03,'the five-star preference is one modest shared constant');
equal(STAGES.length, 4, 'four chapters');
equal(STAGES.map((_, stage) => QUESTIONS.filter(q => q.stage === stage).length), [8,8,8,8], 'eight questions per chapter');
check(QUESTIONS.every((q, i) => q.stage === Math.floor(i / 8)), 'chapters remain continuous');
equal(new Set(QUESTIONS.map(q => q.id)).size, 32, 'question IDs remain unique after insertion');
equal(QUESTIONS.filter(q => q.category === 'war').length, 7, 'seven actor war scenarios');
equal(QUESTIONS.filter(q => q.category === 'intimacy').length, 3, 'three relationship questions');
equal(QUESTIONS.filter(q => q.category === 'culture').length, 3, 'three non-scoring aesthetic scenes');
equal(QUESTIONS.filter(q => q.type === 'scale').length, 2, 'two attitude scales');
equal(QUESTIONS.filter(q => q.behaviorFacet).length, 8, 'eight behavioral scenes');
equal(QUESTIONS.at(-1).category, 'wish', 'Grail is the last question');
equal(QUESTIONS.at(-1).options.length, 7, 'Grail offers seven distinct concrete wishes');
check(QUESTIONS.at(-1).options.some(o => /财富|亿元|现金/.test(o.text)), 'a personal wealth wish is selectable');
check(STORAGE_KEY.endsWith('v11'), 'new option meanings use a new save namespace');
equal(SERVANTS.length, 24, '24 servants');
for (const q of QUESTIONS) {
  check(typeof q.title === 'string' && q.title.length > 0, `${q.id}: a concrete question`);
  check(Array.isArray(q.measures), `${q.id}: measured value axes declared explicitly`);
  check(q.role?.length > 0 && q.authority?.length > 0, `${q.id}: actor and decision boundary present`);
  check(Number.isFinite(q.weight) && q.weight >= 0, `${q.id}: finite nonnegative weight`);
  const declared = q.measures || [];
  check(declared.every(id => AXES.some(axis => axis.id === id)), `${q.id}: only known value axes`);
  for (const [i, o] of q.options.entries()) {
    check(o.scores?.length === AXES.length && o.scores.every(Number.isFinite), `${q.id}:${i}: finite six-axis vector`);
    check(o.scores.every((value, axis) => value === 0 || declared.includes(AXES[axis].id)), `${q.id}:${i}: numeric evidence belongs to declared measures`);
    check(Array.isArray(o.measures) && o.scores.every((value, axis) => value === 0 || o.measures.includes(AXES[axis].id)), `${q.id}:${i}: option permits its own nonzero evidence`);
    check(o.measures?.every(id => declared.includes(id)), `${q.id}:${i}: option cannot expand the question's measurement boundary`);
    check(typeof o.text === 'string' && o.text.length > 0, `${q.id}:${i}: nonempty selectable text`);
    if (q.category === 'culture' || q.behaviorFacet) equal(o.scores, AXES.map(() => 0), `${q.id}:${i}: no value-axis leakage`);
    if (q.behaviorFacet) {
      equal(Object.keys(o.behavior || {}), [q.behaviorFacet], `${q.id}:${i}: measures only its declared behavior`);
      check([-1,0,1].includes(o.behavior?.[q.behaviorFacet]), `${q.id}:${i}: bounded behavior response`);
    } else check(!o.behavior || Object.keys(o.behavior).length === 0, `${q.id}:${i}: value/wish/aesthetic answer cannot classify behavior`);
    if (o.neutral) equal(o.scores, AXES.map(() => 0), `${q.id}:${i}: skipping cannot imply an axis`);
  }
  if (q.behaviorFacet) equal(declared, [], `${q.id}: behavioral prompt declares no value measure`);
  if (q.category === 'culture') equal(declared, [], `${q.id}: aesthetics declare no personality evidence`);
  if (q.type === 'scale') {
    equal(q.options.length, 7, `${q.id}: seven-point scale`);
    equal(q.options[3].scores, AXES.map(() => 0), `${q.id}: scale centre is neutral evidence`);
    check(!q.options[3].neutral, `${q.id}: scale middle remains an answer`);
  }
  if (q.category === 'war') check(q.inspiration?.sourceUrl?.startsWith('https://') && q.inspiration?.servantId, `${q.id}: original actor story retains its cited inspiration`);
}
for (const axis of BEHAVIOR_AXES) equal(QUESTIONS.filter(q => q.behaviorFacet === axis.id).length, 2, `${axis.id}: repeated observation across two scenes`);
for (let axis = 0; axis < AXES.length; axis++) {
  check(QUESTIONS.some(q => q.options.some(o => o.scores[axis] > 0)), `${AXES[axis].id}: positive evidence exists`);
  check(QUESTIONS.some(q => q.options.some(o => o.scores[axis] < 0)), `${AXES[axis].id}: negative evidence exists`);
}

const validateEvidence = (e, answers, message) => {
  const q = QUESTIONS[e.questionIndex], index = answers[e.questionIndex], answer = q?.options[index];
  check(!!q && e.questionId === q.id && e.answerIndex === index && e.answerText === answer?.text, message);
  return { q, answer };
};
const validateObservation = (item, answers) => {
  const axisIndex = AXES.findIndex(axis => axis.id === item.axisId);
  check(axisIndex >= 0, 'value reading has a declared axis');
  check(item.evidence.length >= 2 && new Set(item.evidence.map(e => e.questionId)).size === item.evidence.length, 'value reading needs independent questions');
  const signals = item.evidence.map(e => {
    const { q, answer } = validateEvidence(e, answers, 'value reading cites the exact selected answer');
    check(q.category !== 'culture' && q.category !== 'wish' && !q.behaviorFacet && q.measures.includes(item.axisId), 'only explicitly measured value choice supports a value reading');
    check(answer.scores[axisIndex] !== 0, 'zero is not value evidence');
    return Math.sign(answer.scores[axisIndex]);
  });
  if (item.state === 'mixed') check(signals.includes(-1) && signals.includes(1) && item.side === null, 'mixed value reading preserves both sides');
  else {
    const support = item.supportEvidence || item.evidence.filter(e => Math.sign(QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].scores[axisIndex]) === item.side);
    check(support.length >= 2 && [-1,1].includes(item.side), 'directional value reading has two same-side answers');
    check(support.every(e => Math.sign(QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].scores[axisIndex]) === item.side), 'directional reading evidence matches its direction');
  }
};
const independentlyScore = answers => AXES.map((_, axis) => {
  let total = 0, minimum = 0, maximum = 0;
  QUESTIONS.forEach((q, i) => {
    const o = q.options[answers[i]];
    if (o.neutral) return;
    const values = q.options.filter(c => !c.neutral).map(c => c.scores[axis]);
    total += q.weight * o.scores[axis]; minimum += q.weight * Math.min(...values); maximum += q.weight * Math.max(...values);
  });
  return maximum === minimum ? 50 : Math.round(100 * (total - minimum) / (maximum - minimum));
});
function auditResult(answers, result) {
  equal(result.scores, independentlyScore(answers), 'displayed axes describe weighted real answers');
  equal(result.fiveStarSummonBonus,.03,'all results report the same global five-star preference');
  equal(result.summonBonusApplied,result.best.game.rarity===5?.03:0,'only the selected five-star has the shared bonus');
  equal(result.summonSimilarity,result.rawSimilarity+result.summonBonusApplied,'rarity changes summon order without changing raw answer similarity');
  equal(result.resonance,Math.max(0,Math.min(100,Math.round(100*(1-Math.sqrt(Math.max(0,2-2*result.rawSimilarity))/2)))),'resonance never adds rarity preference to personality affinity');
  check(Number.isFinite(result.resonance) && result.resonance >= 0 && result.resonance <= 100, 'bounded finite match index');
  check(new Set([result.best.id, ...result.runnersUp.map(s => s.id)]).size === 3, 'best and runners are distinct');
  check(result.summary !== result.best.summary, 'generic servant paragraph cannot become a player claim');
  check(result.reasonGroups.length <= 3, 'match explanation does not force extra reasons');
  equal(result.reasons, result.reasonGroups.map(g => g.text), 'visible reasons are generated from structured evidence');
  for (const [kind, groups] of [['support',result.reasonGroups], ['difference',result.differences]]) for (const group of groups) {
    equal(group.kind, kind, 'differences are kept separate from support');
    check(group.evidence.length >= 2 && new Set(group.evidence.map(e => e.questionId)).size === group.evidence.length, 'each match claim has two different questions');
    for (const e of group.evidence) {
      const { q, answer } = validateEvidence(e, answers, 'match claim cites the exact selected answer');
      check(q.category !== 'culture' && q.category !== 'wish', 'aesthetic or single wish cannot support a personality claim');
      if (group.source === 'behavior') {
        check(q.behaviorFacet === group.axisId && Math.sign(answer.behavior?.[group.axisId]) === group.side, 'behavior claim uses repeated same-facet same-side answers');
        check(result.behavior.facets.find(f => f.id === group.axisId)?.side === group.side, 'mixed behavior cannot become positive match proof');
        const facetIndex = BEHAVIOR_AXES.findIndex(axis => axis.id === group.axisId);
        equal(Math.sign(SERVANT_BEHAVIOR[result.best.id][facetIndex] - 50) === group.side, kind === 'support', 'behavior agreement or difference uses the same character facet');
      } else {
        const axisIndex = AXES.findIndex(axis => axis.id === group.axisId);
        check(!q.behaviorFacet && q.measures.includes(group.axisId) && Math.sign(answer.scores[axisIndex]) === group.side, 'value claim uses declared same-axis same-side answers');
        equal(Math.sign(result.best.profile[axisIndex] - 50) === group.side, kind === 'support', 'character agreement has the claimed sign');
      }
    }
    for (const e of group.counterEvidence || []) {
      const {q,answer} = validateEvidence(e,answers,'a stated counterexample cites the exact actual answer');
      const axisIndex = AXES.findIndex(axis => axis.id === group.axisId);
      check(group.source === 'value' && q.category !== 'culture' && q.category !== 'wish' && !q.behaviorFacet && q.measures.includes(group.axisId) && Math.sign(answer.scores[axisIndex]) === -group.side,'a counterexample is opposite evidence on the same declared value axis');
      check(!group.evidence.some(support=>support.questionId === e.questionId),'a counterexample cannot also be counted as same-side support');
    }
  }
  equal(result.evidence.length,result.reasonGroups.length,'legacy reason links count only positive support groups');
  result.evidence.forEach((e,i)=>{
    validateEvidence(e,answers,'legacy reason link preserves the actual saved answer');
    equal(e.questionId,result.reasonGroups[i].evidence[0].questionId,'legacy reason link points to its own support group');
  });
  for (const item of buildAnswerReading(answers, result)) validateObservation(item, answers);
  for (const item of buildValueObservations(QUESTIONS, answers, AXES)) validateObservation(item, answers);
  const wish = QUESTIONS.findIndex(q => q.category === 'wish');
  validateEvidence(result.wishReading, answers, 'wish reading faithfully records one concrete choice');
  equal(result.wishReading.questionIndex, wish, 'wish evidence points to the inserted final index');
}

section = 'behavior';
for (let mask = 0; mask < 16; mask++) {
  const directions = BEHAVIOR_AXES.map((_, i) => mask & (1 << i) ? 1 : -1);
  const answers = chooseAllBehavior(base(), directions), analysis = analyzeBehavior(QUESTIONS, answers);
  equal(analysis.coverage, 1, 'four repeated behavioral preferences are available');
  analysis.facets.forEach((f, i) => {
    equal(f.side, directions[i], `${f.id}: the semantic direction follows actual choices`);
    equal(f.status, 'consistent', `${f.id}: consistent status`);
    equal(f.coherence, 1, `${f.id}: consistent evidence coherence`);
    equal(f.evidence.length, 2, `${f.id}: exactly two real scenes`);
    f.evidence.forEach(e => validateEvidence(e, answers, `${f.id}: exact actual behavior evidence`));
  });
  const result = calculateResult(answers);
  equal(result.behavior, analysis, 'result uses independently analyzed behavior');
  equal(result.behaviorWeight, 0.25, 'complete behavioral evidence has one shared global weight');
}
for (const axis of BEHAVIOR_AXES) {
  const answers = chooseAllBehavior(base(), [-1,-1,-1,-1]);
  chooseBehavior(answers, axis.id, [-1,1]);
  const analysis = analyzeBehavior(QUESTIONS, answers), f = analysis.facets.find(f => f.id === axis.id);
  equal(f.side, null, `${axis.id}: contradictory answers do not force a direction`);
  equal(f.status, 'mixed', `${axis.id}: contradiction remains visible`);
  equal(f.coherence, 0, `${axis.id}: two opposite signals are incoherent`);
  equal(f.evidence.map(e => e.value), [-1,1], `${axis.id}: evidence preserves both choices`);
  equal(analysis.coverage, .75, `${axis.id}: contradiction reduces usable coverage`);
  const result = calculateResult(answers);
  check(!result.reasonGroups.some(g => g.source === 'behavior' && g.axisId === axis.id), `${axis.id}: no one-sided match proof from conflicting evidence`);
  const removed = clone(analysis); removed.facets = removed.facets.filter(f => f.id !== axis.id);
  equal(rankBehavior(analysis,SERVANTS).ranked, rankBehavior(removed,SERVANTS).ranked, `${axis.id}: contradictory facet cannot alter similarity`);
}
const consistent = chooseAllBehavior(base(), [-1,1,-1,1]);
const priorBehavior = calculateResult(consistent).behavior;
const priorScores = calculateResult(base()).scores;
equal(calculateResult(consistent).scores, priorScores, 'behavior selection cannot change the six value scores');
for (let w = 0; w < QUESTIONS.at(-1).options.length; w++) {
  const changed = [...consistent]; changed[changed.length - 1] = w;
  const result = calculateResult(changed);
  equal(result.behavior, priorBehavior, 'wealth/health/help wishes cannot determine behavioral preference');
  equal(result.wishReading.answerText, QUESTIONS.at(-1).options[w].text, 'each wish receives its exact original meaning');
}
const incompleteQuestions = QUESTIONS.filter(q => q.behaviorFacet === 'energy').slice(0,1);
equal(analyzeBehavior(incompleteQuestions,[0]).facets.find(f => f.id === 'energy').side, null, 'one observation cannot create a behavioral direction');
const irrelevant = [{id:'not-behavior',category:'personal',measures:[],weight:1,options:[{text:'a',scores:AXES.map(()=>0),behavior:{energy:1}},{text:'b',scores:AXES.map(()=>0),behavior:{energy:-1}}]}];
equal(analyzeBehavior([...irrelevant,{...irrelevant[0],id:'not-behavior-2'}],[0,0]).coverage,0, 'undeclared behavioral metadata cannot classify a value question');

section = 'explanation-gates';
const sampleQuestion = (id, measures, values, category='personal') => ({id,stage:0,weight:1,category,measures,options:values.map((v,i)=>({text:`${id} actual choice ${i}`,summary:`${id} observation ${i}`,scores:AXES.map((_,a)=>a===2?v:0)}))});
const synthetic = [sampleQuestion('one',['bond'],[-1,1]),sampleQuestion('two',['bond'],[-1,1])];
const same = buildValueObservations(synthetic,[0,0],AXES);
equal(same.length,1,'two same-axis explicit observations yield one claim');
equal(same[0]?.side,-1,'the claim follows the two actual choices');
equal(same[0]?.evidence.map(e=>e.questionId),['one','two'],'two genuinely different sources support the claim');
const mixed = buildValueObservations(synthetic,[0,1],AXES);
equal(mixed[0]?.state,'mixed','opposed choices remain mixed');
equal(mixed[0]?.side,null,'mixed evidence has no asserted personality side');
equal(buildValueObservations(synthetic.slice(0,1),[0],AXES),[],'one answer cannot be duplicated to support a claim');
equal(buildValueObservations(synthetic.map(q=>({...q,measures:[]})),[0,0],AXES),[],'nonzero numbers with no semantic declaration cannot become evidence');
equal(buildValueObservations(synthetic.map(q=>({...q,category:'culture'})),[0,0],AXES),[],'aesthetic metadata cannot become personality proof');
equal(buildValueObservations(synthetic.map(q=>({...q,category:'wish'})),[0,0],AXES),[],'wish metadata cannot become repeated personality proof');
const emptyExplanation = buildMatchExplanation(synthetic.map(q=>({...q,measures:[]})),[0,0],{best:SERVANTS[0],scores:AXES.map(()=>50),behavior:{facets:[]}},AXES);
equal(emptyExplanation.reasonGroups,[],'insufficient evidence produces no fabricated reasons');
equal(emptyExplanation.reasons,[],'insufficient evidence need not fill three lines');
const readOriginal = calculateResult(consistent);
equal(buildAnswerReading(consistent,readOriginal),buildAnswerReading(consistent,{...readOriginal,best:SERVANTS.find(s=>s.id!==readOriginal.best.id)}),'player readings do not come from the matched character');

section = 'wish-priority';
const priorityIds = ['wealth','health','mastery','recognition','close_person','public_good','keep_options'];
equal(Object.keys(WISH_PRIORITIES).sort(), [...priorityIds].sort(), 'seven explicit wish priorities have distinct meanings');
const wishIndex = QUESTIONS.findIndex(q => q.category === 'wish');
const wishQuestion = QUESTIONS[wishIndex];
equal(wishQuestion.options.map(o => o.wishPriority), priorityIds, 'each concrete wish maps to its explicit priority');
equal(wishQuestion.measures, [], 'a one-time wish declares no value/personality measure');
wishQuestion.options.forEach((o,i) => {
  equal(o.scores, AXES.map(() => 0), `wish ${i}: no six-axis or moral inference`);
  equal(o.measures, [], `wish ${i}: cannot become a second personality observation`);
});
check(QUESTIONS.filter(q => q.category !== 'wish').every(q => q.options.every(o => !o.wishPriority)), 'only the explicit Grail question supplies a wish priority');
for (const servant of SERVANTS) {
  const values = priorityIds.map(priority => wishAffinity(servant.id,priority));
  check(values.every(value => [0,.4,1].includes(value)), `${servant.id}: wish uses the same bounded affinity levels`);
  equal(values.filter(value => value === 1).length,1,`${servant.id}: exactly one primary priority`);
  equal(values.filter(value => value === .4).length,1,`${servant.id}: exactly one secondary priority`);
  equal(wishAffinity(servant.id,'unknown-priority'),0,`${servant.id}: unknown wish does not invent affinity`);
}
equal(priorityIds.map(priority => wishAffinity('unknown-servant',priority)),priorityIds.map(() => 0),'an unknown servant receives no invented wish profile');

// Reconstruct only the public mixing contract, independently of calculateResult.
// This does not generate semantic fixtures or choose answers from character scores.
const valueMatcher = createAffinityMatcher(QUESTIONS,SERVANTS);
let wishSeed = 0x5186be1d;
const wishRandom = () => ((wishSeed=(Math.imul(wishSeed,1664525)+1013904223)>>>0)/4294967296);
const wishContexts = Array.from({length:32},(_,i) => i < 16
  ? chooseAllBehavior(base(),BEHAVIOR_AXES.map((_,axis)=>i & (1<<axis) ? 1 : -1))
  : QUESTIONS.map(q=>Math.floor(wishRandom()*q.options.length)));
const wishAudit = {contexts:wishContexts.length,comparisons:0,rankChangedContexts:0,changeWitness:null};
for (const original of wishContexts) {
  const baseline = calculateResult(original);
  const observed = buildValueObservations(QUESTIONS,original,AXES);
  const reading = buildAnswerReading(original,baseline);
  const traitRank = valueMatcher(original).ranked;
  const behaviorRank = rankBehavior(baseline.behavior,SERVANTS);
  const traitById = Object.fromEntries(traitRank.map(row => [row.servant.id,1-2*row.distance**2]));
  const directionsById = Object.fromEntries(behaviorRank.ranked.map(row => [row.id,row.similarity]));
  const priorWeight = .25 * baseline.behavior.coverage;
  const results = wishQuestion.options.map((option,index) => {
    const answers = [...original]; answers[wishIndex] = index;
    const result = calculateResult(answers);
    wishAudit.comparisons++;
    equal(result.wishWeight,.10,'each wish uses the same global ten-percent contribution');
    equal(result.wishPriority,option.wishPriority,'the result retains the exact selected wish priority');
    equal(result.scores,baseline.scores,'changing only a wish leaves all six value scores unchanged');
    equal(result.behavior,baseline.behavior,'changing only a wish leaves all four behavioral observations unchanged');
    equal(buildValueObservations(QUESTIONS,answers,AXES),observed,'wealth or public help cannot rewrite value observations');
    equal(buildAnswerReading(answers,result),reading,'changed character affinity cannot rewrite the player reading');
    equal(result.wishReading.text,option.inference || option.summary || option.text,'wish observation preserves the selected meaning without a personality embellishment');
    equal(result.wishReading.limitation,baseline.wishReading.limitation,'wealth and public help receive the same single-choice limitation');
    check(typeof result.wishAffinityNote === 'string' && result.wishAffinityNote.includes(WISH_PRIORITIES[option.wishPriority]) && result.wishAffinityNote.includes(result.best.name),'wish note names the actual selected priority and current best character');
    check(!/undefined|null|NaN/.test(result.wishAffinityNote),'wish note has no unresolved template values');
    equal(result.wishAffinityNote.includes('有呼应'),wishAffinity(result.best.id,option.wishPriority)>0,'wish note only claims agreement when that exact priority matches the character');
    equal(result.wishAffinityNote.includes('不完全相同'),wishAffinity(result.best.id,option.wishPriority)===0,'wish difference remains a distinct priority observation');
    const expected = SERVANTS.map(servant => {
      const traits = (1-priorWeight)*traitById[servant.id] + priorWeight*directionsById[servant.id];
      const similarity = .9*traits + .1*wishAffinity(servant.id,option.wishPriority);
      const bonus=servant.game.rarity===5?.03:0;
      return {id:servant.id,similarity,bonus,distance:Math.sqrt(Math.max(0,2-2*(similarity+bonus)/1.03))/2};
    }).sort((a,b)=>a.distance-b.distance || a.id.localeCompare(b.id,'en'));
    equal([result.best.id,...result.runnersUp.map(s=>s.id)],expected.slice(0,3).map(s=>s.id),'every character uses the same wish blend and uniform five-star summon preference');
    equal(result.resonance,Math.max(0,Math.min(100,Math.round(100*(1-Math.sqrt(Math.max(0,2-2*expected[0].similarity))/2)))),'displayed index uses answer affinity before the separate star preference');
    equal(result.nearTie,expected[1].distance-expected[0].distance<.01,'wish blend preserves the common near-tie rule');
    equal(result.matchGap,Math.round((expected[1].distance-expected[0].distance)*1000)/10,'wish blend preserves the common match-gap rule');
    return {priority:option.wishPriority,best:result.best.id,runners:result.runnersUp.map(s=>s.id)};
  });
  if (new Set(results.map(r=>[r.best,...r.runners].join('|'))).size>1) {
    wishAudit.rankChangedContexts++;
    wishAudit.changeWitness ??= {answers:original,results};
  }
}
check(wishAudit.rankChangedContexts>0,'the concrete wish can actually affect affinity without classifying personality');

section = 'aesthetic-invariance';
const aestheticIndexes = QUESTIONS.flatMap((q,i)=>q.category==='culture'?[i]:[]);
const signature = r => ({best:r.best.id,runners:r.runnersUp.map(s=>s.id),scores:r.scores,resonance:r.resonance,nearTie:r.nearTie,matchGap:r.matchGap,weakSignal:r.weakSignal,behavior:r.behavior,reasonGroups:r.reasonGroups,differences:r.differences,summary:r.summary,wishPriority:r.wishPriority,wishWeight:r.wishWeight,wishReading:r.wishReading,wishAffinityNote:r.wishAffinityNote,rawSimilarity:r.rawSimilarity,summonSimilarity:r.summonSimilarity,summonBonusApplied:r.summonBonusApplied});
const reference = signature(calculateResult(consistent));
let aestheticCombinations = 0;
function varyAesthetic(position,answers) {
  if (position === aestheticIndexes.length) {
    aestheticCombinations++;
    equal(signature(calculateResult(answers)),reference,'every aesthetic choice/skip leaves matching and personality interpretation unchanged');
    return;
  }
  const index = aestheticIndexes[position];
  QUESTIONS[index].options.forEach((_,i)=>{const next=[...answers];next[index]=i;varyAesthetic(position+1,next);});
}
varyAesthetic(0,consistent);

section = 'semantic-cases';
const makeSemantic = (id,description,choices,behavior,expectedFamily) => {
  const answers = base();
  Object.entries(choices).forEach(([qid,index])=>setChoice(answers,qid,index));
  chooseAllBehavior(answers,behavior);
  const result = calculateResult(answers);
  auditResult(answers,result);
  if (expectedFamily) check(expectedFamily.includes(result.best.id),`${id}: intended semantic family`,{best:result.best.id,expectedFamily});
  return {id,description,answers,best:result.best.id,runnersUp:result.runnersUp.map(s=>s.id),scores:result.scores,expectedFamily};
};
const semanticCases = [
  makeSemantic('shared-oath','Keeps commitments and prioritizes shared protection; private social recovery is independent of caring for others. This case tests the expressed values, not a uniquely determined character.',{q01:0,q02:0,q03:1,q05:1,q06:1,q07:0,q08:0,q09:0,q10:0,q11:0,q12:0,q13:1,q14:0,q17:0,q18:0,q19:1,q20:0,q21:0,q22:6,q23:1,q24:4},[-1,-1,1,-1],null),
  makeSemantic('own-path','Prioritizes private space and a personal project; little public expression; personal money is a concrete wish.',{q01:2,q02:2,q03:0,q05:0,q06:2,q07:0,q08:2,q09:2,q10:2,q11:2,q12:0,q13:3,q14:1,q17:1,q18:1,q19:2,q20:1,q21:2,q22:0,q23:3,q24:0},[-1,-1,-1,1],['kojiro','scathach','emiya','musashi','hassan']),
];
const sharedCase = semanticCases.find(item=>item.id==='shared-oath');
const sharedObservations = buildValueObservations(QUESTIONS,sharedCase.answers,AXES);
check(sharedObservations.some(o=>o.axisId==='bond'&&o.side===1),'private recovery can coexist with a shared-protection value reading');
check(sharedObservations.some(o=>o.axisId==='order'&&o.side===1),'the shared-protection case keeps explicitly chosen commitments');
equal(calculateResult(sharedCase.answers).behavior.facets.find(f=>f.id==='energy').side,-1,'caring for others does not become extraverted recovery');
const wealthAndOath = chooseAllBehavior(base(),[1,-1,-1,-1]);
setChoice(wealthAndOath,'q24',0);setChoice(wealthAndOath,'q22',6);setChoice(wealthAndOath,'q07',0);setChoice(wealthAndOath,'q11',0);
const wealthResult=calculateResult(wealthAndOath);
const orderObservation=buildValueObservations(QUESTIONS,wealthAndOath,AXES).find(o=>o.axisId==='order');
check(orderObservation?.side===1,'a personal wealth wish can coexist with keeping commitments');
equal(wealthResult.behavior.facets.find(f=>f.id==='energy').side,1,'personal resources do not imply introverted recovery');
auditResult(wealthAndOath,wealthResult);

section = 'stress';
let seed=0x7a138b4f;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const counts=Object.fromEntries(SERVANTS.map(s=>[s.id,0])),witnesses={};
const baselineCounts=Object.fromEntries(SERVANTS.map(s=>[s.id,0]));
const rarityAudit={changed:0,maxOverturnedSimilarityGap:0,strongLeadsPreserved:0,baselineFiveStar:0,currentFiveStar:0};
const rebuildUnbonused=answers=>{
  const b=analyzeBehavior(QUESTIONS,answers),behavioral=rankBehavior(b,SERVANTS),weight=.25*b.coverage;
  const priority=QUESTIONS[wishIndex].options[answers[wishIndex]].wishPriority;
  return valueMatcher(answers).ranked.map(row=>({servant:row.servant,
    similarity:.9*((1-weight)*(1-2*row.distance**2)+weight*behavioral.similarities[row.servant.id])+.1*wishAffinity(row.servant.id,priority)
  })).sort((a,b)=>b.similarity-a.similarity||a.servant.id.localeCompare(b.servant.id,'en'));
};
for (let i=0;i<sampleCount;i++) {
  const answers=QUESTIONS.map(q=>Math.floor(random()*q.options.length)),result=calculateResult(answers);
  counts[result.best.id]++;witnesses[result.best.id]??=answers;
  const unbonused=rebuildUnbonused(answers),before=unbonused[0];
  const after=unbonused.find(row=>row.servant.id===result.best.id);
  baselineCounts[before.servant.id]++;
  if(before.servant.game.rarity===5)rarityAudit.baselineFiveStar++;
  if(result.best.game.rarity===5)rarityAudit.currentFiveStar++;
  if(result.best.id!==before.servant.id){
    rarityAudit.changed++;
    const gap=before.similarity-after.similarity;
    rarityAudit.maxOverturnedSimilarityGap=Math.max(rarityAudit.maxOverturnedSimilarityGap,gap);
    check(before.servant.game.rarity!==5&&result.best.game.rarity===5,'the requested preference only promotes a five-star over a close lower-star candidate');
    check(gap<=.03+1e-12,'a five-star cannot overtake a raw answer affinity lead above the stated preference');
  }
  if(before.similarity-unbonused[1].similarity>.03){
    rarityAudit.strongLeadsPreserved++;
    equal(result.best.id,before.servant.id,'a clear affinity lead is always preserved');
  }
  if(i<100||i%1000===0){
    equal(result.rawSimilarity,after.similarity,'reported raw affinity reconstructs without the star preference');
    const ordered=unbonused.map(row=>({...row,score:row.similarity+(row.servant.game.rarity===5?.03:0)})).sort((a,b)=>b.score-a.score||a.servant.id.localeCompare(b.servant.id,'en'));
    equal([result.best.id,...result.runnersUp.map(row=>row.id)],ordered.slice(0,3).map(row=>row.servant.id),'best and runners follow the same global preference');
    equal(buildAnswerReading(answers,result),buildAnswerReading(answers,{...result,best:before.servant}),'star promotion cannot rewrite the player reading');
  }
  if(i<100||i%1000===0) {
    auditResult(answers,result);
    equal(calculateResult([...answers]),result,'same answers replay exactly');
    equal(calculateResult(answers,'renamed'),result,'name cannot alter matching or explanation');
    const snapshot=clone(answers);buildAnswerReading(answers,result);equal(answers,snapshot,'reading is pure');
  }
}
const distribution=SERVANTS.map(s=>({id:s.id,count:counts[s.id],percent:+(100*counts[s.id]/sampleCount).toFixed(3)})).sort((a,b)=>b.count-a.count);
const covered=distribution.filter(row=>row.count>0).length;
equal(covered,24,'all 24 roles have actual reproducible answer witnesses');
check(distribution[0].percent<20,'a single role does not dominate uniform random stress test',distribution[0]);
for(const [id,answers] of Object.entries(witnesses)) equal(calculateResult(answers).best.id,id,`${id}: reachability witness replays`);
section = 'rarity-preference';
rarityAudit.baselinePercent=100*rarityAudit.baselineFiveStar/sampleCount;
rarityAudit.currentPercent=100*rarityAudit.currentFiveStar/sampleCount;
rarityAudit.upliftPoints=rarityAudit.currentPercent-rarityAudit.baselinePercent;
rarityAudit.changedPercent=100*rarityAudit.changed/sampleCount;
check(rarityAudit.upliftPoints>5&&rarityAudit.upliftPoints<15,'the preference raises five-star presence modestly in the fixed stress test',rarityAudit);
check(rarityAudit.currentPercent<75,'five-stars do not crowd out all lower-star results',rarityAudit);
check(rarityAudit.changed>0&&rarityAudit.strongLeadsPreserved>0,'audit observes both close promotions and preserved clear matches');
equal(Object.values(baselineCounts).filter(Boolean).length,24,'the unbonused comparison reaches all 24 roles too');
section = 'source-integrity';
const finalDigests = sourceDigests();
equal(finalDigests,sourcesAtStart,'the report corresponds to one unchanged source snapshot');
const report={passed:failures.length===0,checks,sections,failures,sampleCount,seed:'0x7a138b4f',coverage:`${covered}/24`,distribution,witnesses,semanticCases,aestheticCombinations,wishAudit,rarityAudit,baselineCounts,
  note:'Synthetic answer tests do not establish psychological validity, real-player frequencies, or equally sized result quotas.',
  sourceDigests:finalDigests};
const reportPath=new URL(argument('--report','./qa/report-logic-v12.json'),import.meta.url);
fs.mkdirSync(new URL('./',reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks,sections,failures,sampleCount,coverage:report.coverage,distribution,semanticCases:semanticCases.map(({answers,...rest})=>rest),wishAudit:{...wishAudit,changeWitness:!!wishAudit.changeWitness},rarityAudit,report:reportPath.pathname},null,2));
if(failures.length)process.exitCode=1;
