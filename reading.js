import { AXES, QUESTIONS } from './data.js';

// These are descriptions of repeated choices, not claims about ability or a
// psychological diagnosis. Character profiles never supply the user's reading.
const DIRECTIONS = {
  vision: [
    ['先保全能够延续的现实', '你不止一次先权衡还能保住什么、接下来怎样继续。比起让一个原则自动决定全部代价，你更愿意照顾眼前仍有可能延续的人与局面。'],
    ['有些界限，你不愿只按得失交换', '在不止一次需要付出代价的取舍里，你仍为自己认定的界限留了位置。结果是否有利，并没有成为你唯一采用的尺度。'],
  ],
  strategy: [
    ['你会认真对待身处其中的判断', '有几次需要决定的时刻，你都更信任亲身感受与当场形成的判断。相比把每一处条件补齐，你愿意让眼前真实遇到的人与事参与决定。'],
    ['先把关键条件弄清，再作判断', '你在不止一个问题里选择先核实依据、推演后果或整理安排。即使准备会付出时间，你仍希望知道自己究竟在承担什么。'],
  ],
  bond: [
    ['为个人的决定保留边界', '你多次保留独立判断或各自去留的余地。共同的身份与期待没有自动代替个人作出决定，自己承担的部分也需要自己认领。'],
    ['把同行者也放进决定里', '你多次让共同承担、彼此的处境或一起继续的可能进入选择。决定不只关乎自己能走到哪里，也关乎身边的人如何面对后果。'],
  ],
  presence: [
    ['重要的立场，也可以留在私下', '你在几次需要回应的场合选择了私下交代、幕后支持或安静保留。比起让所有人立刻看见，你更在意这份表达实际交到谁手里。'],
    ['愿意让别人知道你站在哪里', '你不止一次选择公开说明、具名承担或直接表达。需要回应分歧时，你愿意让自己的名字与判断一起出现在众人面前。'],
  ],
  order: [
    ['旧安排失效时，愿意重新选择', '当既有命令或先前安排与你的判断冲突，你多次选择重订、退出或另找途径。保留重新决定去向的权利，对你有实际分量。'],
    ['看重能够让人互相依赖的约定', '即使局面发生变化，你多次先维护已作出的约定、程序或责任边界。改变之前，你更愿意找到能够向自己与别人交代的依据。'],
  ],
  resolve: [
    ['给决定留一点时间', '你多次接受等待本身的代价，来补足判断或厘清自己的回应。保留重新判断的余地，对你来说值得暂时让出一些先机。'],
    ['愿意先作决定，再承担后果', '面对需要回应的局面，你多次选择立即作出取舍。即使条件仍不完备，你也愿意让行动开始，并认领随之而来的后果。'],
  ],
};

const MIXED = {
  vision: '你在一些问题里先守认定的界限，也在另一些问题里先保全现实中的存续。两边都不止出现一次；面对不同代价，你会换一种选择。',
  strategy: '有的抉择里你先核实依据，有的时刻你更信任当场判断。两种做法都不止出现一次，这些回答不足以把你固定在直觉或筹划的任何一端。',
  bond: '你有几次把共同承担放在前面，也有几次为个人决定保留边界。你并没有把所有关系都处理成同一种距离。',
  presence: '你会公开具名表达，也会把一些重要回应留在私下。两种做法都在不同回答里出现，外显与内敛并不总由同一边占上风。',
  order: '你愿意维护一些约定，也会在别的处境下重订旧安排。守住承诺与保留改道的权利，在这次回答里都占有位置。',
  resolve: '你有立刻作出决定的回答，也有接受等待、暂缓表态的回答。面对不同处境，你会换一种选择，不能只用决断或审慎概括。',
};

function selectEvidence(signals, count, used = new Set()) {
  const ordered = [...signals].sort((a, b) => b.strength - a.strength || a.questionIndex - b.questionIndex);
  const picked = [];
  const take = (preferUnused, preferDifferentStage) => {
    for (const signal of ordered) {
      if (picked.length >= count) return;
      if (picked.some(e => e.questionIndex === signal.questionIndex)) continue;
      if (preferUnused && used.has(signal.questionIndex)) continue;
      if (preferDifferentStage && picked.some(e => e.stage === signal.stage)) continue;
      picked.push(signal);
    }
  };
  take(true, true);
  take(true, false);
  take(false, true);
  take(false, false);
  return picked;
}

function publicEvidence(signals) {
  return signals.map(({ questionIndex, answerText }) => ({ questionIndex, answerText }));
}

/**
 * Return up to three readings supported by at least two actual core answers.
 * Opposite readings need two answers on each side. Aesthetic choices and zero
 * signals cannot become proof. Inputs and imported data remain untouched.
 */
export function buildAnswerReading(answers, result) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length ||
      !Array.isArray(result?.scores) || result.scores.length !== AXES.length ||
      !result.scores.every(Number.isFinite) ||
      !QUESTIONS.every((q, i) => Number.isInteger(answers[i]) && !!q.options[answers[i]])) return [];

  const responses = QUESTIONS.map((q, questionIndex) => ({ q, questionIndex, answer: q.options[answers[questionIndex]] }))
    .filter(({ q, answer }) => !answer.neutral && q.category !== 'culture' && q.weight >= 0.65);
  const dominant = [];
  const mixed = [];

  AXES.forEach((axis, axisIndex) => {
    const signals = responses.map(({ q, questionIndex, answer }) => {
      const value = answer.scores[axisIndex];
      if (!q.options.some(option => !option.neutral && option.scores[axisIndex] !== value)) return null;
      return { questionIndex, answerText: answer.text, stage: q.stage, value, strength: Math.abs(value) * q.weight };
    }).filter(signal => signal && Number.isFinite(signal.value) && Math.abs(signal.value) >= 0.6);
    const negative = signals.filter(signal => signal.value < 0);
    const positive = signals.filter(signal => signal.value > 0);
    const sum = group => group.reduce((total, signal) => total + signal.strength, 0);
    const negativeWeight = sum(negative), positiveWeight = sum(positive);
    const totalWeight = negativeWeight + positiveWeight;
    if (!totalWeight) return;
    const positiveShare = positiveWeight / totalWeight;
    const side = positiveShare >= 0.5 ? 1 : 0;
    const chosen = side ? positive : negative;
    const share = side ? positiveShare : 1 - positiveShare;
    const score = result.scores[axisIndex];
    const agreesWithScore = side ? score >= 58 : score <= 42;
    if (chosen.length >= 2 && share >= 0.66 && agreesWithScore) {
      dominant.push({ axisIndex, axis: axis.id, side, signals: chosen,
        strength: Math.abs(score - 50) + 8 * Math.min(chosen.length, 4) });
    }
    if (negative.length >= 2 && positive.length >= 2 &&
        Math.min(positiveShare, 1 - positiveShare) >= 0.28 && Math.abs(score - 50) <= 22) {
      mixed.push({ axisIndex, axis: axis.id, negative, positive,
        strength: Math.min(negativeWeight, positiveWeight) / totalWeight * 10 + Math.min(negative.length, positive.length) });
    }
  });

  dominant.sort((a, b) => b.strength - a.strength || a.axisIndex - b.axisIndex);
  mixed.sort((a, b) => b.strength - a.strength || a.axisIndex - b.axisIndex);
  const readings = [], used = new Set(), axesUsed = new Set();
  const addDominant = item => {
    const evidence = selectEvidence(item.signals, 2, used);
    if (evidence.length < 2) return;
    const [title, text] = DIRECTIONS[item.axis][item.side];
    readings.push({ title, text, evidence: publicEvidence(evidence) });
    axesUsed.add(item.axis);
    evidence.forEach(e => used.add(e.questionIndex));
  };
  const addMixed = item => {
    if (axesUsed.has(item.axis)) return;
    const evidence = [...selectEvidence(item.positive, 2, used), ...selectEvidence(item.negative, 2, used)];
    if (evidence.length !== 4 || new Set(evidence.map(e => e.questionIndex)).size !== 4) return;
    readings.push({ title: `${AXES[item.axisIndex].name}：面对不同处境，你会换一种选择`,
      text: MIXED[item.axis], evidence: publicEvidence(evidence) });
    axesUsed.add(item.axis);
    evidence.forEach(e => used.add(e.questionIndex));
  };
  dominant.slice(0, 2).forEach(addDominant);
  for (const item of mixed) {
    if (readings.length >= (dominant.length ? 3 : 2)) break;
    addMixed(item);
  }
  for (const item of dominant.slice(2)) {
    if (readings.length === 3) break;
    addDominant(item);
  }
  return readings;
}
