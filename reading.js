import { AXES, QUESTIONS } from './data.js';
import { buildValueObservations } from './explanations.js';

/** A player's reading comes only from answers; changing best cannot change it. */
export function buildAnswerReading(answers, result) {
  if (!Array.isArray(result?.scores) || result.scores.length !== AXES.length ||
      !result.scores.every(Number.isFinite)) return [];
  return buildValueObservations(QUESTIONS, answers, AXES)
    .sort((a, b) => b.strength - a.strength || a.axisIndex - b.axisIndex)
    .slice(0, 3);
}
