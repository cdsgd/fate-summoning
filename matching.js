/**
 * Compare answer directions in the space this questionnaire can actually produce.
 * Character profiles describe semantic preferences, not attainable quiz scores.
 * Centre answers against the options actually offered, then remove correlations
 * between the six axes using the question bank's shared covariance matrix. This
 * is a single Fisher-scoring step for a weighted softmax choice model at neutral
 * preference. Compare the resulting semantic direction with character directions;
 * vector length cannot give profiles near the centre an automatic advantage.
 * No random draws, per-character offsets, observed-user data or result quotas.
 */
export const MATCH_MODEL_VERSION = 'evidence-and-behavior-v12';

const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const unit = vector => {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map(value => value / length) : vector.map(() => 0);
};

function inverse(matrix) {
  const size = matrix.length;
  // A relative numerical stabilizer also supports a future rank-deficient bank.
  // It is shared by every character and scales with question-weight units.
  const scale = matrix.reduce((sum, row, axis) => sum + row[axis], 0) / size || 1;
  const augmented = matrix.map((row, i) => [
    ...row.map((value, j) => value + (i === j ? scale * 1e-9 : 0)),
    ...row.map((_, j) => Number(i === j)),
  ]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    augmented[column] = augmented[column].map(value => value / divisor);
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      augmented[row] = augmented[row].map((value, j) => value - factor * augmented[column][j]);
    }
  }
  return augmented.map(row => row.slice(size));
}

export function createAffinityMatcher(questions, servants) {
  const dimensions = servants[0].profile.length;
  const zeros = () => Array(dimensions).fill(0);
  const directions = servants.map(s => unit(s.profile.map(value => (value - 50) / 50)));
  const statistics = questions.map(q => {
    const options = q.options.filter(option => !option.neutral);
    const mean = zeros().map((_, axis) =>
      options.reduce((sum, option) => sum + option.scores[axis], 0) / options.length);
    const variance = zeros().map((_, axis) =>
      options.reduce((sum, option) => sum + (option.scores[axis] - mean[axis]) ** 2, 0) / options.length);
    const covariance = zeros().map((_, a) => zeros().map((_, b) =>
      options.reduce((sum, option) => sum +
        (option.scores[a] - mean[a]) * (option.scores[b] - mean[b]), 0) / options.length));
    return { mean, variance, covariance };
  });

  // Only optional neutral choices change the active set (eight sets today).
  const contexts = new Map();
  function contextFor(active) {
    const key = active.map(value => value ? '1' : '0').join('');
    if (contexts.has(key)) return contexts.get(key);
    const mean = zeros(), variance = zeros(), covariance = zeros().map(zeros);
    questions.forEach((q, i) => {
      if (!active[i]) return;
      const stats = statistics[i];
      for (let axis = 0; axis < dimensions; axis++) {
        mean[axis] += stats.mean[axis] * q.weight;
        variance[axis] += stats.variance[axis] * q.weight ** 2;
        for (let b = 0; b < dimensions; b++) covariance[axis][b] += stats.covariance[axis][b] * q.weight;
      }
    });
    const deviation = variance.map(value => Math.sqrt(value) || 1);
    const context = { mean, deviation, transform: inverse(covariance) };
    contexts.set(key, context);
    return context;
  }

  return function match(answers) {
    const active = questions.map((q, i) => !q.options[answers[i]].neutral);
    const totals = zeros();
    questions.forEach((q, i) => {
      if (!active[i]) return;
      q.options[answers[i]].scores.forEach((value, axis) => { totals[axis] += value * q.weight; });
    });
    const { mean, deviation, transform } = contextFor(active);
    const delta = totals.map((value, axis) => value - mean[axis]);
    const standardized = totals.map((value, axis) => (value - mean[axis]) / deviation[axis]);
    const strength = Math.hypot(...standardized);
    const direction = unit(transform.map(row => dot(row, delta)));
    const ranked = servants.map((servant, i) => {
      const similarity = Math.max(-1, Math.min(1, dot(direction, directions[i])));
      // Half the chord length of two unit vectors: bounded from 0 to 1.
      return { servant, distance: Math.sqrt(Math.max(0, 2 - 2 * similarity)) / 2 };
    }).sort((a, b) => a.distance - b.distance || a.servant.id.localeCompare(b.servant.id, 'en'));
    return { ranked, weakSignal: strength < 1 };
  };
}
