import { AXES, STAGES, QUESTIONS, SERVANTS, SOURCES, STORAGE_KEY, calculateResult } from './data.js';
import { ritualSVG, crestSVG, classIcon } from './art.js';
import { commandSealSVG, servantCardBackSVG, catalystSVG, playSummoningChime } from './fate-art.js';
import { PORTRAITS } from './portraits.js';
import { generateMasterCode } from './master-code.js';
import { buildAnswerReading } from './reading.js';

const $ = (selector, root = document) => root.querySelector(selector);
const main = $('#main');
const modal = $('#modal');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeURL = value => { try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? esc(url.href) : '#'; } catch { return '#'; } };
const roman = ['I', 'II', 'III', 'IV'];
const classes = [...new Set(SERVANTS.map(s => s.class))];
function cleanMasterName(value) {
  return Array.from(typeof value === 'string' ? value.trim() : '').slice(0, 20).join('').trim();
}
let state = readState();
let view = 'home';
let result = null;
let archiveState = { query: '', origin: '', className: '' };
let modalReturnFocus = null;
let modalEpoch = 0;
let ritualTimer;
let toastTimer;
let shareObjectURL;
let resultTab = 'fate';
let stopChime = null;
let soundEnabled = false;
let ritualTimers = [];
let currentPreview = 'Saber';
let quizEpoch = 0;
let viewEpoch = 0;
let quizBusy = false;
let renderedQuestionIndex = -1;
let renderedStageIndex = -1;
let quizMeasuredWidth = 0;
let finishChapter = null;
let ritualPhase = 'idle';
let ritualReady = Promise.resolve();
let cancelRitualWait = null;
const activeMotions = new Set();
const viewSnapshots = new Set();
const decodedPortraits = new Map();
const PREVIEW_IDS={Saber:'artoria',Archer:'emiya',Lancer:'cu',Rider:'medusa',Caster:'medea',Assassin:'kojiro',Berserker:'heracles'};
const CATEGORY_LABELS={daily:'日常选择',personality:'日常性格',cooperation:'合作与相处',relationships:'人与人的关系',relationship:'人与人的关系',history:'历史视角',values:'在意的事情',value:'在意的事情',culture:'阅读与审美'};
const motionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;


function portraitImage(servantOrId, className='', extra='') {
  const id=typeof servantOrId==='string'?servantOrId:servantOrId.id;
  const servant=SERVANTS.find(item=>item.id===id);
  const picture=PORTRAITS[id];
  return picture ? `<img class="${esc(className)}" src="${picture.src}" alt="${esc(servant?.name||id)}的FGO初始灵基卡面" decoding="async" ${extra}>` : crestSVG(servant?.crest||'sword','relic');
}
function rarityStars(s) { return '★'.repeat(Math.max(1,Math.min(5,s.game?.rarity||1))); }
function previewCardContent(id) {
  const s=SERVANTS.find(s=>s.id===id)||SERVANTS[0];
  return `${portraitImage(s)}<span class="preview-card-class">${classIcon(s.class)}</span><div class="preview-card-caption"><small>${esc(s.class.toUpperCase())}</small><strong>${esc(s.name)}</strong></div>`;
}
function previewClass(className) {
  const id=PREVIEW_IDS[className];if(!id||!$('#hero-main-card'))return;
  currentPreview=className;
  $('#hero-main-card').innerHTML=previewCardContent(id);
  const sideIds=['artoria','emiya','cu','medusa'].filter(value=>value!==id);
  $('#hero-left-card').innerHTML=previewCardContent(sideIds[0]);$('#hero-right-card').innerHTML=previewCardContent(sideIds[1]);
  document.querySelectorAll('[data-action="hero-class"]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.class===className)));
}
function masterHUD() {
  const count=state.answers.filter(a=>a!==null).length;
  const progress=Math.round(100*count/QUESTIONS.length);
  const identity=generateMasterCode(state.name);
  return `<div class="master-hud">${commandSealSVG('seal')}<div class="master-hud-name"><small>MASTER CODE · ${esc(identity.language)}</small><strong class="master-hud-code" lang="${esc(identity.languageTag)}">${esc(identity.code)}</strong><span class="master-hud-alias">登记名 · ${esc(state.name||'旅人')}</span></div><div class="sync-meter">答题进度 <span id="sync-value">${progress}</span>%<div class="sync-track"><span id="sync-bar" style="width:${progress}%"></span></div></div></div>`;
}

function masterCodePreviewHTML(name) {
  const identity=generateMasterCode(cleanMasterName(name));
  return `<span class="master-code-label">你的御主代号 <small>${esc(identity.language)}</small></span><strong class="master-code-value" lang="${esc(identity.languageTag)}">${esc(identity.code)}</strong><span class="master-code-meaning">${esc(identity.meaning)}</span>`;
}

function resultMasterCodeHTML() {
  const identity=generateMasterCode(state.name);
  return `<div class="result-master-identity"><span>MASTER CODE · ${esc(identity.language)}</span><strong class="result-master-code" lang="${esc(identity.languageTag)}">${esc(identity.code)}</strong><p>${esc(identity.meaning)}<span>登记名 · ${esc(state.name||'旅人')}</span></p></div>`;
}

function gameProfile(s) {
  const g=s.game||{};const card=['Buster','Arts','Quick'].includes(g.card)?g.card:'Arts';
  const color={Buster:'var(--buster)',Arts:'var(--arts)',Quick:'var(--quick)'}[card];
  return `<div class="np-block"><div class="np-command-card" style="--command-color:${color}" aria-label="${card}宝具"><strong>${card[0]}</strong><span>${card}</span><small>NOBLE PHANTASM</small></div><div class="np-name"><small>宝具 / NOBLE PHANTASM</small><h3>${esc(g.npName||'灵基资料待记录')}</h3>${g.npSubtitle?`<p class="np-subtitle">${esc(g.npSubtitle)}</p>`:''}<span class="np-target">${esc(g.npType||'宝具')} · FGO 初始展示版本</span></div></div><div class="active-skill"><span class="skill-icon" aria-hidden="true">✦</span><p><small>代表技能</small>${esc(g.skillName||'职阶技能')}</p></div>${g.fieldNote?`<p class="fate-lore-note">${esc(g.fieldNote)}</p>`:''}`;
}
function artCredit(s) {
  const p=PORTRAITS[s.id];
  return p?`<p class="image-credit">角色立绘 © TYPE-MOON / FGO PROJECT · 素材经 <a href="${safeURL(p.sourceUrl)}" target="_blank" rel="noopener noreferrer">Atlas Academy 公开资源</a>整理；宝具与技能名据 FGO 游戏资料。相性解读为本作原创。</p>`:'';
}

function openGlossary() {
  openModal(`<p class="eyebrow">A SMALL REMINDER</p><h2>选择，然后继续。</h2><p>选定答案后，点击“继续”；想修改时可以返回上一题。<br>数字键只选择答案。用 Tab 聚焦“继续”后，可按 Enter 确认。</p>`);
}

function toggleSound() {
  soundEnabled=!soundEnabled;
  const button=$('#sound-toggle');button.setAttribute('aria-pressed',String(soundEnabled));button.setAttribute('aria-label',soundEnabled?'关闭原创召唤音效':'开启原创召唤音效');button.querySelector('span').textContent=soundEnabled?'音效开':'音效关';
  if(soundEnabled)stopChime=playSummoningChime();else if(stopChime){stopChime();stopChime=null;}
}

function freshState() { return { version: 1, name: '', answers: Array(QUESTIONS.length).fill(null), index: 0, completed: false }; }
function readState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored || stored.version !== 1 || !Array.isArray(stored.answers) || stored.answers.length !== QUESTIONS.length) return freshState();
    const answers = stored.answers.map((answer, index) => Number.isInteger(answer) && answer >= 0 && answer < QUESTIONS[index].options.length ? answer : null);
    return { version:1, name: cleanMasterName(stored.name), answers, index: Math.max(0,Math.min(QUESTIONS.length - 1,Number.isInteger(stored.index) ? stored.index : 0)), completed: Boolean(stored.completed && answers.every(a => a !== null)) };
  } catch { return freshState(); }
}
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* The test remains usable when browser storage is unavailable. */ } }
function notify(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 3200); }
function runMotion(element, keyframes, options = {}) {
  if (!element || motionReduced() || typeof element.animate !== 'function') return Promise.resolve();
  const animation = element.animate(keyframes, { duration: 170, easing: 'cubic-bezier(.2,.65,.25,1)', ...options });
  activeMotions.add(animation);
  return animation.finished.catch(() => {}).finally(() => activeMotions.delete(animation));
}
function clearSceneWork() {
  ++quizEpoch;
  quizBusy = false;
  if (finishChapter) finishChapter(false);
  if (cancelRitualWait) cancelRitualWait(false);
  clearTimeout(ritualTimer);
  ritualTimers.forEach(clearTimeout); ritualTimers = [];
  activeMotions.forEach(animation => animation.cancel()); activeMotions.clear();
  viewSnapshots.forEach(snapshot => snapshot.remove()); viewSnapshots.clear();
}
function leaveViewSnapshot(previous) {
  if (!previous || motionReduced() || !previous.attachShadow || document.visibilityState === 'hidden') return;
  const rect = previous.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  // Shadow DOM isolates outgoing IDs, actions, and selectors from the live view.
  // The previous nodes keep their already-decoded images for this brief overlap.
  const snapshot = document.createElement('div');
  snapshot.className = 'view-snapshot';
  snapshot.inert = true;
  snapshot.setAttribute('aria-hidden', 'true');
  Object.assign(snapshot.style, { position: 'fixed', pointerEvents: 'none', zIndex: '4',
    top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`, overflow: 'hidden' });
  const shadow = snapshot.attachShadow({ mode: 'closed' });
  const styles = document.createElement('style');
  styles.textContent = [...document.querySelectorAll('style')].map(style => style.textContent).join('\n') +
    '\n:host{display:block;pointer-events:none!important}.motion-view{animation:none!important}*{pointer-events:none!important;animation-play-state:paused!important}';
  shadow.append(styles, previous);
  document.body.append(snapshot);
  viewSnapshots.add(snapshot);
  runMotion(snapshot, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5px)' }], { duration: 150 })
    .finally(() => { snapshot.remove(); viewSnapshots.delete(snapshot); });
}
function setView(name, html, focus = true) {
  const previousView = view;
  clearSceneWork();
  ++viewEpoch;
  // Let the last, quiet tail of a completed reveal resolve beneath its result.
  if (stopChime && !(previousView === 'ritual' && name === 'result')) { stopChime(); stopChime = null; }
  leaveViewSnapshot(main.firstElementChild);
  view = name;
  const incoming = document.createElement('div');
  incoming.className = `motion-view motion-view-${name}`;
  incoming.dataset.view = name;
  incoming.innerHTML = html;
  main.replaceChildren(incoming);
  document.querySelectorAll('[data-action="home"]').forEach(el => el.classList.toggle('active', name === 'home'));
  document.querySelectorAll('[data-action="archive"]').forEach(el => el.classList.toggle('active', name === 'archive'));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) main.focus({ preventScroll: true });
  runMotion(incoming, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 190 });
}
function openModal(html) {
  ++modalEpoch;
  modalReturnFocus = document.activeElement;
  $('#modal-content').innerHTML = `<div class="modal-inner"><button class="modal-close" data-action="close" aria-label="关闭弹窗">×</button>${html}</div>`;
  if (!modal.open) modal.showModal();
}
function closeModal() {
  modal.close();
  if (shareObjectURL) { URL.revokeObjectURL(shareObjectURL); shareObjectURL = null; }
}
modal.addEventListener('close', () => { if (shareObjectURL) { URL.revokeObjectURL(shareObjectURL); shareObjectURL = null; } if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true }); });
modal.addEventListener('click', event => { if (event.target === modal) { const r = modal.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeModal(); } });

function renderHome(focus = true) {
  const hasProgress=state.answers.some(a=>a!==null)&&!state.completed;
  setView('home', `<section class="hero" aria-labelledby="hero-title"><div class="hero-body"><div class="hero-copy"><p class="hero-record">MASTER APTITUDE TEST <span>/</span> 御主适性观测</p><p class="eyebrow">FATE / THE SUMMONING RITUAL</p><h1 id="hero-title">你最可能召唤<br>哪一位<em>英灵</em>？</h1><p class="hero-description">从一次告别，走到军旗之下，再回望漫天星辰。<br>在抉择与愿望之间，寻找回应你的<strong>英灵</strong>。</p><div class="world-links" aria-label="收录作品"><button class="world-link" data-action="work" data-work="Fate/stay night">Fate/stay night</button><button class="world-link" data-action="work" data-work="Fate/Zero">Fate/Zero</button><button class="world-link" data-action="work" data-work="Fate/Grand Order">Fate/Grand Order</button></div><div class="hero-actions"><button class="primary" data-action="${hasProgress?'resume':'setup'}">${hasProgress?'继续上次测试':'开始召唤'}<span class="arrow" aria-hidden="true">↗</span></button>${state.completed?'<button class="text-button" data-action="last-result">打开灵基记录 →</button>':hasProgress?'<button class="text-button" data-action="setup">重新登记</button>':'<button class="text-button" data-action="archive">浏览灵基图鉴 →</button>'}</div><div class="hero-meta"><span>${QUESTIONS.length} 次选择</span><span>${SERVANTS.length} 骑从者</span><span>约 8 分钟</span></div></div><div class="hero-visual" aria-hidden="true">${ritualSVG('home','ritual-art')}<div class="hero-deck"><div id="hero-left-card" class="preview-card preview-card-left">${previewCardContent('emiya')}</div><div id="hero-main-card" class="preview-card preview-card-main">${previewCardContent(PREVIEW_IDS[currentPreview])}</div><div id="hero-right-card" class="preview-card preview-card-right">${previewCardContent('cu')}</div></div><div class="hero-seal">${commandSealSVG()}</div><span class="hero-axis">SERVANT SUMMONING · FGO INITIAL SPIRIT ORIGIN</span></div><span class="hero-folio">THRONE OF HEROES / CONTRACT SYSTEM</span></div><div class="hero-foot"><div class="class-line" aria-label="预览七种经典职阶，不影响测试结果">${Object.keys(PREVIEW_IDS).map(c=>`<button class="class-choice" data-action="hero-class" data-class="${c}" aria-pressed="${currentPreview===c}" aria-label="预览${c}职阶">${classIcon(c)}<span>${c}</span></button>`).join('')}</div><p>先看一眼英灵的身影。<br>最后一个选择之后，揭晓回应你的那一位。</p></div></section><section class="history-intro" aria-labelledby="history-title"><div><p class="eyebrow">FATE MEETS HISTORY</p><h2 id="history-title">从你的选择，<br>遇见历史与传说。</h2></div><div><p>你会为怎样的统治辩护，如何对待相爱的人，又怎样看待命运？完成 ${QUESTIONS.length} 次选择，认识与你共鸣的英灵，再沿着这个名字走进历史、神话或文学。</p><div class="history-pills"><span class="pill">Fate 灵基资料</span><span class="pill">历史与神话原型</span><span class="pill">改编差异</span></div><button class="text-button" data-action="history-archive" style="margin-top:20px">打开历史人物档案 →</button></div></section>`,focus);
}


function openSetup() {
  openModal(`<p class="eyebrow">A NAME FOR THE CONTRACT</p><h2>留下你的名字。</h2><form id="setup-form" class="setup-form setup-form-quiet"><label class="visually-hidden" for="master-name">你的名字，选填</label><input id="master-name" class="name-input" name="master" maxlength="20" autocomplete="nickname" placeholder="名字，或一个昵称" value="${esc(state.name)}"><div id="master-code-preview" class="master-code-preview" aria-live="polite" aria-atomic="true">${masterCodePreviewHTML(state.name)}</div>${state.answers.some(a=>a!==null)?'<p class="small-note">开始后，将替换上次测试的进度。</p>':''}<button class="primary" type="submit">开始召唤 <span class="arrow" aria-hidden="true">→</span></button></form>`);
  const nameInput=$('#master-name');
  const updateIdentity=()=>{$('#master-code-preview').innerHTML=masterCodePreviewHTML(nameInput.value);};
  nameInput.addEventListener('input',event=>{if(!event.isComposing)updateIdentity();});
  nameInput.addEventListener('compositionend',updateIdentity);
  $('#setup-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = cleanMasterName($('#master-name').value);
    state = freshState(); state.name = name || '旅人'; result = null;
    persist(); closeModal(); renderQuiz();
  });
}

function stageFor(index) {
  const q = QUESTIONS[index];
  const found = typeof q.stage === 'number' ? q.stage : STAGES.findIndex(stage => stage.id === q.stage);
  const stageIndex = found >= 0 && found < STAGES.length ? found : 0;
  return { stageIndex, stage: STAGES[stageIndex] };
}
function questionPanelHTML(index) {
  const q = QUESTIONS[index], selected = state.answers[index];
  const { stage } = stageFor(index);
  const background = q.sourceUrl ? `<p class="question-source"><a href="${safeURL(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(q.sourceLabel)} ↗</a><span>${esc(q.backgroundType)}</span></p>` : '';
  const role=questionRoleHTML(q);
  const response=q.type==='scale'?scaleResponseHTML(q,selected):`<div class="options" role="group" aria-label="选择你的回应">${q.options.map((option, i) => `<button class="option ${selected === i ? 'selected' : ''} ${option.neutral ? 'option-neutral' : ''}" data-action="answer" data-index="${i}" aria-pressed="${selected === i}"><span class="option-letter" aria-hidden="true">${String.fromCharCode(65 + i)}</span><span><strong>${esc(/^[A-Z]$/.test(option.label) ? option.text : option.label)}</strong>${option.text && !/^[A-Z]$/.test(option.label) ? `<small>${esc(option.text)}</small>` : ''}${option.neutral ? '<small>这题不计分</small>' : ''}</span><span class="option-check" aria-hidden="true"></span></button>`).join('')}</div>`;
  return `<div class="question-body question-panel ${q.type==='scale'?'question-panel-scale':''}" data-question-index="${index}" aria-busy="false"><div class="question-heading"><span class="question-shell-tag">${esc(q.topic || q.categoryLabel || CATEGORY_LABELS[q.category] || '你的选择')}</span><p class="stage-label">${esc(stage.en || '')} · ${String(index + 1).padStart(2, '0')}</p>${role}<h1 class="question-title" id="question-title" tabindex="-1">${esc(q.statement||q.title)}</h1>${q.context ? `<p class="question-context">${esc(q.context)}</p>` : ''}${background}</div>${response}</div>`;
}

function questionRoleHTML(q) {
  if(q.type==='scale')return '';
  return q.role?`<div class="question-role"><span>你的身份</span><strong>${esc(q.role)}</strong>${q.authority?`<p>${esc(q.authority)}</p>`:''}</div>`:'';
}

function scaleResponseHTML(q,selected) {
  return `<div class="options scale-options"><div class="agreement-scale" role="radiogroup" aria-label="这句话有多像你？">${q.options.map((option,i)=>`<button type="button" class="option scale-option ${selected===i?'selected':''}" role="radio" aria-checked="${selected===i}" aria-label="${i+1}，${esc(option.text)}" tabindex="${i===(selected??0)?0:-1}" data-action="answer" data-index="${i}" style="--dot-size:${[34,28,22,18,22,28,34][i]||24}px"><span class="scale-dot" aria-hidden="true"></span><span class="scale-value" aria-hidden="true">${i+1}</span></button>`).join('')}</div><div class="scale-endpoints" aria-hidden="true"><span>${esc(q.options[0].text)}</span><span>${esc(q.options[q.options.length-1].text)}</span></div><p class="scale-current" aria-live="polite">${selected===null?'尚未选择':`已选择：${esc(q.options[selected].text)}`}</p></div>`;
}
function quizShellHTML() {
  return `<section class="shell quiz-shell" id="quiz-shell" aria-labelledby="question-title"><div class="quiz-top"><button class="quiet-button" data-action="save-exit">← 暂存并返回</button><span id="quiz-count"></span></div>${masterHUD()}<div class="stage-track" role="progressbar" aria-label="答题进度" aria-valuemin="0" aria-valuemax="${QUESTIONS.length}" aria-valuenow="0">${QUESTIONS.map((_, index) => `<span class="stage-progress" data-step="${index}"></span>`).join('')}</div><div class="question-grid"><aside class="question-aside" id="quiz-aside"></aside><div class="question-column"><div class="question-slot" id="quiz-question-slot" aria-busy="false">${questionPanelHTML(state.index)}</div><div class="quiz-bottom"><button class="quiet-button" data-action="previous">← 上一个选择</button><button id="next-question" class="primary" data-action="next">继续 <span class="arrow" aria-hidden="true">→</span></button></div><div class="question-tools"><span class="question-help" id="quiz-answer-state">选定答案后，点击“继续”</span><button class="glossary-button" data-action="glossary">操作提示 ⓘ</button></div><span class="visually-hidden" id="quiz-announcer" role="status" aria-live="polite"></span></div></div></section>`;
}
function updateQuizChrome() {
  if (view !== 'quiz' || !$('#quiz-shell')) return;
  const { stageIndex, stage } = stageFor(state.index);
  const role = QUESTIONS[state.index].role || stage.role;
  const count = state.answers.filter(answer => answer !== null).length;
  const progress = Math.round(100 * count / QUESTIONS.length);
  const counter = $('#quiz-count');
  counter.textContent = `${String(state.index + 1).padStart(2, '0')} — ${QUESTIONS.length}`;
  counter.setAttribute('aria-label', `第 ${state.index + 1} 个选择，共 ${QUESTIONS.length} 个`);
  $('#sync-value').textContent = String(progress);
  $('#sync-bar').style.width = `${progress}%`;
  $('.stage-track').setAttribute('aria-valuenow', String(count));
  document.querySelectorAll('#quiz-shell .stage-progress').forEach((step, index) => {
    step.classList.toggle('done', state.answers[index] !== null);
    step.classList.toggle('current', index === state.index);
  });
  if (renderedStageIndex !== stageIndex) {
    $('#quiz-aside').innerHTML = `<div class="stage-number">${roman[stageIndex] || stageIndex + 1}</div><div><h2>${esc(stage.title)}</h2><p class="stage-description">${esc(stage.en || '')}</p><p class="stage-role"><span>此刻的你</span><strong>${esc(stage.role || '')}</strong></p><p>${esc(stage.description || '')}</p></div>${crestSVG(['book', 'flag', 'flower', 'chalice'][stageIndex] || 'book', 'aside-emblem')}`;
    $('#quiz-aside').dataset.stage = String(stageIndex);
    renderedStageIndex = stageIndex;
  }
  $('#quiz-aside .stage-role strong').textContent = role;
  $('[data-action="previous"]', $('#quiz-shell')).disabled = quizBusy || state.index === 0;
  const next = $('#next-question');
  const nextLabel = state.index === QUESTIONS.length - 1 ? '回应召唤' : '继续';
  next.disabled = quizBusy || state.answers[state.index] === null;
  next.innerHTML = `${nextLabel} <span class="arrow" aria-hidden="true">→</span>`;
  $('#quiz-answer-state').textContent = state.answers[state.index] === null ? `选定答案后，点击“${nextLabel}”` : `已记下，点击“${nextLabel}”确认`;
}
function measureQuizLayout(force = false) {
  const slot = $('#quiz-question-slot');
  if (view !== 'quiz' || !slot) return;
  if (window.matchMedia('(max-width: 760px)').matches) {
    slot.style.minHeight = '';
    quizMeasuredWidth = 0;
    return;
  }
  const width = Math.round(slot.getBoundingClientRect().width);
  if (!width || (!force && width === quizMeasuredWidth)) return;
  quizMeasuredWidth = width;
  const probe = document.createElement('div');
  probe.className = 'question-measure'; probe.inert = true;
  probe.setAttribute('aria-hidden', 'true'); probe.style.width = `${width}px`;
  slot.append(probe);
  let tallest = 0;
  // Measure once at the actual responsive width, so a fifth option or a longer
  // sentence never throws the stable controls up or down between questions.
  QUESTIONS.forEach((_, index) => {
    probe.innerHTML = questionPanelHTML(index).replace('id="question-title"', '');
    tallest = Math.max(tallest, probe.firstElementChild.getBoundingClientRect().height);
  });
  probe.remove();
  slot.style.minHeight = `${Math.ceil(tallest)}px`;
}
function showChapter(stage, stageIndex, slot, epoch) {
  if (motionReduced()) return Promise.resolve(true);
  const chapter = document.createElement('div');
  chapter.className = 'quiz-chapter';
  chapter.innerHTML = `<span class="chapter-number" aria-hidden="true">${roman[stageIndex] || stageIndex + 1}</span><p class="eyebrow">${esc(stage.en || '')}</p><h2>${esc(stage.title)}</h2><p class="chapter-role">${esc(stage.role || '')}</p><button class="text-button" data-action="chapter-continue">继续 <span aria-hidden="true">→</span></button>`;
  slot.append(chapter);
  runMotion(chapter, [{ opacity: 0, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 150 });
  return new Promise(resolve => {
    let done = false;
    const complete = proceed => {
      if (done) return; done = true;
      clearTimeout(timer);
      if (finishChapter === complete) finishChapter = null;
      if (!proceed || epoch !== quizEpoch || view !== 'quiz') { chapter.remove(); resolve(false); return; }
      runMotion(chapter, [{ opacity: 1 }, { opacity: 0 }], { duration: 100 }).then(() => { chapter.remove(); resolve(epoch === quizEpoch); });
    };
    const timer = setTimeout(() => complete(true), 700);
    ritualTimers.push(timer);
    finishChapter = complete;
  });
}
function bringQuestionIntoView(slot) {
  const rect = slot.getBoundingClientRect();
  // Keep an already-visible scene steady. Only follow a reader who has moved
  // below its opening back to the question, never to the site's page header.
  if (rect.top < 0 || rect.top >= window.innerHeight) {
    window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - 18), behavior: motionReduced() ? 'instant' : 'smooth' });
  }
}
async function renderQuiz({ direction = 1, chapter = false } = {}) {
  if (view !== 'quiz' || !$('#quiz-shell')) {
    renderedQuestionIndex = state.index; renderedStageIndex = -1; quizMeasuredWidth = 0;
    setView('quiz', quizShellHTML());
    updateQuizChrome(); measureQuizLayout(true);
    $('#question-title')?.focus({ preventScroll: true });
    return;
  }
  if (renderedQuestionIndex === state.index) { updateQuizChrome(); return; }
  quizBusy = true;
  const epoch = ++quizEpoch;
  const slot = $('#quiz-question-slot');
  const animateHeight = window.matchMedia('(max-width: 760px)').matches;
  const previousHeight = slot.getBoundingClientRect().height;
  if (animateHeight) slot.style.height = `${previousHeight}px`;
  const previous = slot.firstElementChild;
  slot.setAttribute('aria-busy', 'true');
  previous.setAttribute('aria-busy', 'true'); previous.inert = true;
  slot.classList.add('is-switching');
  bringQuestionIntoView(slot);
  updateQuizChrome();
  await runMotion(previous, [{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 7}px)` }], { duration: 100 });
  if (epoch !== quizEpoch || view !== 'quiz' || !slot.isConnected) return;
  const incoming = document.createElement('div');
  incoming.innerHTML = questionPanelHTML(state.index);
  const panel = incoming.firstElementChild;
  panel.setAttribute('aria-busy', 'true'); panel.inert = true;
  slot.replaceChildren(panel);
  renderedQuestionIndex = state.index;
  if (chapter) {
    panel.style.visibility = 'hidden';
    const { stage, stageIndex } = stageFor(state.index);
    if (!await showChapter(stage, stageIndex, slot, epoch)) return;
    panel.style.visibility = '';
  }
  const targetHeight = panel.getBoundingClientRect().height;
  await Promise.all([
    runMotion(panel, [{ opacity: 0, transform: `translateX(${direction * 7}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 170 }),
    animateHeight ? runMotion(slot, [{ height: `${previousHeight}px` }, { height: `${targetHeight}px` }], { duration: 190 }) : Promise.resolve(),
  ]);
  if (epoch !== quizEpoch || view !== 'quiz' || !slot.isConnected) return;
  if (animateHeight) slot.style.height = '';
  quizBusy = false;
  panel.inert = false; panel.setAttribute('aria-busy', 'false');
  slot.classList.remove('is-switching'); slot.setAttribute('aria-busy', 'false');
  updateQuizChrome();
  $('#quiz-announcer').textContent = `第 ${state.index + 1} 个选择，共 ${QUESTIONS.length} 个`;
  $('#question-title').focus({ preventScroll: true });
}
function chooseAnswer(index) {
  if (view !== 'quiz' || quizBusy || modal.open || !Number.isInteger(index) || !QUESTIONS[state.index].options[index]) return;
  const questionIndex = state.index;
  state.answers[questionIndex] = index; state.completed = false; result = null;
  persist();
  document.querySelectorAll('#quiz-question-slot .option').forEach((option, i) => {
    option.classList.toggle('selected', i === index);
    if(option.getAttribute('role')==='radio'){
      option.setAttribute('aria-checked',String(i===index));
      option.tabIndex=i===index?0:-1;
    }else option.setAttribute('aria-pressed', String(i === index));
  });
  const scaleCurrent=$('#quiz-question-slot .scale-current');
  if(scaleCurrent)scaleCurrent.textContent=`已选择：${QUESTIONS[state.index].options[index].text}`;
  updateQuizChrome();
}
function previousQuestion() {
  if (view !== 'quiz' || quizBusy || state.index === 0) return;
  state.index--; persist();
  renderQuiz({ direction: -1 });
}
function nextQuestion() {
  if (view !== 'quiz' || quizBusy || state.answers[state.index] === null) return;
  if (state.index < QUESTIONS.length - 1) {
    const from = stageFor(state.index).stageIndex;
    state.index++; persist();
    renderQuiz({ direction: 1, chapter: from !== stageFor(state.index).stageIndex });
    return;
  }
  const missing = state.answers.findIndex(answer => answer === null);
  if (missing >= 0) { state.index = missing; persist(); renderQuiz(); return; }
  quizBusy = true;
  result = calculateResult(state.answers); state.completed = true; persist();
  decodePortrait(result.best);
  renderRitual();
}
function decodePortrait(servant) {
  if (decodedPortraits.has(servant.id)) return decodedPortraits.get(servant.id);
  const src = PORTRAITS[servant.id]?.src;
  if (!src) return Promise.resolve();
  const image = new Image(); image.decoding = 'async'; image.src = src;
  const ready = (typeof image.decode === 'function' ? image.decode() : new Promise(resolve => {
    if (image.complete) resolve(); else { image.onload = resolve; image.onerror = resolve; }
  })).catch(() => {});
  decodedPortraits.set(servant.id, ready);
  return ready;
}
function renderRitual() {
  const servant = ensureResult().best;
  setView('ritual', `<section class="ritual-view summon-scene" aria-labelledby="ritual-title"><p class="eyebrow">SERVANT SUMMONING / 灵基召唤</p><div class="ritual-stage"><div class="summon-beam" aria-hidden="true"></div><div class="summon-beam" aria-hidden="true"></div><div class="summon-beam" aria-hidden="true"></div><div class="summon-beam" aria-hidden="true"></div>${ritualSVG('reveal', 'ritual-art')}<div class="reveal-card" id="reveal-card" data-action="unveil" role="button" tabindex="0" aria-label="翻开职阶卡，回应召唤"><div class="reveal-face reveal-back">${servantCardBackSVG('', servant.class)}</div><div class="reveal-face reveal-front" aria-hidden="true">${portraitImage(servant)}<div class="reveal-front-info"><small>${esc(servant.class.toUpperCase())}</small><strong>${esc(servant.name)}</strong></div></div></div></div><div class="summon-phase" id="summon-phase">A SOUL HAS ANSWERED</div><h1 id="ritual-title">有人，回应了你的呼唤。</h1><p id="ritual-status" role="status">伸出手，翻开这张卡。</p><div class="ritual-controls"><button class="primary" id="reveal-button" data-action="unveil">回应召唤 <span class="arrow" aria-hidden="true">✧</span></button></div><button class="quiet-button" data-action="reveal">略过演出 →</button></section>`);
  const epoch = viewEpoch;
  ritualPhase = 'ready'; ritualReady = decodePortrait(servant);
  ritualReady.then(() => { if (epoch === viewEpoch && view === 'ritual') $('#reveal-card')?.classList.add('is-ready'); });
}
function waitForCardFlip(card) {
  if (motionReduced()) return Promise.resolve(true);
  const duration = Math.max(...getComputedStyle(card).transitionDuration.split(',').map(value => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)), 0);
  if (!duration) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const complete = success => {
      if (settled) return; settled = true;
      clearTimeout(timer); card.removeEventListener('transitionend', onEnd);
      if (cancelRitualWait === complete) cancelRitualWait = null;
      resolve(success);
    };
    const onEnd = event => { if (event.target === card && event.propertyName === 'transform') complete(true); };
    const timer = setTimeout(() => complete(card.isConnected && view === 'ritual'), duration + 150);
    ritualTimers.push(timer); cancelRitualWait = complete;
    card.addEventListener('transitionend', onEnd);
  });
}
async function unveilServant() {
  if (view !== 'ritual' || ritualPhase !== 'ready') return;
  const card = $('#reveal-card'); if (!card) return;
  const epoch = viewEpoch, servant = ensureResult().best;
  ritualPhase = 'flipping';
  const button = $('#reveal-button'); button.disabled = true;
  card.setAttribute('aria-disabled', 'true'); card.tabIndex = -1;
  await ritualReady;
  if (epoch !== viewEpoch || view !== 'ritual' || !card.isConnected) return;
  const finished = waitForCardFlip(card);
  card.classList.add('is-flipped');
  card.setAttribute('aria-label', `${servant.class}，${servant.name}回应召唤`);
  card.querySelector('.reveal-front').setAttribute('aria-hidden', 'false');
  card.querySelector('.reveal-back').setAttribute('aria-hidden', 'true');
  $('#ritual-title').textContent = '契约，成立。';
  $('#ritual-status').textContent = `${servant.name}，回应了你的召唤。`;
  $('#summon-phase').textContent = 'SERVANT SUMMONED / CONTRACT ESTABLISHED';
  button.textContent = '契约成立';
  if (soundEnabled) stopChime = playSummoningChime();
  if (!await finished || epoch !== viewEpoch || view !== 'ritual') return;
  ritualPhase = 'shown';
  ritualTimer = setTimeout(() => {
    if (epoch === viewEpoch && view === 'ritual' && ritualPhase === 'shown') renderResult();
  }, motionReduced() ? 0 : 430);
}

function ensureResult() { if (!result && state.completed) result=calculateResult(state.answers); return result; }

function personalReadingHTML() {
  const readings = buildAnswerReading(state.answers, result);
  return `<section class="personal-reading" id="personal-reading" aria-labelledby="reading-heading"><h2 class="section-heading" id="reading-heading"><small>THE CHOICES YOU MADE</small>你在这些选择中的样子</h2>${readings.length ? `<div class="reading-list">${readings.map(reading => `<article class="reading-item"><h3>${esc(reading.title)}</h3><p>${esc(reading.text)}</p><ul class="reading-evidence">${reading.evidence.map(evidence => `<li><button class="reading-trace" data-action="review-question" data-index="${evidence.questionIndex}"><span>第 ${evidence.questionIndex + 1} 题 ↗</span>${QUESTIONS[evidence.questionIndex].type === 'scale' ? `<span class="reading-statement">${esc(QUESTIONS[evidence.questionIndex].statement || QUESTIONS[evidence.questionIndex].title)}</span>` : ''}<q>${esc(evidence.answerText)}</q></button></li>`).join('')}</ul></article>`).join('')}</div>` : '<p class="reading-empty">这次回答里，还没有足够重复的线索来概括你的倾向。可以先看看下面每个具体选择如何与英灵相遇。</p>'}</section>`;
}

function questionInspirationHTML(q) {
  const inspiration = q.inspiration;
  if (!inspiration) return '';
  const servant = SERVANTS.find(item => item.id === inspiration.servantId);
  if (!servant) return '';
  return `<div class="answer-inspiration"><h3>这个故事的另一面</h3><p>${esc(inspiration.story)}</p><p class="small-note">${esc(servant.name)} · ${esc(inspiration.kind)}。题目中的处境和选项为原创改写。</p><a class="source-link" href="${safeURL(inspiration.sourceUrl)}" target="_blank" rel="noopener noreferrer">阅读原型故事 ↗</a></div>`;
}

function renderResult() {
  if(!ensureResult())return renderHome();
  const s=result.best;resultTab='fate';
  setView('result',`<section class="shell result-shell" aria-labelledby="result-name"><div class="result-topline"><p class="eyebrow">SERVANT ACQUIRED / 灵基登录完成</p><button class="quiet-button" data-action="archive">灵基图鉴 ↗</button></div><div class="result-layout"><div class="summon-card rarity-${s.game?.rarity||1}" aria-label="${esc(s.class)}，${esc(s.name)}的从者卡">${portraitImage(s,'servant-portrait')}<div class="card-head"><span>${esc(s.class.toUpperCase())}</span>${classIcon(s.class)}</div><div class="card-name"><small>${esc(s.en.toUpperCase())}</small><strong>${esc(s.name)}</strong><div class="card-stars" aria-label="FGO初始稀有度${s.game?.rarity||1}星">${rarityStars(s)}</div><div class="card-version">FGO 初始灵基展示</div></div></div><div class="result-copy"><p class="stage-label">${esc(state.name||'旅人')}，与你最契合的英灵是</p><h1 id="result-name">${esc(s.name)}</h1><p class="english-name">${esc(s.en)} / ${esc(s.class)}</p><p class="result-lede">${esc(s.summary)}</p><blockquote class="contract-line">${esc(s.quote)}<small>契约注记 · 本作原创相性解读</small></blockquote><div class="resonance"><span class="resonance-number">${result.resonance}<small>/100</small></span><span class="resonance-copy"><strong>你与英灵 · 共鸣指数</strong><span>由你的选择形成，非游戏召唤概率</span></span></div><div class="result-actions"><button class="primary" data-action="share">保存召唤档案 <span class="arrow" aria-hidden="true">↓</span></button><button class="text-button" data-action="scroll-history">查看宝具与原型 ↘</button></div><div class="result-contract-hud">${commandSealSVG('seal')}<span>${QUESTIONS.length} 次选择，形成这次相遇<br>职阶：<strong>${esc(s.class)}</strong> · Fate 中的召唤类别</span></div></div></div><section class="history-panel" id="history-panel" aria-label="Fate灵基与历史原型"><div class="history-panel-nav" role="tablist" aria-label="档案类别"><p class="eyebrow">SERVANT / PROFILE</p><button class="tab" id="result-fate-tab" role="tab" aria-selected="true" aria-controls="result-lore-content" data-action="result-tab" data-tab="fate">Fate 人物档案</button><button class="tab" id="result-history-tab" role="tab" aria-selected="false" aria-controls="result-lore-content" data-action="result-tab" data-tab="history" tabindex="-1">历史与传说</button></div><div class="history-panel-content" id="result-lore-content" role="tabpanel" aria-labelledby="result-fate-tab">${loreContent(s,'fate')}</div></section><div class="insights"><section><h2 class="section-heading"><small>MASTER & SERVANT</small>为何与你共鸣</h2><ul class="reason-list">${result.reasons.map((reason,i)=>`<li>${esc(reason)}${result.evidence?.[i]?`<button class="reason-trace" data-action="review-question" data-index="${result.evidence[i].questionIndex}">回看第 ${result.evidence[i].questionIndex+1} 题 ↗</button>`:''}</li>`).join('')}</ul></section><section><h2 class="section-heading"><small>MASTER AFFINITY</small>你的选择倾向</h2>${radarSVG(result.scores)}<dl class="axis-endpoints">${AXES.map(a=>`<div><dt>${esc(a.name)}</dt><dd><span>${esc(a.low)}</span><span aria-hidden="true">↔</span><span>${esc(a.high)}</span></dd></div>`).join('')}</dl><p class="radar-legend">分数越高越接近右侧描述，仅表示倾向</p></section></div><div class="runner-heading"><h2 class="section-heading"><small>OTHER RESONANCES</small>也能感知到你呼唤的从者</h2></div><div class="runner-list">${result.runnersUp.map(p=>`<button class="runner-card" data-action="detail" data-id="${esc(p.id)}">${portraitImage(p,'runner-portrait','loading="lazy"')}<span><strong>${esc(p.name)}</strong><small>${esc(p.class)} · ${esc(p.title)}</small></span><span class="runner-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><div class="result-bottom"><button class="quiet-button" data-action="review">← 回看并修改选择</button><button class="quiet-button" data-action="setup">重新测试，看看另一种自己 ↗</button></div></section>`);
  const resultCopy=$('.result-copy');
  if(resultCopy){resultCopy.insertAdjacentHTML('afterbegin',resultMasterCodeHTML());resultCopy.querySelector(':scope > .stage-label').textContent='回应你召唤的英灵';}
  if (result.nearTie && result.runnersUp.length) $('.resonance').insertAdjacentHTML('afterend', `<p class="result-match-note">${esc(result.runnersUp[0].name)}也与你十分接近。这次相遇，还有另一种可能。</p>`);
  const insights=$('.insights');const profile=$('#history-panel');if(insights&&profile)profile.before(insights);
  insights?.insertAdjacentHTML('beforebegin', personalReadingHTML());

}

function loreContent(s,tab) {
  if(tab==='fate')return `<div class="origin-meta"><span class="pill">${esc(s.class)}</span><span>${esc(s.work)}</span></div>${gameProfile(s)}<p>${esc(s.compatibility)}</p><a class="source-link" href="${safeURL(fateSource(s))}" target="_blank" rel="noopener noreferrer">Fate 官方人物资料 ↗</a>${s.game?.sourceUrl?` · <a class="source-link" href="${safeURL(s.game.sourceUrl)}" target="_blank" rel="noopener noreferrer">宝具与技能资料 ↗</a>`:''}${artCredit(s)}`;
  const o=s.origin;
  return `<div class="origin-meta"><span class="pill">${esc(o.kind)}</span><span>${esc(o.era)}</span>${o.region?`<span>${esc(o.region)}</span>`:''}</div><h2>${esc(originHeading(s))}</h2><p>${esc(o.text)}</p><p class="difference">${esc(o.difference)}</p><a class="source-link" href="${safeURL(o.sourceUrl)}" target="_blank" rel="noopener noreferrer">资料来源：${esc(o.sourceLabel)} ↗</a>`;
}

function fateSource(s) { if(s.officialUrl)return s.officialUrl; if(s.work.includes('Zero'))return 'https://www.fate-zero.jp/characters/'; if(s.work.includes('stay'))return 'https://www.fate-sn.com/ubw/chara/';return 'https://www.fate-go.jp/trajectory/servant/'; }
function originHeading(s) { const names={artoria:'亚瑟王：圆桌之外的传说',iskandar:'亚历山大：远征与帝国',gilgamesh:'吉尔伽美什：泥板上的王',jeanne:'贞德：百年战争中的名字',nero:'尼禄：罗马史中的皇帝',waver:'诸葛亮：史书与演义之间'};return names[s.id] || `${s.name}的原型故事`; }
function radarSVG(scores) {
  const cx=200,cy=163,R=101;
  const point=(i,r)=>[cx+Math.cos((i*60-90)*Math.PI/180)*r,cy+Math.sin((i*60-90)*Math.PI/180)*r];
  const points=r=>AXES.map((_,i)=>point(i,r).join(',')).join(' ');
  return `<svg class="radar" viewBox="0 0 400 330" role="img" aria-label="${AXES.map((a,i)=>`${esc(a.name)} ${scores[i]}`).join('，')}">${[.25,.5,.75,1].map(k=>`<polygon points="${points(R*k)}" fill="none" stroke="var(--line)" stroke-width="1"/>`).join('')}${AXES.map((_,i)=>{const p=point(i,R);return `<path d="M${cx},${cy}L${p}" stroke="var(--line)"/>`;}).join('')}<polygon points="${scores.map((v,i)=>point(i,R*v/100).join(',')).join(' ')}" fill="var(--gold)" fill-opacity=".14" stroke="var(--gold)" stroke-width="1.7"/>${scores.map((v,i)=>{const p=point(i,R*v/100);return `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="var(--gold)"/>`;}).join('')}${AXES.map((a,i)=>{const p=point(i,R+30);const align=i===0||i===3?'middle':i<3?'start':'end';return `<text x="${p[0]}" y="${p[1]-3}" text-anchor="${align}" class="radar-label">${esc(a.name)}</text><text x="${p[0]}" y="${p[1]+14}" text-anchor="${align}" class="radar-value">${scores[i]}</text>`;}).join('')}</svg>`;
}

function renderArchive(origin) {
  if(typeof origin==='string')archiveState.origin=origin;
  setView('archive', `<section class="shell" aria-labelledby="archive-title"><div class="archive-head"><div><p class="eyebrow">THE ARCHIVE OF HEROIC SPIRITS</p><h1 id="archive-title">灵基图鉴</h1><p>查阅从者的职阶、宝具与代表技能。<br>翻开另一面，读到历史、神话和文学中的原型。</p></div><div class="archive-count" aria-hidden="true">${SERVANTS.length}</div></div><div class="archive-tools"><label class="visually-hidden" for="archive-search">搜索英灵、作品或原型</label><input class="search-input" id="archive-search" type="search" placeholder="搜索英灵、作品或原型…" value="${esc(archiveState.query)}"><label class="visually-hidden" for="origin-filter">原型类型</label><select class="filter-select" id="origin-filter"><option value="">全部原型</option>${[...new Set(SERVANTS.map(s=>s.origin.kind))].map(kind=>`<option value="${esc(kind)}" ${kind===archiveState.origin?'selected':''}>${esc(kind)}</option>`).join('')}</select></div><div class="class-filters" aria-label="按职阶筛选"><button class="filter-chip" aria-pressed="${!archiveState.className}" data-action="filter-class" data-class="">全部职阶</button>${classes.map(c=>`<button class="filter-chip" aria-pressed="${archiveState.className===c}" data-action="filter-class" data-class="${esc(c)}">${classIcon(c,16)}${esc(c)}</button>`).join('')}</div><div id="archive-grid" class="archive-grid"></div><p id="archive-counter" class="archive-counter" role="status"></p><button class="text-button" data-action="${state.completed?'last-result':'home'}" style="margin-top:20px">← ${state.completed?'返回我的契约':'返回召唤仪式'}</button></section>`);
  $('#archive-search').addEventListener('input',event=>{archiveState.query=event.target.value;renderArchiveCards();});
  $('#origin-filter').addEventListener('change',event=>{archiveState.origin=event.target.value;renderArchiveCards();});
  renderArchiveCards();
}
function renderArchiveCards() {
  const query=archiveState.query.trim().toLowerCase();
  const list=SERVANTS.filter(s=>(!archiveState.className||s.class===archiveState.className)&&(!archiveState.origin||s.origin.kind===archiveState.origin)&&(!query||[s.name,s.en,s.title,s.work,s.origin.text,s.origin.region,...(s.tags||[])].join(' ').toLowerCase().includes(query)));
  $('#archive-grid').innerHTML=list.length?list.map(s=>`<button class="archive-card" data-action="detail" data-id="${esc(s.id)}" aria-label="查看${esc(s.name)}的作品设定和原型资料">${portraitImage(s,'archive-portrait','loading="lazy"')}<span class="archive-class">${classIcon(s.class,16)}${esc(s.class.toUpperCase())}</span><strong>${esc(s.name)}</strong><small>${esc(s.game?.npName||s.title)}</small><span class="archive-origin">${esc(s.origin.kind)} · ${esc(s.origin.region||s.origin.era)}</span></button>`).join(''):'<div class="empty-state">未找到相符的英灵。试试其他名字，或清除职阶与原型筛选。<br><button class="text-button" data-action="clear-filters">清除筛选</button></div>';
  $('#archive-counter').textContent=`当前显示 ${list.length} / ${SERVANTS.length} 位英灵。档案含剧情相关信息。`;
}
function openDetail(id,tab='fate') {
  const s=SERVANTS.find(s=>s.id===id);if(!s)return;
  openModal(`<div class="detail-header">${portraitImage(s,'detail-portrait')}<div><p class="stage-label">${esc(s.class.toUpperCase())} / SPIRIT ORIGIN</p><h2>${esc(s.name)}</h2><p class="english-name">${esc(s.en)}</p></div></div><div class="detail-tabs" role="tablist" aria-label="档案类别"><button class="tab" id="detail-fate-tab" role="tab" aria-selected="${tab==='fate'}" aria-controls="detail-content" data-action="detail-tab" data-tab="fate" data-id="${esc(s.id)}" ${tab!=='fate'?'tabindex="-1"':''}>Fate 人物档案</button><button class="tab" id="detail-history-tab" role="tab" aria-selected="${tab==='history'}" aria-controls="detail-content" data-action="detail-tab" data-tab="history" data-id="${esc(s.id)}" ${tab!=='history'?'tabindex="-1"':''}>历史与传说</button></div><div class="detail-panel" id="detail-content" role="tabpanel" aria-labelledby="detail-${tab}-tab">${loreContent(s,tab)}</div>`);
}

function openAbout() {
  openModal(`<p class="eyebrow">ABOUT THIS FAN PROJECT</p><h2>一次关于选择的召唤。</h2><p>「契约之刻」是以 Fate 系列为灵感的非官方同人互动。${QUESTIONS.length} 次选择，从历史、战争与誓约，走向爱情、命运与个人信念；情境、偏好与认同量表共同构成你的召唤线索。</p><ul class="about-list"><li><strong>如何匹配：</strong>历史战争情境与个人态度共同构成线索，三道审美题权重较轻；跳过的审美题不参与评分。量表中间项表示不偏向两端，计入已答。答案形成六维倾向，再与预设的英灵画像比较，结果会标出实际回答作为共鸣理由。姓名仅用于生成御主代号，不影响英灵匹配。相同答案得到相同结果；共鸣指数是本测试的相对适配评分，不是游戏抽卡概率、官方参数或心理学量表。</li><li><strong>如何读历史：</strong>档案分别标注历史、传说、神话、文学或原创人物。原型资料与 Fate 改编设定分开展示，提供进一步阅读的来源。存在史料争议的地方保留不确定性。</li><li><strong>你的数据：</strong>本页面不上传姓名或答案。进度仅保存在当前浏览器，清除网站数据后消失。资料链接会打开外部网站。</li><li><strong>关于作品：</strong>Fate 及相关角色属于各权利方。本作与 TYPE-MOON、Aniplex 等官方无关联。角色立绘采用FGO初始灵基卡面，经Atlas Academy公开资源整理并保留出处。召唤阵、令咒图形、卡背、触媒插图、音效、测试题和适配文案为本项目原创创作。无游戏账号登录或付费内容。</li></ul><hr class="modal-divider"><p class="small-note">作品资料入口：<a href="https://www.fate-sn.com/ubw/chara/" target="_blank" rel="noopener noreferrer">Fate/stay night</a> · <a href="https://www.fate-zero.jp/characters/" target="_blank" rel="noopener noreferrer">Fate/Zero</a> · <a href="https://www.fate-go.jp/trajectory/servant/" target="_blank" rel="noopener noreferrer">Fate/Grand Order</a></p><button class="text-button" data-action="clear-save">清除本浏览器中的测试进度</button>`);
}

async function createShareCard() {
  if(!ensureResult())return;
  const button=document.querySelector('[data-action="share"]');
  const label=button?.innerHTML;
  const epoch=viewEpoch;
  const modalVersion=modalEpoch;
  const snapshot=result;
  const masterName=state.name||'旅人';
  const masterIdentity=generateMasterCode(masterName);
  if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='正在生成图片…';}
  try {
    await document.fonts?.ready;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
    const s=snapshot.best;const gold='#c3a676',paper='#eae4d8',muted='#9aa8b7';
    ctx.fillStyle='#0e1b2b';ctx.fillRect(0,0,1080,1920);ctx.strokeStyle=gold;ctx.lineWidth=1;ctx.strokeRect(31,31,1018,1858);ctx.globalAlpha=.35;ctx.strokeRect(43,43,994,1834);ctx.globalAlpha=1;
    ctx.textAlign='center';ctx.fillStyle=gold;ctx.font='italic 29px Georgia';ctx.fillText('Fate / THE MOMENT OF CONTRACT',540,88);ctx.fillStyle=paper;ctx.font='25px "Microsoft YaHei",sans-serif';ctx.fillText(masterIdentity.code,540,129,880);ctx.fillStyle=muted;ctx.font='17px "Microsoft YaHei",sans-serif';ctx.fillText(`登记名 · ${masterName}  /  ${masterIdentity.language}`,540,159,880);
    const portrait=new Image();portrait.src=PORTRAITS[s.id].src;await portrait.decode();ctx.drawImage(portrait,260,186,560,792);ctx.strokeStyle=gold;ctx.strokeRect(259,185,562,794);
    const shade=ctx.createLinearGradient(0,700,0,978);shade.addColorStop(0,'#0a142000');shade.addColorStop(.55,'#0a1420e6');shade.addColorStop(1,'#0a1420');ctx.fillStyle=shade;ctx.fillRect(260,700,560,278);
    ctx.font='21px Georgia';ctx.fillStyle=gold;ctx.fillText(`${s.class.toUpperCase()}  ${rarityStars(s)}`,540,827);
    ctx.fillStyle=paper;let nameSize=46;do{ctx.font=`${nameSize}px "Noto Serif SC","SimSun",serif`;if(ctx.measureText(s.name).width<510)break;nameSize-=2;}while(nameSize>24);ctx.fillText(s.name,540,890);ctx.font='italic 20px Georgia';ctx.fillStyle=gold;ctx.fillText(s.en,540,936,510);
    ctx.font='49px Georgia';ctx.fillStyle=gold;ctx.fillText(`${snapshot.resonance} / 100`,540,1050);ctx.font='20px "Microsoft YaHei",sans-serif';ctx.fillStyle=muted;ctx.fillText('你与英灵 · 共鸣指数',540,1087);
    if(snapshot.nearTie&&snapshot.runnersUp.length){ctx.font='17px \"Microsoft YaHei\",sans-serif';ctx.fillText(`另一个接近的回应：${snapshot.runnersUp[0].name}`,540,1115,880);}
    ctx.font='29px "Noto Serif SC","SimSun",serif';ctx.fillStyle=paper;wrapCanvas(ctx,s.summary,540,1146,880,39,2);
    ctx.font='19px "Microsoft YaHei",sans-serif';ctx.fillStyle=gold;ctx.fillText('因何回应你的呼唤',540,1240);
    ctx.font='25px "Microsoft YaHei",sans-serif';ctx.fillStyle=paper;wrapCanvas(ctx,snapshot.reasons[0],540,1288,880,36,3);
    ctx.strokeStyle=gold;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(125,1390);ctx.lineTo(955,1390);ctx.stroke();ctx.globalAlpha=1;
    ctx.fillStyle=gold;ctx.font='19px "Microsoft YaHei",sans-serif';ctx.fillText('FATE / 宝具',540,1435);ctx.fillStyle=paper;ctx.font='30px "Noto Serif SC","SimSun",serif';wrapCanvas(ctx,s.game?.npName||s.title,540,1480,880,38,2);
    ctx.fillStyle=gold;ctx.font='19px "Microsoft YaHei",sans-serif';ctx.fillText('历史与传说 / 原型档案',540,1575);ctx.fillStyle=muted;ctx.font='20px "Microsoft YaHei",sans-serif';wrapCanvas(ctx,`${s.origin.kind} · ${s.origin.era}`,540,1610,880,30,1);ctx.font='25px "Microsoft YaHei",sans-serif';wrapCanvas(ctx,s.origin.text,540,1656,880,34,3);
    ctx.strokeStyle=gold;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(125,1776);ctx.lineTo(955,1776);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=paper;ctx.font='28px "Noto Serif SC","SimSun",serif';ctx.fillText('契约之刻 · 我的英灵召唤档案',540,1820);ctx.fillStyle=muted;ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText('非官方同人相性解读 · 共鸣指数非游戏召唤概率',540,1852);ctx.font='13px "Microsoft YaHei",sans-serif';ctx.fillText('角色美术 © TYPE-MOON / FGO PROJECT · via Atlas Academy',540,1875);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Export failed');
    // A real PNG image keeps the native long-press save menu available on phones.
    const png=canvas.toDataURL('image/png');
    if(viewEpoch!==epoch||modalEpoch!==modalVersion||view!=='result')return;
    if(shareObjectURL)URL.revokeObjectURL(shareObjectURL);
    shareObjectURL=URL.createObjectURL(blob);
    const filename=`契约之刻-${s.name}.png`;
    const file=typeof File==='function'?new File([blob],filename,{type:'image/png'}):null;
    let canShare=false;try{canShare=!!(file&&navigator.share&&navigator.canShare?.({files:[file]}));}catch{}
    openModal(`<section class="share-sheet" aria-labelledby="share-title"><p class="eyebrow">YOUR SUMMONING RECORD</p><h2 id="share-title">保存召唤档案。</h2><p class="share-instruction" id="share-instruction">手机长按下方图片，即可保存到相册。</p><img class="share-preview" src="${png}" width="1080" height="1920" alt="${esc(masterName)}召唤的${esc(s.name)}：职阶、共鸣解读、宝具与原型简介" aria-describedby="share-instruction"><div class="share-actions"><a class="primary" href="${shareObjectURL}" download="${esc(filename)}">下载图片 <span aria-hidden="true">↓</span></a>${canShare?'<button class="text-button" id="native-share">系统分享 ↗</button>':''}</div><p class="small-note">若长按未出现菜单，可使用“下载图片”。完整资料与出处保存在英灵档案中。</p></section>`);
    $('#native-share')?.addEventListener('click',async()=>{try{await navigator.share({files:[file],title:`我召唤了${s.name}`});}catch(error){if(error.name!=='AbortError')notify('暂时无法调用系统分享，可以长按图片保存。');}});
  } catch(error) { console.error('Share export failed',error);notify('图片生成失败，请重试，或使用浏览器截图保存。'); }
  finally {if(button?.isConnected){button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML=label;}}
}
function wrapCanvas(ctx,text,x,y,maxWidth,lineHeight,maxLines){const lines=[];let current='';for(const char of String(text)){if(ctx.measureText(current+char).width>maxWidth&&current){lines.push(current);current=char;}else current+=char;}if(current)lines.push(current);lines.slice(0,maxLines).forEach((line,index)=>{if(index===maxLines-1&&lines.length>maxLines){while(ctx.measureText(line+'…').width>maxWidth)line=line.slice(0,-1);line+='…';}ctx.fillText(line,x,y+index*lineHeight);});}

document.addEventListener('click', event => {
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;
  if(target.tagName==='A'&&action==='home')event.preventDefault();
  if(action==='sound')return toggleSound();
  if(action==='hero-class')return previewClass(target.dataset.class);
  if(action==='glossary')return openGlossary();
  if(action==='unveil')return unveilServant();
  if(action==='work'){archiveState={query:target.dataset.work,origin:'',className:''};return renderArchive();}
  if(action==='close')return closeModal();
  if(action==='home'){if(modal.open)closeModal();return renderHome();}
  if(action==='setup')return openSetup();
  if(action==='resume'){state.index=state.answers.findIndex(a=>a===null);if(state.index<0)state.index=QUESTIONS.length-1;return renderQuiz();}
  if(action==='save-exit'){persist();notify('进度已暂存在当前浏览器。');return renderHome();}
  if(action==='answer')return chooseAnswer(Number(target.dataset.index));
  if(action==='previous')return previousQuestion();
  if(action==='chapter-continue'){if(finishChapter)finishChapter(true);return;}
  if(action==='next')return nextQuestion();
  if(action==='reveal')return renderResult();
  if(action==='last-result')return renderResult();
  if(action==='archive'){if(modal.open)closeModal();return renderArchive();}
  if(action==='history-archive')return renderArchive('历史人物');
  if(action==='about')return openAbout();
  if(action==='detail')return openDetail(target.dataset.id);
  if(action==='filter-class'){archiveState.className=target.dataset.class;document.querySelectorAll('[data-action="filter-class"]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.class===archiveState.className)));return renderArchiveCards();}
  if(action==='clear-filters'){archiveState={query:'',origin:'',className:''};return renderArchive();}
  if(action==='result-tab'){
    resultTab=target.dataset.tab;
    $('#history-panel').classList.toggle('is-history',resultTab==='history');
    document.querySelectorAll('[data-action="result-tab"]').forEach(el=>{const active=el.dataset.tab===resultTab;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;});
    $('#result-lore-content').innerHTML=loreContent(result.best,resultTab);$('#result-lore-content').setAttribute('aria-labelledby',target.id);return;
  }
  if(action==='detail-tab'){
    const s=SERVANTS.find(s=>s.id===target.dataset.id);if(!s)return;
    document.querySelectorAll('[data-action="detail-tab"]').forEach(el=>{const active=el===target;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;});
    $('#detail-content').innerHTML=loreContent(s,target.dataset.tab);$('#detail-content').setAttribute('aria-labelledby',target.id);return;
  }
  if(action==='scroll-history')return $('#history-panel').scrollIntoView({behavior:motionReduced()?'instant':'smooth',block:'start'});
  if(action==='review-question'){
    const index=Number(target.dataset.index);if(!Number.isInteger(index)||index<0||index>=QUESTIONS.length)return;
    const q=QUESTIONS[index],answer=q.options[state.answers[index]];if(!answer)return;
    openModal(`<p class="eyebrow">YOUR ANSWER / 第 ${index+1} 题</p>${questionRoleHTML(q)}<h2>${esc(q.statement||q.title)}</h2>${q.context?`<p>${esc(q.context)}</p>`:''}<div class="answer-trace"><small>${q.type==='scale'?'你选择的符合程度':'你当时的选择'}</small><p>${esc(answer.text||answer.label)}</p></div><p class="small-note">${q.category==='culture'?'这类偏好只作辅助参考，会与其他回答一起理解。':'这道回答与其他选择一起构成共鸣依据，不会单独决定结果。'}</p>${questionInspirationHTML(q)}<p class="small-note">想调整答案，可以在结果页底部选择“回看并修改选择”。</p>`);return;
  }
  if(action==='review'){state.index=0;persist();return renderQuiz();}
  if(action==='share')return createShareCard();
  if(action==='clear-save'){state=freshState();result=null;try{localStorage.removeItem(STORAGE_KEY);}catch{}closeModal();renderHome();notify('已清除本浏览器中的测试进度。');}
});
document.addEventListener('keydown',event=>{
  const tab=event.target.closest('[role="tab"]');
  if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    const siblings=[...tab.parentElement.querySelectorAll('[role="tab"]')];let index=siblings.indexOf(tab);index=event.key==='Home'?0:event.key==='End'?siblings.length-1:(index+(event.key==='ArrowRight'?1:-1)+siblings.length)%siblings.length;event.preventDefault();siblings[index].click();siblings[index].focus();return;
  }
  if (view === 'ritual' && event.target.closest('#reveal-card') && ['Enter', ' '].includes(event.key)) { event.preventDefault(); if (!event.repeat) unveilServant(); return; }
  if(view==='quiz'&&!modal.open&&!['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    if (event.repeat) { event.preventDefault(); return; }
    const scaleRadio=event.target.closest('.agreement-scale [role="radio"]');
    if(scaleRadio&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();
      const last=QUESTIONS[state.index].options.length-1;
      const current=Number(scaleRadio.dataset.index);
      const target=event.key==='Home'?0:event.key==='End'?last:Math.max(0,Math.min(last,current+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)));
      chooseAnswer(target);document.querySelectorAll('#quiz-question-slot .option')[target]?.focus();return;
    }
    const n=Number(event.key);
    if(n>=1&&n<=QUESTIONS[state.index].options.length){event.preventDefault();chooseAnswer(n-1);document.querySelectorAll('#quiz-question-slot .option')[n-1]?.focus();}
  }
});
window.addEventListener('resize', () => { if (view === 'quiz') requestAnimationFrame(() => measureQuizLayout()); });
window.addEventListener('hashchange',()=>{if(location.hash==='#home'){if(modal.open)closeModal();renderHome();}});
renderHome(false);
