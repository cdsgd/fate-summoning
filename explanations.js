import { BEHAVIOR_AXES, SERVANT_BEHAVIOR } from './behavior.js';

// Limited descriptions of questionnaire choices: no ability, moral worth,
// official character parameter or psychological diagnosis is inferred here.
const VALUE_LANGUAGE = {
  vision: {
    low: '眼前可实现的生活与结果', high: '即使代价较高也想保留的目标或信念',
    titles: ['这几次先选择了可实现的结果', '这几次愿意为认定的目标付出代价'],
  },
  strategy: {
    low: '现场感受或直接尝试', high: '核实条件、准备和推演',
    titles: ['这几次先凭现场判断或尝试', '这几次先弄清条件再作判断'],
  },
  bond: {
    low: '个人生活和自主选择的空间', high: '共同生活、共同承担或同行者的需要',
    titles: ['这几次给个人道路留了位置', '这几次把共同承担放在前面'],
  },
  presence: {
    low: '私下回应、少作展示或不在当下说出', high: '直接表达或让自己的想法、成果被人看见',
    titles: ['这几次没有把表达放到台前', '这几次愿意让自己的表达被看见'],
  },
  order: {
    low: '调整、退出或重订已有安排', high: '守住已作出的约定与责任边界',
    titles: ['这几次愿意重订已有安排', '这几次先维护已有的约定'],
  },
  resolve: {
    low: '等待、保留余地后再决定', high: '先作出决定并开始行动',
    titles: ['这几次愿意付出等待的代价', '这几次愿意先作决定再行动'],
  },
};

const publicEvidence = signal => ({
  questionId: signal.questionId, questionIndex: signal.questionIndex,
  answerIndex: signal.answerIndex, answerText: signal.answerText,
  observation: signal.observation, value: signal.value,
});

function validAnswers(questions, answers) {
  return Array.isArray(questions) && Array.isArray(answers) &&
    answers.length === questions.length && questions.every((q, i) =>
      Array.isArray(q.options) && Number.isInteger(answers[i]) && !!q.options[answers[i]]);
}

function strongest(signals, count = 2) {
  const ordered = [...signals].sort((a, b) => b.strength - a.strength || a.questionIndex - b.questionIndex);
  const picked = [];
  for (const requireDifferentStage of [true, false]) {
    for (const signal of ordered) {
      if (picked.length >= count) break;
      if (picked.some(item => item.questionId === signal.questionId)) continue;
      if (requireDifferentStage && picked.some(item => item.stage === signal.stage)) continue;
      picked.push(signal);
    }
  }
  return picked;
}

function sceneNames(evidence) {
  return evidence.map(item => `第${item.questionIndex + 1}题`).join('、');
}

/**
 * Shared, pure value aggregation. Only deliberately measured dimensions count.
 * A wish is a single priority observation, never repeated trait evidence.
 */
export function buildValueObservations(questions, answers, axes) {
  if (!validAnswers(questions, answers) || !Array.isArray(axes)) return [];
  return axes.flatMap((axis, axisIndex) => {
    const language = VALUE_LANGUAGE[axis.id];
    if (!language) return [];
    const signals = questions.flatMap((q, questionIndex) => {
      if (q.category === 'culture' || q.category === 'wish' || q.behaviorFacet ||
          !Array.isArray(q.measures) || !q.measures.includes(axis.id)) return [];
      const answerIndex = answers[questionIndex], answer = q.options[answerIndex];
      const value = answer.scores?.[axisIndex];
      if (Array.isArray(answer.measures) && !answer.measures.includes(axis.id)) return [];
      if (answer.neutral || !Number.isFinite(value) || Math.abs(value) < 0.6 ||
          !q.options.some(option => !option.neutral && option.scores?.[axisIndex] !== value)) return [];
      return [{ questionId: q.id || `index-${questionIndex}`, questionIndex, answerIndex,
        answerText: answer.text, observation: answer.inference || answer.summary || answer.text,
        value, stage: q.stage, strength: Math.abs(value) * Math.max(0, q.weight || 0) }];
    });
    const negative = signals.filter(item => item.value < 0), positive = signals.filter(item => item.value > 0);
    const totalWeight = signals.reduce((sum, item) => sum + item.strength, 0);
    if (signals.length < 2 || totalWeight <= 0) return [];
    const positiveShare = positive.reduce((sum, item) => sum + item.strength, 0) / totalWeight;
    const side = positiveShare >= 0.5 ? 1 : -1;
    const same = side > 0 ? positive : negative, opposite = side > 0 ? negative : positive;
    const share = side > 0 ? positiveShare : 1 - positiveShare;
    if (same.length >= 2 && share >= 2 / 3) {
      const support = strongest(same).map(publicEvidence);
      const counterEvidence = strongest(opposite, 1).map(publicEvidence);
      if (support.length < 2) return [];
      const direction = side > 0 ? language.high : language.low;
      const caveat = counterEvidence.length ? `不过，${sceneNames(counterEvidence)}作了相反取舍；这只是本次较多出现的选择，不是每种处境都如此。` : '这个概括只适用于这些选择，不代表你在所有处境中都会这样做。';
      return [{ axisId: axis.id, axisIndex, axisName: axis.name, state: 'preference', side,
        title: language.titles[side > 0 ? 1 : 0],
        text: `在${sceneNames(support)}里，你都先为${direction}留了位置。${caveat}`,
        traitLabel: side > 0 ? axis.high : axis.low,
        evidence: [...support, ...counterEvidence], supportEvidence: support, counterEvidence,
        strength: share * 10 + Math.min(same.length, 4), share }];
    }
    if (negative.length && positive.length) {
      const support = [...strongest(negative, 1), ...strongest(positive, 1)].map(publicEvidence);
      return [{ axisId: axis.id, axisIndex, axisName: axis.name, state: 'mixed', side: null,
        title: `${axis.name}：两种取舍都出现在你的回答里`,
        text: `在${sceneNames([support[0]])}里，你先考虑${language.low}；在${sceneNames([support[1]])}里，则先考虑${language.high}。两处选择不同，本次不把你固定在这一维度的某一端。`,
        traitLabel: '随处境不同', evidence: support, supportEvidence: [], counterEvidence: [],
        strength: 5 + 10 * Math.min(positiveShare, 1 - positiveShare), share: null }];
    }
    return [];
  });
}

function validateBehaviorEvidence(questions, answers, facet, side) {
  if (!Array.isArray(facet.evidence)) return [];
  const seen = new Set();
  return facet.evidence.flatMap(item => {
    const index = item.questionIndex, q = questions[index];
    const answerIndex = answers[index], answer = q?.options[answerIndex];
    const value = answer?.behavior?.[facet.id];
    if (!q || q.behaviorFacet !== facet.id || !answer || answer.neutral ||
        !Number.isFinite(value) || Math.sign(value) !== side || seen.has(q.id)) return [];
    seen.add(q.id);
    return [{ questionId: q.id, questionIndex: index, answerIndex,
      answerText: answer.text, observation: answer.inference || answer.summary || answer.text, value }];
  });
}

/** Evidence -> limited observation -> same dimension in this work's profile. */
export function buildMatchExplanation(questions, answers, result, axes) {
  const fallback = { summary: '这些回答尚未提供足够重复的共同线索，这次结果可以作为一种可能的回应。',
    reasons: [], evidence: [], reasonGroups: [], differences: [], wishReading: null,
    shareReason: '尚未形成两题以上共同支持的具体共鸣，详细选择回顾见网页。' };
  if (!validAnswers(questions, answers) || !result?.best || !Array.isArray(axes)) return fallback;
  const best = result.best;
  const observations = buildValueObservations(questions, answers, axes);
  const reasonGroups = [], differences = [];
  for (const item of observations.filter(item => item.state === 'preference')) {
    const profile = best.profile?.[item.axisIndex];
    if (!Number.isFinite(profile) || profile === 50) continue;
    const sameDirection = Math.sign(profile - 50) === item.side;
    const trait = item.side > 0 ? VALUE_LANGUAGE[item.axisId].high : VALUE_LANGUAGE[item.axisId].low;
    const evidence = item.supportEvidence;
    const text = `${sceneNames(evidence)}里，你都优先考虑${trait}。${sameDirection ? `在本作对${best.name}的解读中，${item.traitLabel}也是一个侧面，因此这两处取舍与你们的共同点有关。` : `本作对${best.name}的解读在“${item.axisName}”上更偏向另一侧，这里保留你们的差异。`}${item.counterEvidence.length ? `你在${sceneNames(item.counterEvidence)}也有另一种选择，因此这里只概括本次较多出现的取舍。` : ''}`;
    const group = { id: `value-${item.axisId}`, kind: sameDirection ? 'support' : 'difference',
      title: sameDirection ? item.title : `${item.axisName}上的不同`, text,
      axisId: item.axisId, side: item.side, source: 'value', evidence,
      counterEvidence: item.counterEvidence, strength: item.strength };
    (sameDirection ? reasonGroups : differences).push(group);
  }
  const characterBehavior = SERVANT_BEHAVIOR[best.id];
  for (const facet of result.behavior?.facets || []) {
    if (facet.side !== 1 && facet.side !== -1) continue;
    const axisIndex = BEHAVIOR_AXES.findIndex(axis => axis.id === facet.id), axis = BEHAVIOR_AXES[axisIndex];
    const profile = Array.isArray(characterBehavior) ? characterBehavior[axisIndex] : characterBehavior?.profile?.[axisIndex];
    if (!axis || !Number.isFinite(profile) || profile === 50) continue;
    const evidence = validateBehaviorEvidence(questions, answers, facet, facet.side);
    if (evidence.length < 2) continue;
    const trait = facet.side > 0 ? axis.high : axis.low;
    const sameDirection = Math.sign(profile - 50) === facet.side;
    const text = `${sceneNames(evidence)}里，你都选择了${trait}。${sameDirection ? `本作对${best.name}的解读在“${axis.label || axis.name}”上也偏向这一侧，这是这两处选择支持的一个共同点。` : `本作对${best.name}的解读在“${axis.label || axis.name}”上偏向另一侧，这里与你的选择有区别。`}这只描述这两种情境中的取舍。`;
    const group = { id: `behavior-${facet.id}`, kind: sameDirection ? 'support' : 'difference',
      title: `${axis.label || axis.name}上的${sameDirection ? '呼应' : '不同'}`, text,
      axisId: facet.id, side: facet.side, source: 'behavior', evidence, counterEvidence: [], strength: 12 };
    (sameDirection ? reasonGroups : differences).push(group);
  }
  reasonGroups.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  differences.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  const selected = reasonGroups.slice(0, 3);
  const wishIndex = questions.findIndex(q => q.category === 'wish');
  const wish = wishIndex >= 0 ? questions[wishIndex].options[answers[wishIndex]] : null;
  const wishReading = wish ? { questionId: questions[wishIndex].id, questionIndex: wishIndex,
    answerIndex: answers[wishIndex], answerText: wish.text,
    text: wish.inference || wish.summary || wish.text,
    limitation: '这只是这次愿望的优先项，不能单凭它推断品格、能力或整个人格。' } : null;
  const summary = selected.length
    ? `${selected[0].title}，这是你与${best.name}这次相遇的一处呼应。具体依据见下方的两道回答。`
    : fallback.summary;
  return { summary, reasons: selected.map(item => item.text),
    evidence: selected.map(item => ({ ...item.evidence[0], axisId: item.axisId,
      shared: true, coherent: true, supportive: true, source: item.source })),
    reasonGroups: selected, differences: differences.slice(0, 1), wishReading,
    shareReason: selected.length ? `${sceneNames(selected[0].evidence)}：${selected[0].title}。与${best.name}的本作画像在这一方向呼应；完整回答依据见网页。` : fallback.shareReason };
}
