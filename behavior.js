/**
 * Original short behavioral preference exercise, inspired by four familiar
 * preference domains. This is neither the MBTI instrument nor a type diagnosis.
 * It intentionally has no access to the six value axes or servant summaries.
 */
export const BEHAVIOR_AXES = [
  { id: 'energy', name: '恢复精力', low: '独处整理', high: '与人交流' },
  { id: 'information', name: '接收信息', low: '具体细节', high: '关联可能' },
  { id: 'decision', name: '决定依据', low: '统一标准', high: '个别处境' },
  { id: 'structure', name: '安排节奏', low: '先行确定', high: '保留选择' },
];

/**
 * OPTIONAL original fan interpretations for affinity matching. The four values
 * are explicit authored hypotheses, not official MBTI types. Never infer these
 * from the existing value profile, voice, kindness, intelligence or class.
 * Order: energy, information, decision, structure; each uses [0, 100], neutral at 50.
 */
export const SERVANT_BEHAVIOR = {
  artoria: [20, 30, 25, 5],
  emiya: [10, 35, 10, 20],
  cu: [85, 25, 35, 90],
  medusa: [5, 25, 90, 60],
  medea: [15, 80, 20, 40],
  kojiro: [15, 10, 40, 85],
  heracles: [10, 5, 75, 40],
  gilgamesh: [90, 75, 15, 40],
  iskandar: [100, 85, 70, 90],
  hassan: [5, 10, 25, 10],
  lancelot: [15, 20, 70, 25],
  mash: [20, 25, 95, 15],
  jeanne: [35, 75, 80, 10],
  merlin: [70, 100, 60, 95],
  scathach: [10, 25, 10, 40],
  arash: [75, 20, 80, 65],
  nero: [100, 70, 85, 90],
  waver: [15, 75, 10, 5],
  enkidu: [20, 80, 90, 95],
  dantes: [25, 90, 25, 30],
  oberon: [65, 95, 30, 100],
  tamamo: [90, 30, 95, 65],
  musashi: [80, 15, 45, 100],
  holmes: [25, 90, 0, 70],
};

const validAnswers = (questions, answers) => Array.isArray(questions) &&
  Array.isArray(answers) && questions.length === answers.length &&
  questions.every((q, i) => Number.isInteger(answers[i]) && !!q.options?.[answers[i]]);

const behaviorValue = (q, option, id) => {
  if (option.neutral || q.category === 'culture') return null;
  const declaredFacet = q.behaviorFacet ?? q.facet;
  if (declaredFacet !== id) return null;
  const raw = typeof option.behavior === 'object' && option.behavior !== null
    ? option.behavior[id]
    : declaredFacet === id ? option.behavior : undefined;
  return Number.isFinite(raw) && raw >= -1 && raw <= 1 ? raw : null;
};

/**
 * A directional claim requires two different questions on the same side.
 * Opposite answers remain mixed even if one is numerically more intense.
 * Zero/neutral does not supply a second directional observation.
 */
export function analyzeBehavior(questions, answers) {
  const valid = validAnswers(questions, answers);
  const facets = BEHAVIOR_AXES.map(facet => {
    const evidence = valid ? questions.flatMap((q, questionIndex) => {
      const answerIndex = answers[questionIndex], selected = q.options[answerIndex];
      const value = behaviorValue(q, selected, facet.id);
      if (value === null) return [];
      // A value identical across all options describes the setting, not a choice.
      const otherValues = q.options.map(option => behaviorValue(q, option, facet.id));
      if (!otherValues.some(other => other !== null && other !== value)) return [];
      return [{ questionId: q.id, questionIndex, answerIndex,
        answerText: selected.text, value }];
    }) : [];
    const directional = evidence.filter(item => item.value !== 0);
    const positive = directional.filter(item => item.value > 0);
    const negative = directional.filter(item => item.value < 0);
    const distinct = new Set(directional.map(item => item.questionId ?? item.questionIndex));
    const mixed = positive.length > 0 && negative.length > 0;
    const side = !mixed && distinct.size >= 2 ? (positive.length ? 1 : -1) : null;
    const total = evidence.reduce((sum, item) => sum + item.value, 0);
    const strength = evidence.reduce((sum, item) => sum + Math.abs(item.value), 0);
    const mean = evidence.length ? total / evidence.length : 0;
    const text = side === null ? (mixed ? `这两道题里，你分别选择了「${facet.low}」和「${facet.high}」，本次没有一致偏向。` : '这次没有两条同向的有效线索，暂不概括。') : `在这两道题中，你都先选择了${side > 0 ? facet.high : facet.low}。这只描述本次情境下的偏好。`;
    return { ...facet, label: facet.name, text, traitLabel: side === null ? null : side > 0 ? facet.high : facet.low, answered: evidence.length, score: Math.round(50 + 50 * mean),
      side, value: mean, coherence: strength ? Math.abs(total) / strength : 0,
      status: mixed ? 'mixed' : side === null ? 'insufficient' : 'consistent', evidence };
  });
  const active = facets.filter(facet => facet.side !== null);
  return { facets, coverage: active.length / BEHAVIOR_AXES.length };
}

/**
 * Cosine in the evidenced facet subspace. A single reliable facet can only
 * distinguish its two directions; it cannot invent ordering within one side.
 * Missing profiles contribute no invented directional agreement.
 */
export function rankBehavior(analysis, servants, profiles = SERVANT_BEHAVIOR) {
  const active = analysis.facets.flatMap(facet => {
    const index = BEHAVIOR_AXES.findIndex(axis => axis.id === facet.id);
    return facet.side === null || index < 0 ? [] : [{ facet, index }];
  });
  const user = active.map(({ facet }) => facet.value);
  const length = Math.hypot(...user);
  const ranked = servants.map(servant => {
    const profile = servant.behaviorProfile ?? profiles[servant.id];
    const values = active.map(({ index }) => Number.isFinite(profile?.[index]) ? (profile[index] - 50) / 50 : 0);
    const characterLength = Math.hypot(...values);
    const similarity = length && characterLength
      ? Math.max(-1, Math.min(1, values.reduce((sum, value, index) => sum + value * user[index], 0) / (length * characterLength)))
      : 0;
    return { id: servant.id, similarity };
  }).sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id, 'en'));
  return { ...analysis, similarities: Object.fromEntries(ranked.map(item => [item.id, item.similarity])), ranked };
}
