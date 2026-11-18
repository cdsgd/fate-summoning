// Original fan affinity notes about the wish itself. These do not classify the
// player's morality, personality, skill, or behavioral preferences.
export const WISH_PRIORITIES = {
  wealth: '个人财富与生活选择', health: '自己的健康与人生体验',
  mastery: '精进一项技艺', recognition: '被他人看见与认可',
  close_person: '一位亲近者的生活', public_good: '更大范围的生活改善',
  keep_options: '保留决定愿望的余地',
};
const MOTIVES = {
  artoria: ['public_good', 'close_person'], emiya: ['public_good', 'close_person'],
  cu: ['mastery', 'health'], medusa: ['close_person', 'health'],
  medea: ['close_person', 'wealth'], kojiro: ['mastery', 'health'],
  heracles: ['close_person', 'public_good'], gilgamesh: ['wealth', 'recognition'],
  iskandar: ['recognition', 'health'], hassan: ['mastery', 'public_good'],
  lancelot: ['close_person', 'mastery'], mash: ['close_person', 'public_good'],
  jeanne: ['public_good', 'close_person'], merlin: ['keep_options', 'health'],
  scathach: ['mastery', 'keep_options'], arash: ['public_good', 'close_person'],
  nero: ['recognition', 'wealth'], waver: ['mastery', 'recognition'],
  enkidu: ['close_person', 'public_good'], dantes: ['keep_options', 'close_person'],
  oberon: ['keep_options', 'recognition'], tamamo: ['close_person', 'health'],
  musashi: ['mastery', 'health'], holmes: ['mastery', 'keep_options'],
};

export function wishAffinity(servantId, priority) {
  if (!Object.hasOwn(WISH_PRIORITIES, priority)) return 0;
  const motives = MOTIVES[servantId] || [];
  return motives[0] === priority ? 1 : motives[1] === priority ? 0.4 : 0;
}
