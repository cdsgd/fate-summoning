/**
 * Original Master call signs, generated from a name rather than translated from it.
 * This module has no DOM, network, storage, clock, or personality-scoring access.
 * Version the generator deliberately if an existing name's call sign must change.
 */
const VERSION = 1;
const SIGNATURE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function normalizeName(inputName) {
  return String(inputName ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ') || '旅人';
}

function avalanche(value) {
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

function rotateLeft(value, bits) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

// Four independent lanes consume every Unicode code point, including emoji.
// These deterministic identity seeds are not cryptographic credentials.
function hashName(name) {
  let a = 0x811c9dc5, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  let length = 0;
  for (const symbol of name) {
    const point = symbol.codePointAt(0);
    a = Math.imul(a ^ point, 0x01000193);
    b = Math.imul(b ^ point, 0x85ebca6b);
    c = Math.imul(c ^ point, 0xc2b2ae35);
    d = Math.imul(d ^ point, 0x27d4eb2f);
    length++;
  }
  return [
    avalanche(a ^ rotateLeft(b, 7) ^ length),
    avalanche(b ^ rotateLeft(c, 11) ^ length),
    avalanche(c ^ rotateLeft(d, 17) ^ length),
    avalanche(d ^ rotateLeft(a, 23) ^ length),
  ];
}

const CHINESE_REALMS = [
  ['寒星', '寒星之下'], ['晓雾', '晨雾之中'], ['余烬', '余烬之间'],
  ['暮潮', '暮色潮汐之间'], ['月影', '月影之中'], ['银湾', '银色海湾'],
  ['长夜', '长夜之中'], ['雨庭', '落雨的庭院'], ['旧垒', '旧日城垒'],
  ['白桦', '白桦林中'], ['回声', '回声之中'], ['远山', '远山之间'],
];
const CHINESE_ROLES = [
  ['守望者', '守望者'], ['执灯人', '执灯引路之人'], ['行旅者', '行旅之人'],
  ['记录者', '记录者'], ['引路人', '引路之人'], ['聆听者', '聆听者'],
];

const ENGLISH_REALMS = [
  ['Silent Dawn', '寂静黎明'], ['Silver Shore', '银色海岸'],
  ['Last Lantern', '最后一盏灯'], ['Veiled Moon', '被遮蔽的月亮'],
  ['Forgotten Gate', '被遗忘的门'], ['Distant Tide', '远方潮汐'],
  ['Winter Star', '冬日之星'], ['Hidden Archive', '隐秘档案'],
  ['Amber Flame', '琥珀色火焰'], ['Unbroken Vow', '未被打破的誓约'],
  ['Quiet Forest', '寂静森林'], ['First Light', '第一缕光'],
];
const ENGLISH_ROLES = [
  ['Keeper', 'of', '守护者'], ['Warden', 'of', '守卫者'],
  ['Witness', 'to', '见证者'], ['Seeker', 'of', '寻觅者'],
  ['Watcher', 'of', '守望者'], ['Voice', 'of', '代言者'],
];

const JAPANESE_REALMS = [
  ['暁', '拂晓时分'], ['月影', '月影之下'], ['星明かり', '星光之中'],
  ['夕凪', '晚风止息时'], ['夕暮れ', '黄昏时分'], ['銀の森', '银色森林'],
  ['冬空', '冬日天空'], ['雨音', '雨声之中'], ['遠い海', '远海'],
  ['白い庭', '白色庭院'], ['静かな川', '宁静河流'], ['古い塔', '古塔'],
];
const JAPANESE_ROLES = [
  ['守り手', '守护者'], ['旅人', '旅人'], ['案内人', '引路人'],
  ['語り手', '讲述者'], ['記録者', '记录者'], ['番人', '看守者'],
];

// Abstract French nouns keep the phrase independent of the user's gender.
// Articles and contractions belong to the whole realm phrase, never guessed.
const FRENCH_REALMS = [
  ['de l’aube', '拂晓'], ['des brumes', '迷雾'], ['des étoiles', '繁星'],
  ['du crépuscule', '黄昏'], ['de la mer', '大海'], ['des cendres', '灰烬'],
  ['des remparts', '城垣'], ['de la pluie', '雨'], ['des serments', '誓约'],
  ['des archives', '档案'], ['de la forêt', '森林'], ['de la lune', '月亮'],
];
const FRENCH_ROLES = [
  ['Veille', '守望'], ['Mémoire', '记忆'], ['Écho', '回声'],
  ['Lueur', '微光'], ['Trace', '痕迹'], ['Souffle', '气息'],
];

function makePhrase(languageIndex, roleSeed, realmSeed) {
  if (languageIndex === 0) {
    const realm = CHINESE_REALMS[realmSeed % CHINESE_REALMS.length];
    const role = CHINESE_ROLES[roleSeed % CHINESE_ROLES.length];
    return { title: realm[0] + role[0], meaning: `${realm[1]}的${role[1]}`, language: '中文', languageTag: 'zh' };
  }
  if (languageIndex === 1) {
    const realm = ENGLISH_REALMS[realmSeed % ENGLISH_REALMS.length];
    const role = ENGLISH_ROLES[roleSeed % ENGLISH_ROLES.length];
    return { title: `${role[0]} ${role[1]} the ${realm[0]}`, meaning: `${realm[1]}的${role[2]}`, language: '英语', languageTag: 'en' };
  }
  if (languageIndex === 2) {
    const realm = JAPANESE_REALMS[realmSeed % JAPANESE_REALMS.length];
    const role = JAPANESE_ROLES[roleSeed % JAPANESE_ROLES.length];
    return { title: `${realm[0]}の${role[0]}`, meaning: `${realm[1]}的${role[1]}`, language: '日语', languageTag: 'ja' };
  }
  const realm = FRENCH_REALMS[realmSeed % FRENCH_REALMS.length];
  const role = FRENCH_ROLES[roleSeed % FRENCH_ROLES.length];
  return { title: `${role[0]} ${realm[0]}`, meaning: `${realm[1]}的${role[1]}`, language: '法语', languageTag: 'fr' };
}

/**
 * @param {string} [inputName=''] A name or nickname; empty input uses 旅人.
 * @returns {{code:string,title:string,language:string,languageTag:string,meaning:string,seed:string,signature:string,version:number}}
 * Returned display strings contain only curated vocabulary and a hash suffix;
 * raw user input is never interpolated into a call sign or returned as markup.
 */
export function generateMasterCode(inputName = '') {
  const words = hashName(normalizeName(inputName));
  const phrase = makePhrase(words[0] % 4, words[1], words[2]);
  let suffixSeed = words[3];
  let signature = '';
  for (let i = 0; i < 3; i++) {
    signature += SIGNATURE_ALPHABET[suffixSeed & 31];
    suffixSeed >>>= 5;
  }
  return {
    ...phrase,
    code: `${phrase.title} · ${signature}`,
    seed: `mc${VERSION}-${words.map(word => word.toString(16).padStart(8, '0')).join('')}`,
    signature,
    version: VERSION,
  };
}
