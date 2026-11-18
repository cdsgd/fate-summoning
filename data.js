/**
 * Fan-made summoning affinity model. Profiles, answers and readings are original
 * interpretations, not official character parameters or psychological measures.
 * Displayed axes use attainable minimum/maximum values. Matching compares
 * player and character answer directions on a shared questionnaire scale.
 * Four identity chapters use original thought experiments; aesthetic preferences
 * are recalled separately and never contribute to the matching score.
 */
import { createAffinityMatcher, MATCH_MODEL_VERSION } from './matching.js';
import questionBank from './questions-v11.json' with { type: 'json' };
import { analyzeBehavior, rankBehavior } from './behavior.js';
import { buildMatchExplanation } from './explanations.js';
import { WISH_PRIORITIES, wishAffinity } from './wish-priorities.js';

export const STORAGE_KEY = 'fate-summoning-contract-v11';
export const MATCHING_VERSION = MATCH_MODEL_VERSION;
export const SCENARIO_NOTE = '32个选择分成四章，包含七道当事人视角的历史战争题、三道亲密关系题、八道关于相处与做事方式的情境题。审美只作故事回顾，不参与人格与英灵匹配。';

export const AXES = [
  { id: 'vision', name: '愿景', low: '务实', high: '理想' },
  { id: 'strategy', name: '谋略', low: '直觉', high: '筹划' },
  { id: 'bond', name: '联结', low: '自主', high: '共担' },
  { id: 'presence', name: '表达', low: '内敛', high: '外显' },
  { id: 'order', name: '规则', low: '变通', high: '守序' },
  { id: 'resolve', name: '行动', low: '审慎', high: '决断' },
];

export const STAGES = [
  {
    "id": "oath",
    "title": "远行之前",
    "en": "BEFORE DEPARTURE",
    "description": "出发之前，有些事还来得及决定：两个人怎样走下去，哪些话要说出口，又有什么值得带在身边。",
    "role": "远行前的你",
    "authority": "只决定自己的去留、表达与承诺，也给对方同样的选择。"
  },
  {
    "id": "choice",
    "title": "军旗之下",
    "en": "UNDER THE BANNER",
    "description": "你站在渡口、弓前、河岸和审判席上。军旗背后的每一次取舍，都要由身在其中的你亲自承担。",
    "role": "身在战局的你",
    "authority": "选择由你作出，代价也落在自己身上；有些决定会影响与你同行的人。"
  },
  {
    "id": "covenant",
    "title": "灯火归途",
    "en": "THE WAY HOME",
    "description": "回到熟悉的街道，生活却没有停在原处。有人等着你的解释，也有战后的责任和未了的往事，需要你亲自面对。",
    "role": "归来后的你",
    "authority": "你决定自己的关系、住处与公开表态；亲近的人也有自己的决定。"
  },
  {
    "id": "wish",
    "title": "星海与圣杯",
    "en": "STARS AND THE GRAIL",
    "description": "圣杯就在前方。关于未知、命运和一路走来的意义，你已有自己的回答。现在，想一想这次奇迹应该改变什么。",
    "role": "圣杯前的御主",
    "authority": "你决定如何使用圣杯，也决定愿望实现后怎样继续生活。"
  }
];

export const QUESTIONS = questionBank;

export const SOURCES = [
  { label: 'Fate/stay night [Unlimited Blade Works] 官方角色页', url: 'https://www.fate-sn.com/ubw/chara/', type: 'fate' },
  { label: 'Fate/Zero 官方角色页', url: 'https://www.fate-zero.jp/characters/', type: 'fate' },
  { label: 'Fate/Grand Order 官方英灵目录', url: 'https://www.fate-go.jp/trajectory/servant/', type: 'fate' },
  { label: 'Atlas Academy · FGO游戏数据接口', url: 'https://api.atlasacademy.io/', type: 'game-data' },
];

const origin = (kind, era, region, text, difference, sourceLabel, sourceUrl) => ({ kind, era, region, text, difference, sourceLabel, sourceUrl });
// NP/skill names and initial rarity/card are checked against the selected FGO
// entries in Atlas Academy's CN game-data API. Notes are original interpretations.
// This is the game's battle NP slot, not a claim that a character has only one NP.
const game = (npName, npSubtitle, npType, skillName, fieldNote, card, rarity, npId, svtId) => ({
  npName, npSubtitle, npType, skillName, fieldNote, card, rarity, npId,
  version: 'FGO初始灵基展示',
  sourceLabel: 'Atlas Academy · FGO CN游戏数据',
  sourceUrl: `https://api.atlasacademy.io/nice/CN/servant/${svtId}`,
});
const GAME_DATA = {
  artoria: game('誓约胜利之剑', 'Excalibur', '对城宝具', '魔力放出 A', '先用魔力放出准备爆发，再让誓约胜利之剑承担关键一击。给她清晰的目标，也留出判断战场的余地。', 'Buster', 5, 100101, 100100),
  emiya: game('无限剑制', 'Unlimited Blade Works', '？？？？', '心眼（真） B', '以心眼保持战线，用无限剑制应对需要集中施压的局面。此处采用原始Buster宝具，未混用后来的变色条目。', 'Buster', 4, 200101, 200100),
  cu: game('穿刺死棘之枪', 'Gae Bolg', '对人宝具', '避矢之加护 B', '用避矢之加护保留周旋空间，把宝具留给真正需要突破的目标。比起逐步干预，更适合讲明目标后信任他的现场判断。', 'Quick', 3, 300101, 300100),
  medusa: game('骑英之缰绳', 'Bellerophon', '对军宝具', '魔眼 A+', '以魔眼争取行动余地，再由骑英之缰绳打开战线。提前照顾她的准备节奏，往往比临时催促更有帮助。', 'Quick', 3, 400101, 400100),
  medea: game('万符必应破戒', 'Rule Breaker', '对魔术宝具', '高速神言 A', '高速神言让术式更快就绪，破戒宝具则适合应对依赖强化的对手。与她共享情报，一起找出规则中可突破的位置。', 'Arts', 3, 500101, 500100),
  kojiro: game('燕返', 'Tsubame Gaeshi', '对人魔剑', '心眼（伪） A', '利用心眼寻找交锋间隙，以燕返专注解决眼前的目标。不要让他承接过多分散的任务，给专注留下一段完整的空间。', 'Quick', 1, 600101, 600100),
  heracles: game('射杀百头', 'Nine Lives', '不明', '勇猛 A+', '勇猛与正面攻击相呼应，射杀百头指向关键目标。这是FGO的战斗宝具栏，与原作中其他知名宝具应当区分。', 'Buster', 4, 700101, 700100),
  gilgamesh: game('天地乖离开辟之星', 'Enuma Elish', '对界宝具', '领袖气质 A+', '先统合队伍的进攻节奏，再以乖离剑宝具形成压制。明确展示你的判断，比只把他当作最后的火力更适合这份契约。', 'Buster', 5, 200201, 200200),
  iskandar: game('王之军势', 'Ionioi Hetairoi', '对军宝具', '雷之征服者 EX', '王之军势让并肩的意象成为宝具。御主适合负责方向与后勤，让他的开拓热情真正连接整支队伍。', 'Buster', 5, 400201, 400200),
  hassan: game('妄想心音', 'Zabaniya', '对人宝具', '避风的加护 A', '以避风的加护保留周旋机会，让妄想心音锁定需要处理的目标。清楚交代情报、边界与撤离条件，是可靠合作的开端。', 'Quick', 2, 600201, 600200),
  lancelot: game('骑士不徒手而亡', 'Knight of Owner', '对人宝具', '无穷的武练 A+', '无穷的武练帮助他掌握攻击节奏，宝具则展现骑士运用武器的能力。安排好支援与承压方式，让投入有明确的落点。', 'Quick', 4, 700201, 700200),
  mash: game('假想宝具 拟似展开/人理之础', 'Lord Chaldeas', '对人宝具', '现为脆弱的雪花之壁', '用守护类技能承接队伍压力，再以防御宝具为下一步争取余地。这里固定初始三星灵基，不混用后期宝具与稀有度。', 'Arts', 3, 800101, 800100),
  jeanne: game('吾主在此', 'Luminosite Eternelle', '结界宝具', '启示 A', '先关注全队的存续，再用结界宝具稳住需要撑过的一轮。事先约定保护的时机，会让她的坚持更有效地支持伙伴。', 'Arts', 5, 900101, 900100),
  merlin: game('永世隔绝的理想乡', 'Garden of Avalon', '对人宝具', '英雄塑造 EX', '英雄塑造服务于进攻窗口，理想乡则支持更长的战线。御主要在远见与当下之间作出明确安排，而不只等待下一种可能。', 'Arts', 5, 500801, 500800),
  scathach: game('贯穿死翔之枪', 'Gae Bolg Alternative', '对人宝具', '原初之卢恩', '让原初之卢恩与宝具的时机相互衔接，寻找一次清晰的突破窗口。清楚说明目标，也准备接受她直接而严格的反馈。', 'Quick', 5, 301301, 301300),
  arash: game('流星一条', 'Stella', '对军宝具', '健硕 EX', '流星一条伴随自身退场，释放前应考虑后续队形与任务节奏。把这一机制当作编成选择，不把一次付出等同于伙伴的全部价值。', 'Buster', 1, 201301, 201300),
  nero: game('童女讴歌的荣华帝政', 'Laus Saint Claudius', '对阵宝具', '皇帝特权 EX', '皇帝特权强化她的临场发挥，宝具为进攻搭起自己的舞台。把目标说清楚，也给她一点表达与创造的空间。', 'Arts', 4, 100501, 100500),
  waver: game('石兵八阵', '无还之阵 · Kaerazu no Jin', '对军宝具', '军师的指挥 A+', '先用军师的指挥组织队伍，再由石兵八阵调节战线节奏。适合共享完整信息、明确分工，而不是把所有准备都交给他一人。', 'Arts', 5, 501901, 501900),
  enkidu: game('世人啊，冀以锁系神明', 'Enuma Elish', '对肃正宝具', '完全之形 A', '完全之形让他维持自己的战斗状态，宝具则集中回应眼前威胁。平等讨论目标与边界，比替对方预设意义更能建立默契。', 'Buster', 5, 300801, 300800),
  dantes: game('虎啊，煌煌燎燃', "Enfer Chateau d’If", '对军宝具', '钢铁的决意 EX', '钢铁的决意与宝具的进攻窗口相呼应。让他的意志指向共同决定的目标，同时为下一轮行动留出支援。', 'Quick', 5, 1100201, 1100200),
  oberon: game('于彼方点缀的梦之童话', 'Rye Rhyme Goodfellow', '对人宝具', '夜之帷幕 EX', '夜之帷幕与这一展示宝具都带有梦与舞台的意象。此处只使用首个再临对应资料，不展开涉及主线的后期身份。', 'Buster', 5, 2800101, 2800100),
  tamamo: game('水天日光天照八野镇石', 'Suiten Nikko Amaterasu Yano Shizu-Ishi', '对军宝具', '咒术 EX', '咒术调节对手的节奏，水天日光则服务于全队周转。适合耐心经营的协作，让每个回合的小支持逐渐连成稳定的战线。', 'Arts', 5, 500301, 500300),
  musashi: game('六道五轮·俱利伽罗天象', 'Rikudougorin Kurikaratenshou', '对人宝具', '天眼 A', '用天眼明确进攻窗口，再以剑之宝具收束判断。给她探索与临场发挥的余地，同时把会合和支援的约定说清楚。', 'Buster', 5, 101701, 101700),
  holmes: game('这是常识，我亲爱的朋友啊', 'Elementary My Dear', '对人宝具／对界宝具', '假设推论 A+', '先用假设推论整理战场条件，再让宝具帮助队伍理解并突破眼前的障碍。情报越完整，合作就越能发挥价值。', 'Arts', 5, 900501, 900500),
};
const servant = (data) => ({
  quoteLabel: '本测试原创契约寄语',
  officialUrl: data.work.includes('stay night') ? 'https://www.fate-sn.com/ubw/chara/' :
    data.work === 'Fate/Zero' ? 'https://www.fate-zero.jp/characters/' :
    'https://www.fate-go.jp/trajectory/servant/',
  game: GAME_DATA[data.id],
  ...data,
});

export const SERVANTS = [
  servant({ id: 'artoria', name: '阿尔托莉雅·潘德拉贡', en: 'Artoria Pendragon', class: 'Saber', title: '将誓言化为剑的人', work: 'Fate/stay night · Fate/Zero', tags: ['责任','理想','守护'], profile: [94,65,77,24,95,85], color: '#a4bdcf', element: '风与星光', crest: 'sword',
    summary: '你会把承诺当作需要亲手完成的事。即使局面复杂，也希望选择能经得起自己的审视。',
    compatibility: '她能理解你对责任的认真；而你需要记得，可靠的伙伴也值得被照顾。你们的契约，适合建立在共同承担而非单方面牺牲之上。',
    quote: '若你仍愿守住那份誓言，我便与你一同前行。', ritual: '以未曾放下的理想，点亮剑之座。',
    origin: origin('传说人物','中世纪亚瑟王文学传统','不列颠与欧洲大陆','亚瑟是不列颠传说中的君王，其历史原型尚无定论。圆桌、卡美洛与圣剑等要素在不同年代的文学中逐渐发展。阅读这些故事时，需要区分可能的历史背景与后世骑士文学，而不能把完整传说视为已证实的生平。','Fate将亚瑟王改编为女性阿尔托莉雅，并为其赋予独立的圣杯战争故事。','Encyclopaedia Britannica · King Arthur','https://www.britannica.com/topic/King-Arthur'),
  }),
  servant({ id: 'emiya', name: '卫宫', en: 'EMIYA', class: 'Archer', title: '将答案留在行动里', work: 'Fate/stay night', tags: ['筹谋','现实','隐忍'], profile: [48,93,51,14,51,81], color: '#c78b85', element: '钢与余烬', crest: 'bow',
    summary: '你倾向看清代价，再把能够做到的部分认真完成。比起漂亮的宣言，你更信任充分的准备和实际的行动。',
    compatibility: '你们容易在不多解释的协作中建立默契。但过于熟悉彼此的倔强，也可能让沟通被省略。把真正的愿望说出来，会让这份契约更稳固。',
    quote: '先把眼前这一步做好。至于答案，我们走下去再看。', ritual: '以反复锤炼的选择，呼唤弓之座。',
    origin: origin('原创人物','TYPE-MOON虚构世界','现代日本的架空舞台','卫宫是Fate世界中的原创人物，不能对应某一位真实历史人物。他的叙事围绕理想、代价与自我审视展开。这里的英文名和职阶用于固定本测试采用的角色版本，性格分数与契合分析则是本测试的原创解读。','这是作品原创英灵，本页不把他的经历当作历史材料。','Fate/stay night [UBW] 官方角色页','https://www.fate-sn.com/ubw/chara/'),
  }),
  servant({ id: 'cu', name: '库·丘林', en: 'Cú Chulainn', class: 'Lancer', title: '让命运先接一枪', work: 'Fate/stay night', tags: ['直觉','果决','坦率'], profile: [56,33,67,72,23,94], color: '#8eafcf', element: '风与赤雷', crest: 'spear',
    summary: '你愿意正面面对局势，重视自己的判断与步调。与其在犹豫里耗尽机会，你更想先踏出真正的一步。',
    compatibility: '他适合与信任现场判断、尊重伙伴自尊的御主同行。清楚说明目标，再给彼此行动的空间，会比事事控制更有效。',
    quote: '把你的决定告诉我，接下来的路就痛快地走。', ritual: '以不回避的目光，开启枪之座。',
    origin: origin('传说人物','爱尔兰乌尔斯特传说体系','爱尔兰','库丘林是爱尔兰乌尔斯特传说中的英雄，与《夺牛长征记》等叙事密切相关。他的少年事迹、武艺与悲剧命运属于历经传播的英雄文学。传说中的事件时间与文本记录的形成时间并不相同，也不能据此证明其真实存在。','Fate以爱尔兰英雄传说为基础，重构了其宝具、性格与现代召唤经历。','Encyclopaedia Britannica · Cú Chulainn','https://www.britannica.com/topic/Cu-Chulainn'),
  }),
  servant({ id: 'medusa', name: '美杜莎', en: 'Medusa', class: 'Rider', title: '在沉默中守护', work: 'Fate/stay night', tags: ['安静','羁绊','敏锐'], profile: [57,69,87,9,43,65], color: '#b2a0c7', element: '夜与紫晶', crest: 'chain',
    summary: '你不一定急于表达，却会留心重要之人的处境。比起被所有人理解，你更重视少数关系中的信任。',
    compatibility: '给她稳定而明确的信任，也让自己的边界被看见。你们可以在安静的日常里积累默契，而不必用强烈的宣言证明彼此。',
    quote: '不必急着让所有人理解。重要的约定，我会记住。', ritual: '以安静而坚定的牵挂，回应骑之座。',
    origin: origin('神话人物','古希腊神话传统','古希腊','美杜莎是希腊神话中的戈耳工之一，珀耳修斯斩首的故事使其广为人知。有关她的出身、外貌与变化原因，不同古代作者并不完全一致。后世艺术也不断重新解释她，因此单一版本并不能代表全部神话传统。','Fate在多种神话叙述上发展了自己的姐妹关系、人格与Rider灵基。','Encyclopaedia Britannica · Medusa','https://www.britannica.com/topic/Medusa-Greek-mythology'),
  }),
  servant({ id: 'medea', name: '美狄亚', en: 'Medea', class: 'Caster', title: '亲手改写既定之局', work: 'Fate/stay night', tags: ['谋略','自主','边界'], profile: [28,97,51,25,24,68], color: '#ac9acb', element: '紫雾与术式', crest: 'staff',
    summary: '你擅长在限制中寻找缝隙，不愿把主动权完全交给规则。对你而言，理解局面往往是改变局面的第一步。',
    compatibility: '互相尊重能力与选择，是你们合作的起点。与其只在需要力量时想起她，不如共同制定计划，把信任落实到具体的分工里。',
    quote: '既然旧的道路不肯通向愿望，那就亲手铺一条。', ritual: '以理解规则之后的自由，构筑术之座。',
    origin: origin('神话人物','古希腊神话与悲剧传统','科尔喀斯及希腊世界','美狄亚是希腊神话中的科尔喀斯公主，与伊阿宋和金羊毛传说相关。欧里庇得斯的同名悲剧是影响深远的版本，但并不是故事唯一的源头。她既是神话与文学中的复杂人物，也不能用现代作品的设定反推古代文本。','Fate将神话魔法人物转化为Caster，并另写了现代圣杯战争中的处境。','Encyclopaedia Britannica · Medea','https://www.britannica.com/topic/Medea-Greek-mythology'),
  }),
  servant({ id: 'kojiro', name: '佐佐木小次郎', en: 'Sasaki Kojirō', class: 'Assassin', title: '把一件事做到极处', work: 'Fate/stay night', tags: ['专注','独行','从容'], profile: [64,39,22,25,49,70], color: '#a8a8c5', element: '风与薄暮', crest: 'katana',
    summary: '你珍惜不被打扰的专注，也愿意为一件真正感兴趣的事反复练习。外部评价并不是你坚持的唯一理由。',
    compatibility: '你们适合保留各自的独立空间，以技艺和行动相互理解。目标可以简单，彼此的认真却需要被尊重。',
    quote: '无需太多理由。此刻值得，便把这一式完成。', ritual: '以心无旁骛的一瞬，叩响暗杀者之座。',
    origin: origin('传说人物','日本近世剑豪叙事','日本','佐佐木小次郎通常作为宫本武藏的对手出现在剑豪故事中。国立国会图书馆典据记录将其列为剑客，但其生平材料与后世传闻交织，许多细节难以独立核实。这里以剑豪传说原型介绍，不把流行决斗情节都视作已证实的历史。','Fate中的Assassin并非直接还原可考生平，而是借用小次郎名号展开的独立设定。','日本国立国会图书馆 · 佐々木小次郎典据记录','https://id.ndl.go.jp/auth/ndlna/00623269'),
  }),
  servant({ id: 'heracles', name: '赫拉克勒斯', en: 'Heracles', class: 'Berserker', title: '为守护承担重量', work: 'Fate/stay night', tags: ['坚定','守护','行动'], profile: [72,25,89,19,64,98], color: '#b69b7d', element: '岩与烈焰', crest: 'axe',
    summary: '面对重要的事情，你往往选择直接承担。你需要清楚的方向，也愿意用持续的行动守住自己认定的关系。',
    compatibility: '你们的契约需要明确的信任与目标。别只看见力量，也记得为这位伙伴保留判断、尊严，以及被理解的位置。',
    quote: '把要守护的事物放在身后，接下来一起向前。', ritual: '以不肯退让的守护，唤醒狂之座。',
    origin: origin('神话人物','古希腊神话传统','古希腊与地中海世界','赫拉克勒斯是希腊神话中的英雄，罗马传统通常称他为赫丘利。十二项功业是其最著名的故事组之一，但各地传承和作者记载存在差异。其力量、苦难与神格化属于神话叙事，不能作为真实人物的历史生平阅读。','Fate以Berserker职阶呈现其部分特征，职阶机制和战斗参数属于作品设定。','Encyclopaedia Britannica · Heracles','https://www.britannica.com/topic/Heracles'),
  }),
  servant({ id: 'gilgamesh', name: '吉尔伽美什', en: 'Gilgamesh', class: 'Archer', title: '以自己的尺度衡量', work: 'Fate/stay night · Fate/Zero', tags: ['自信','审视','主导'], profile: [44,84,17,97,62,92], color: '#d4b779', element: '黄金与星尘', crest: 'crown',
    summary: '你有自己的评价标准，也愿意为判断站到台前。遇到复杂局面时，你更想掌握全局，而非随人群移动。',
    compatibility: '这份契约需要清醒的边界，而非一味迎合。展示你的判断与真正珍视之物，才可能让彼此的强烈意志形成有效合作。',
    quote: '让你的愿望有配得上它的尺度，再把它带到我面前。', ritual: '以不借他人定义的意志，打开黄金之门。',
    origin: origin('传说人物','古代美索不达米亚史诗传统','乌鲁克，今伊拉克地区','吉尔伽美什是美索不达米亚史诗中的乌鲁克王。相关传统可能保留古代王权记忆，但史诗中的远征、神祇和求生之旅属于文学与神话叙事。《吉尔伽美什史诗》有漫长的文本流传史，不能把整部作品当作一份君王实录。','Fate的王之财宝、外观和Archer灵基是以史诗为灵感的创作。','Encyclopaedia Britannica · Gilgamesh','https://www.britannica.com/topic/Gilgamesh'),
  }),
  servant({ id: 'iskandar', name: '伊斯坎达尔', en: 'Iskandar', class: 'Rider', title: '让远方成为共同梦想', work: 'Fate/Zero', tags: ['开拓','同行','豪迈'], profile: [86,61,96,98,28,95], color: '#c99b77', element: '沙海与雷鸣', crest: 'chariot',
    summary: '你容易被新的可能性吸引，也愿意把热情分享给身边的人。目标的意义，不只在抵达，也在一起出发。',
    compatibility: '你们适合共同描绘一个足够辽阔的方向，也需要有人记得补给、休整与现实边界。让热情有落脚点，远征才会持续。',
    quote: '若远方仍在呼唤，就邀上愿意同行的人一起出发。', ritual: '以愿与众人分享的雄心，回应征途。',
    origin: origin('历史人物','公元前356—323年','马其顿及其远征区域','伊斯坎达尔是亚历山大大帝在一些语言传统中的称呼。作为马其顿君主，亚历山大征服波斯帝国并远征至印度河流域，其扩张推动了希腊化世界的形成。历史评价既涉及文化交流，也涉及征服战争造成的破坏与统治问题。','Fate强化了豪迈的征服王形象；固有结界与宝具不属于历史事实。','Encyclopaedia Britannica · Alexander the Great','https://www.britannica.com/biography/Alexander-the-Great'),
  }),
  servant({ id: 'hassan', name: '咒腕哈桑', en: 'Hassan of the Cursed Arm', class: 'Assassin', title: '让承诺安静地兑现', work: 'Fate/stay night', officialUrl: 'https://www.fate-go.jp/trajectory/servant/', tags: ['缜密','克制','履约'], profile: [35,91,60,7,76,80], color: '#9faeaa', element: '影与月砂', crest: 'dagger',
    summary: '你习惯看见容易被忽略的细节，重视可靠和分寸。与其成为目光的中心，你更愿意让事情准确地发生。',
    compatibility: '清晰、公平的约定能让你们建立稳定合作。你需要认真对待他的判断，而不只把沉默理解为没有自己的立场。',
    quote: '把约定说清楚。余下的，就在无人注视处完成。', ritual: '以不需掌声的承诺，接通无声之座。',
    origin: origin('原创人物','Fate虚构英灵设定','借鉴中世纪西亚意象','咒腕哈桑是Fate创作的特定英灵，并不等于某位有可考生平的历史刺客。他的称号借用了与哈桑、山中老人及刺客传说相关的文化意象。介绍这一角色时，应当区分作品中的组织与能力，以及真实历史中的宗教和政治群体。','咒腕、特定宝具和个人经历为作品创作，不可当作哈桑·萨巴赫的生平。','Fate/Grand Order 官方英灵目录','https://www.fate-go.jp/trajectory/servant/'),
  }),
  servant({ id: 'lancelot', name: '兰斯洛特', en: 'Lancelot', class: 'Berserker', title: '在裂痕中守住执念', work: 'Fate/Zero', tags: ['忠诚','隐忍','决意'], profile: [77,63,82,16,78,96], color: '#9b9fb9', element: '黑钢与湖光', crest: 'sword',
    summary: '你很难轻轻放下自己认定的承诺。关系与责任可能让你承受压力，但也会成为你继续行动的力量。',
    compatibility: '你们需要允许复杂感受被说出，避免把所有负担都变成沉默。清楚区分过去的遗憾与现在的选择，会让合作拥有新的起点。',
    quote: '过去未必能够重写，但此刻仍可以作出新的选择。', ritual: '以未曾熄灭的决意，映照湖之骑士。',
    origin: origin('文学人物','中世纪亚瑟王骑士文学','法国与不列颠文学传统','兰斯洛特是亚瑟王文学中的圆桌骑士，其形象在中世纪法国骑士传奇中得到重要发展。他与亚瑟、桂妮薇儿及圣杯叙事的关系，因文本而异。所谓湖上骑士的经历属于文学传统，不是可据以复原的真实骑士传记。','此处固定为Fate/Zero的Berserker版本，不与其他作品中的Saber灵基混用。','Encyclopaedia Britannica · Lancelot','https://www.britannica.com/topic/Lancelot'),
  }),
  servant({ id: 'mash', name: '玛修·基列莱特', en: 'Mash Kyrielight', class: 'Shielder', title: '把同行变成勇气', work: 'Fate/Grand Order', tags: ['同行','认真','守护'], profile: [87,75,98,13,91,67], color: '#b8a9c9', element: '紫晶与晨光', crest: 'shield',
    summary: '你很重视一起经历的过程，也愿意认真回应别人给予的信任。温和并不妨碍你在关键时刻站稳位置。',
    compatibility: '共同确认每一步的意义，会比只追求最快的答案更适合你们。互相支持，也互相鼓励去形成自己的判断。',
    quote: '即使答案尚未出现，我们仍可以一起走到明天。', ritual: '以并肩而行的约定，点亮盾之座。',
    origin: origin('原创人物','TYPE-MOON虚构世界','Fate/Grand Order的架空舞台','玛修是《Fate/Grand Order》的原创人物，其身份与故事属于作品世界。她的角色意象与圆桌骑士传统相联系，但人物本人没有对应的历史生平。为保留阅读体验，本页只介绍原型层面的关系，不展开涉及主线的具体设定。','玛修并非历史人物；也不应将她与亚瑟王文学中的某位骑士直接视作同一人。','Fate/Grand Order 官方英灵目录','https://www.fate-go.jp/trajectory/servant/'),
  }),
  servant({ id: 'jeanne', name: '贞德', en: "Jeanne d’Arc", class: 'Ruler', title: '让信念成为方向', work: 'Fate/Apocrypha · Fate/Grand Order', tags: ['信念','公正','支持'], profile: [98,76,92,28,93,81], color: '#c5c5d0', element: '银旗与晨星', crest: 'flag',
    summary: '你希望选择不仅能够奏效，也能对得起自己的信念。在复杂关系中，你会努力找到可以让众人继续前进的方向。',
    compatibility: '你们容易因共同的坚持相互理解。也要允许彼此承认局限，让信念支持现实中的人，而不只是要求他们始终坚强。',
    quote: '愿这面旗帜提醒我们，为何决定站在这里。', ritual: '以经得起风雨的信念，升起裁定之旗。',
    origin: origin('历史人物','约1412—1431年','法国','贞德是百年战争时期的法国人物，曾参与解救奥尔良并支持查理七世加冕。她于1431年在鲁昂被处死，后来相关审判被撤销，并于1920年被天主教会封圣。历史研究、宗教理解与后世文化塑造是观察她的不同层面。','Ruler职阶、圣杯裁定机制与战斗能力是Fate的文学改编。','Encyclopaedia Britannica · Joan of Arc','https://www.britannica.com/biography/Saint-Joan-of-Arc'),
  }),
  servant({ id: 'merlin', name: '梅林', en: 'Merlin', class: 'Caster', title: '把可能性留给未来', work: 'Fate/Grand Order', tags: ['洞察','游离','可能性'], profile: [72,96,57,73,16,40], color: '#c1afd8', element: '花与星雾', crest: 'staff',
    summary: '你喜欢从更远处观察故事，愿意为尚未发生的事保留空间。你不急于把每种可能都变成唯一答案。',
    compatibility: '你们能在想象与判断上相互启发，但仍需要明确眼前要完成的事。让远见落在一个具体的小行动里，才能真正改变故事。',
    quote: '别急着替故事写下句号，下一页仍有新的光。', ritual: '以仍未闭合的可能，唤来花之术者。',
    origin: origin('文学人物','中世纪亚瑟王文学传统','不列颠及欧洲大陆','梅林是亚瑟王文学中的先知与魔法师，其形象汇集了不同时期的传说和创作。中世纪作者不断重写他的身世、预言及与王权的关系。大学收藏与研究的法文叙事残片，也展示了这些故事如何传播，而非提供一份确定的历史传记。','Fate中的梦魔身世、乐园设定与具体人格是这一文学形象的新改编。','University of Bristol · Medieval Merlin manuscript fragments','https://www.bristol.ac.uk/news/2021/september/bristol-merlin-update.html'),
  }),
  servant({ id: 'scathach', name: '斯卡哈', en: 'Scáthach', class: 'Lancer', title: '在边界处磨砺自我', work: 'Fate/Grand Order', tags: ['技艺','独立','清醒'], profile: [64,82,36,25,52,89], color: '#bb91ad', element: '影与赤曜', crest: 'spear',
    summary: '你重视能力的真正成长，不太满足于表面的认可。面对难题，你愿意承认边界，也愿意通过练习推远边界。',
    compatibility: '你们适合建立直接而坦诚的关系：说明目标、接受反馈，再把进步落实到行动。尊重彼此独立，会让信任更牢固。',
    quote: '先看清自己的边界，再决定怎样越过它。', ritual: '以愿受锤炼的决心，开启影之国的门。',
    origin: origin('传说人物','爱尔兰乌尔斯特传说体系','爱尔兰及传说中的阿尔巴','斯卡哈见于爱尔兰英雄文学，与库丘林学习武艺的叙事相关。《求婚埃默》等文本保存了相应传统，不同译本的名字拼写有所变化。她属于英雄传说中的武艺导师形象，不能据此认定为生卒年代明确的历史人物。','Fate在既有传说上发展了不死性及Lancer战斗体系等独立设定。','University College Cork · The Wooing of Emer','https://celt.ucc.ie/published/T301021.html'),
  }),
  servant({ id: 'arash', name: '阿拉什', en: 'Arash', class: 'Archer', title: '让这一箭抵达明天', work: 'Fate/Grand Order', tags: ['坦率','担当','同行'], profile: [83,49,91,57,57,91], color: '#b8aa83', element: '晨风与弦光', crest: 'bow',
    summary: '你愿意把力量用在明确而重要的事情上。面对同伴，你更在乎能否真正帮上忙，而不是让自己显得特别。',
    compatibility: '你们可以成为坦诚可靠的搭档。也请把照顾自己纳入约定，让担当拥有持续的余地，而非把所有价值都寄托在一次付出中。',
    quote: '愿这一程之后，仍有人能够平安迎接明天。', ritual: '以愿让众人回家的心，拉开长弓。',
    origin: origin('传说人物','伊朗英雄传说传统','古代伊朗文化圈','阿拉什是伊朗传统中的神射手，与以射箭划定边界的故事相连。相关叙事在不同时代材料中有所变化，体现了土地、牺牲与共同体的主题。他属于英雄传说人物，其具体经历不能像有同时代记录的历史人物那样加以确认。','Fate将传说之箭发展为宝具，并赋予其可召唤英灵的身份与性格。','Encyclopaedia Iranica · Āraš','https://www.iranicaonline.org/articles/aras-avestan-erexsa/'),
  }),
  servant({ id: 'nero', name: '尼禄·克劳狄乌斯', en: 'Nero Claudius', class: 'Saber', title: '让热爱拥有舞台', work: 'Fate/EXTRA · Fate/Grand Order', tags: ['表达','热情','自主'], profile: [69,42,64,99,27,79], color: '#cd9790', element: '玫瑰与金焰', crest: 'sword',
    summary: '你愿意认真喜欢一件事，也愿意把热情表达出来。比起隐藏自己的偏好，你更希望生活能带着属于自己的鲜明痕迹。',
    compatibility: '你们的合作可能充满活力与创意。尽情表达的同时，也给对方留下回应与不同意的空间，热情才会成为双向的连接。',
    quote: '让所爱之事拥有位置，也让世界看见你的心意。', ritual: '以不愿掩藏的热爱，照亮赤色舞台。',
    origin: origin('历史人物','公元37—68年','罗马帝国','尼禄是公元54至68年在位的罗马皇帝。其统治涉及宫廷政治、艺术活动与严重冲突，传世叙述也受到古代作者立场影响。广为流传的轶闻需要结合材料判断，不宜把戏剧化形象直接当成完整、无争议的历史评价。','历史上的尼禄为男性；Fate的女性Saber形象、性格侧重与宝具均为改编。','Encyclopaedia Britannica · Nero','https://www.britannica.com/biography/Nero-Roman-emperor'),
  }),
  servant({ id: 'waver', name: '诸葛孔明〔埃尔梅罗Ⅱ世〕', en: 'Zhuge Liang · El-Melloi II', class: 'Caster', title: '让每一步彼此衔接', work: 'Fate/Grand Order', tags: ['规划','协作','务实'], profile: [47,99,76,15,76,56], color: '#9db2a3', element: '棋局与青焰', crest: 'staff',
    summary: '你重视准备、信息与有效分工。相比独自完成漂亮的一击，你更在乎整个计划能不能稳稳地运转。',
    compatibility: '清楚的沟通与分工会让你们十分合拍。也别让所有细节都变成必须独自承担的工作，把休息同样写进计划。',
    quote: '先把能确认的条件摆好，再为变化留下位置。', ritual: '以环环相扣的判断，落下新的棋子。',
    origin: origin('复合原型','诸葛亮：公元181—234年；容器为作品原创','中国三国时期与Fate架空世界','诸葛亮是三国时期蜀汉的重要政治与军事人物，后世小说《三国演义》又发展了鲜明的军师形象。历史记载与文学演义需要分别阅读。本灵基同时关联Fate原创人物埃尔梅罗Ⅱ世，因此不能把屏幕上的形象直接视为历史诸葛亮。','Fate采用拟似从者设定，将诸葛亮之名与埃尔梅罗Ⅱ世结合；这不是三国史实。','Encyclopaedia Britannica · Zhuge Liang','https://www.britannica.com/biography/Zhuge-Liang'),
  }),
  servant({ id: 'enkidu', name: '恩奇都', en: 'Enkidu', class: 'Lancer', title: '在自由与联结之间', work: 'Fate/strange Fake · Fate/Grand Order', tags: ['自然','羁绊','平静'], profile: [76,61,95,13,18,73], color: '#a4bfa7', element: '绿野与星锁', crest: 'chain',
    summary: '你珍惜不被过度定义的自由，也愿意与真正理解的人建立深厚联系。安静和亲近，对你而言并不矛盾。',
    compatibility: '你们适合以平等的方式讨论愿望和边界。不要急着替对方决定意义，让共同经历自然长成属于自己的关系。',
    quote: '不必先成为别人期待的模样，我们可以从此刻相识。', ritual: '以自由之中仍愿建立的联结，唤起天之锁。',
    origin: origin('神话人物','古代美索不达米亚史诗传统','美索不达米亚','恩奇都是吉尔伽美什史诗传统中的重要人物，与荒野、文明和友谊的主题相连。他与吉尔伽美什的关系推动了史诗对死亡和人生意义的追问。其起源及经历属于古代文学与神话，不能作为一位历史人物的生平记录。','Fate根据史诗重新塑造外观、身体性质与天之锁能力，具体设定属于作品。','Encyclopaedia Britannica · Enkidu','https://www.britannica.com/topic/Enkidu'),
  }),
  servant({ id: 'dantes', name: '岩窟王', en: 'Edmond Dantès', class: 'Avenger', title: '穿过长夜仍不屈服', work: 'Fate/Grand Order', tags: ['独立','意志','审视'], profile: [62,89,27,63,12,94], color: '#a49ac1', element: '黑焰与星火', crest: 'dagger',
    summary: '你不愿让外界轻易替自己写下结局。即使经历过失望，也希望保留判断与行动的主动权。',
    compatibility: '你们容易理解彼此对自由的坚持，也需要提醒对方，未来可以大于过去。让目标指向想抵达的生活，而非只停留在不愿接受的事情上。',
    quote: '长夜并不拥有你的结局。把下一步重新握在手中。', ritual: '以仍未熄灭的意志，照亮牢笼之外。',
    origin: origin('文学人物','19世纪法国小说','大仲马《基督山伯爵》的虚构世界','爱德蒙·唐泰斯是大仲马小说《基督山伯爵》的主人公，经历冤狱后以新的身份归来。小说讨论复仇、正义与报偿的边界；人物并不是一位可考的历史伯爵。作品借用了真实时代背景，但主要情节与人物属于文学创作。','Fate将文学主人公改编为Avenger，其黑焰、战斗能力和英灵经历不在原小说中。','Project Gutenberg · The Count of Monte Cristo','https://www.gutenberg.org/ebooks/1184'),
  }),
  servant({ id: 'oberon', name: '奥伯龙', en: 'Oberon', class: 'Pretender', title: '在故事边缘保留疑问', work: 'Fate/Grand Order', tags: ['洞察','游离','自由'], profile: [35,94,19,77,6,48], color: '#a7a2c7', element: '暮色与蝶翅', crest: 'crown',
    summary: '你会留意表面叙述之外的裂隙，不急于接受所有人默认的答案。比起被一种身份概括，你更希望保留解释自己的权利。',
    compatibility: '你们需要容纳复杂，却也不能让一切都停留在猜测。清楚说出自己的边界，并用行动检验信任，会比试图彻底看透彼此更有意义。',
    quote: '故事可以有许多面，但你的选择仍属于你自己。', ritual: '以尚未说尽的疑问，叩开薄暮的舞台。',
    origin: origin('文学人物','中世纪妖精文学与莎士比亚戏剧','欧洲文学传统','奥伯龙在欧洲文学中是一位妖精王，莎士比亚《仲夏夜之梦》中的形象尤其著名。他与泰坦妮娅及森林中众人的纠葛属于戏剧叙事，而非历史记录。不同作品中的同名人物并不完全一致，了解其来源需要注意具体文本与时代。','Fate的奥伯龙融合了独立的世界观设定；本页不展开涉及主线的真实身份内容。','Folger Shakespeare Library · A Midsummer Night’s Dream','https://www.folger.edu/explore/shakespeares-works/a-midsummer-nights-dream/read/2/1/'),
  }),
  servant({ id: 'tamamo', name: '玉藻前', en: 'Tamamo-no-Mae', class: 'Caster', title: '把珍重之人放在心上', work: 'Fate/EXTRA · Fate/Grand Order', tags: ['亲近','敏锐','自在'], profile: [63,78,96,76,22,65], color: '#cfaaad', element: '狐火与花影', crest: 'staff',
    summary: '你留意关系里的温度，也愿意主动创造让人舒适的日常。聪明与热情对你来说，可以用来好好照顾在意的人。',
    compatibility: '你们能在细节中建立鲜明的默契。也别忘记把自己的需要说清楚，让亲近建立在双方都能自在选择的基础上。',
    quote: '让约定落在每一个平常日子里，心意就会有自己的形状。', ritual: '以愿意认真经营的羁绊，燃起温柔狐火。',
    origin: origin('传说人物','日本中世传说与绘卷传统','日本','玉藻前是日本妖狐传说中的人物。京都大学所藏《たま藻のまへ》叙述宫廷女子被识破为狐狸、逃往那须野的故事。这类绘卷和故事书反映了传说的流传形态，不是宫廷事件的实录，也不能用来证明超自然情节真实发生。','Fate重新塑造了她的神话关联、性格和Caster身份，并发展了独立故事。','京都大学贵重资料数字档案 · たま藻のまへ','https://rmda.kulib.kyoto-u.ac.jp/en/item/rb00013524'),
  }),
  servant({ id: 'musashi', name: '宫本武藏', en: 'Miyamoto Musashi', class: 'Saber', title: '在下一步看见新境界', work: 'Fate/Grand Order', tags: ['自由','直觉','精进'], profile: [67,28,43,72,11,95], color: '#b1bdd0', element: '流水与刀光', crest: 'katana',
    summary: '你愿意亲自走进新的局面，从实际感受中寻找答案。未知对你不只是风险，也是重新认识自己能力的机会。',
    compatibility: '你们适合给彼此足够宽阔的行动空间，也要约定好何时汇合、何时求助。自由有了相互照应，会成为更长久的旅途。',
    quote: '走到下一处风景，再看看自己能挥出怎样的一刀。', ritual: '以不愿停止的探索，踏上剑之旅路。',
    origin: origin('历史人物','约1584—1645年','日本','宫本武藏是日本近世剑术家，与二天一流和《五轮书》密切相关。他也从事书画创作。其生平的通行叙述混合了记录与后世剑豪故事，具体决斗情节仍需分辨材料来源，不能把所有戏剧性桥段都当作同时代史料。','历史上的宫本武藏为男性；本测试采用FGO的女性Saber版本，其身份和经历为改编。','Encyclopaedia Britannica · Miyamoto Musashi','https://www.britannica.com/biography/Miyamoto-Musashi'),
  }),
  servant({ id: 'holmes', name: '夏洛克·福尔摩斯', en: 'Sherlock Holmes', class: 'Ruler', title: '让细节重新排列答案', work: 'Fate/Grand Order', tags: ['推理','独立','观察'], profile: [31,99,27,49,47,55], color: '#b2bca8', element: '烟雾与棱镜', crest: 'staff',
    summary: '你会主动追问事情为何如此，善于在零散信息之间寻找关联。独立思考往往比一个方便的现成答案更令你安心。',
    compatibility: '你们容易享受共同拆解难题的过程。也要记得，理解事实与理解人的感受并不总是同一件事，关系同样需要直接的交流。',
    quote: '先看见被忽略的细节，再决定该相信哪一个答案。', ritual: '以仍未得到解释的线索，聚拢推理之光。',
    origin: origin('文学人物','19世纪末至20世纪初英国侦探小说','英国文学的虚构伦敦','夏洛克·福尔摩斯由阿瑟·柯南·道尔创作，首次登场于1887年的《血字的研究》。他以观察和推理著称，与华生共同构成侦探文学的重要搭档。故事采用真实地点与时代背景，但人物和多数案件属于小说创作。','Fate将文学侦探改编为Ruler；宝具、职阶和作品内的独立身份不属于原作事实。','Encyclopaedia Britannica · Sherlock Holmes','https://www.britannica.com/topic/Sherlock-Holmes'),
  }),
];

const matchAnswers = createAffinityMatcher(QUESTIONS, SERVANTS);

/**
 * Weighted, deterministic profile matching for an entertainment questionnaire.
 * Neutral cultural responses are omitted from both weighted totals and each
 * axis's attainable range. They are not evidence for a middle/low personality.
 * Value choices use their declared weights. Behavioral preferences and the
 * concrete wish contribute separately; aesthetic choices do not affect affinity.
 * A resonance index measures calibrated direction distance, not probability.
 * @param {number[]} answers One valid option index for each question in the bank.
 */
export function calculateResult(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length ||
      !Array.from({ length: QUESTIONS.length }, (_, i) => i).every(i =>
        Number.isInteger(answers[i]) && answers[i] >= 0 && answers[i] < QUESTIONS[i].options.length)) {
    throw new TypeError(`请完成全部 ${QUESTIONS.length} 道题，每题选择一个有效选项。`);
  }

  const answered = QUESTIONS.map((q, i) => ({ q, i, answerIndex: answers[i], selected: q.options[answers[i]] }));
  const active = answered.filter(({ selected }) => selected.neutral !== true);
  const totals = AXES.map((_, axis) => active.reduce((sum, { q, selected }) =>
    sum + selected.scores[axis] * q.weight, 0));
  const ranges = AXES.map((_, axis) => active.reduce((range, { q }) => {
    const choices = q.options.filter(o => o.neutral !== true).map(o => o.scores[axis]);
    range.min += Math.min(...choices) * q.weight;
    range.max += Math.max(...choices) * q.weight;
    return range;
  }, { min: 0, max: 0 }));
  const scores = AXES.map((_, axis) => {
    const { min, max } = ranges[axis];
    if (max === min) return 50;
    return Math.max(0, Math.min(100, Math.round(100 * (totals[axis] - min) / (max - min))));
  });
  const { ranked, weakSignal } = matchAnswers(answers);

  const behavior = analyzeBehavior(QUESTIONS, answers);
  const behavioral = rankBehavior(behavior, SERVANTS);
  const behaviorWeight = 0.25 * behavioral.coverage;
  const wishQuestionIndex = QUESTIONS.findIndex(q => q.category === 'wish');
  const wishPriority = QUESTIONS[wishQuestionIndex]?.options[answers[wishQuestionIndex]]?.wishPriority;
  const wishWeight = wishPriority ? 0.10 : 0;
  const blended = ranked.map(item => {
    const semanticSimilarity = 1 - 2 * item.distance ** 2;
    const behaviorSimilarity = behavioral.ranked.find(row => row.id === item.servant.id)?.similarity || 0;
    const traitSimilarity = (1 - behaviorWeight) * semanticSimilarity + behaviorWeight * behaviorSimilarity;
    const similarity = (1 - wishWeight) * traitSimilarity + wishWeight * wishAffinity(item.servant.id, wishPriority);
    return { ...item, distance: Math.sqrt(Math.max(0, 2 - 2 * similarity)) / 2 };
  }).sort((a,b) => a.distance - b.distance || a.servant.id.localeCompare(b.servant.id, 'en'));
  const matched = blended[0].servant;
  const explanation = buildMatchExplanation(QUESTIONS, answers, { best: matched, scores, behavior }, AXES);
  return {
    modelVersion: MATCHING_VERSION,
    weakSignal,
    scores,
    behavior,
    behaviorWeight,
    wishPriority,
    wishWeight,
    wishAffinityNote: wishAffinity(matched.id, wishPriority) > 0
      ? `这次愿望优先考虑${WISH_PRIORITIES[wishPriority]}，与本作对${matched.name}愿望侧面的解读有呼应。它只占匹配的一小部分，不代表整个人格。`
      : `你这次优先考虑${WISH_PRIORITIES[wishPriority]}；这与本作对${matched.name}愿望侧面的解读不完全相同，保留这份差异。`,
    best: matched,
    runnersUp: blended.slice(1, 3).map(item => item.servant),
    resonance: Math.max(0, Math.min(100, Math.round(100 * (1 - blended[0].distance)))),
    nearTie: blended.length > 1 && blended[1].distance - blended[0].distance < 0.01,
    matchGap: blended.length > 1 ? Math.round((blended[1].distance - blended[0].distance) * 1000) / 10 : null,
    ...explanation,
  };
}
