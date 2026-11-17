"""Exercise the active v9 page (legacy script filename), including actor roles, confirmation and motion.
Run with an isolated Chrome DevTools instance on localhost:9333.
"""
from pathlib import Path
import json
import time
import hashlib

from qa_cdp import *

def wait_for(expression, timeout=7):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if js(expression): return
        time.sleep(.035)
    raise AssertionError('Timed out: ' + expression)

def at_question(index):
    return f'!!document.querySelector(\'.question-body[data-question-index="{index}"]\') && document.querySelector(\'.question-body[data-question-index="{index}"]\').getAttribute("aria-busy")!=="true"'


def press_key(key, code=None):
    params = {'key': key, 'code': code or key}
    if key in ('ArrowLeft', 'ArrowRight', 'Home', 'End'):
        virtual_key = {'ArrowLeft': 37, 'ArrowRight': 39, 'Home': 36, 'End': 35}[key]
        params.update(windowsVirtualKeyCode=virtual_key, nativeVirtualKeyCode=virtual_key)
    elif key == 'Enter':
        params.update(windowsVirtualKeyCode=13, nativeVirtualKeyCode=13, text='\r', unmodifiedText='\r')
    elif len(key) == 1 and key.isdigit():
        params.update(windowsVirtualKeyCode=ord(key), nativeVirtualKeyCode=ord(key))
    cdp('Input.dispatchKeyEvent', {'type': 'keyDown', **params})
    cdp('Input.dispatchKeyEvent', {'type': 'keyUp', **{k:v for k,v in params.items() if k not in ('text','unmodifiedText')}})


def question_meta(index):
    return js(f'(()=>{{const q=FateData.QUESTIONS[{index}];return {{id:q.id,type:q.type||"choice",category:q.category,stage:q.stage,role:q.role,authority:q.authority,optionCount:q.options.length,neutralIndex:q.options.findIndex(o=>o.neutral),inspiration:q.inspiration||null}}}})()')


def selected_option(index):
    return f'(()=>{{const o=document.querySelectorAll("#quiz-question-slot .option")[{index}];return !!o&&(o.getAttribute("aria-checked")==="true"||o.getAttribute("aria-pressed")==="true")}})()'


def inspect_question(index, fresh=True):
    meta = question_meta(index)
    check(f'question {index+1} renders its actual option count', f'document.querySelectorAll("#quiz-question-slot [data-action=answer]").length==={meta["optionCount"]}')
    check(f'question {index+1} keeps the current actor identity visible', f'(()=>{{const q=FateData.QUESTIONS[{index}],stageIndex=typeof q.stage==="number"?q.stage:FateData.STAGES.findIndex(s=>s.id===q.stage),stage=FateData.STAGES[stageIndex],role=document.querySelector("#quiz-aside .stage-role, #quiz-aside [data-stage-role]");return !!stage&&!!role&&role.textContent.includes(q.role)}})()')
    if meta['type'] != 'scale':
        check(f'question {index+1} states the role and its authority', f'(()=>{{const q=FateData.QUESTIONS[{index}],r=document.querySelector(".question-role");return !!r?.querySelector("strong")&&!!r?.querySelector("p")&&r.querySelector("strong").textContent.includes(q.role)&&r.querySelector("p").textContent.includes(q.authority)}})()')
    else:
        check(f'scale {index+1} avoids a repeated question-role panel', '!document.querySelector(".question-role")')
    if meta['category'] == 'war':
        inspiration = meta['inspiration'] or {}
        servant_id = json.dumps(inspiration.get('servantId', ''))
        check(f'war question {index+1} has a cited matching inspiration', f'(()=>{{const q=FateData.QUESTIONS[{index}],i=q.inspiration;return !!i&&i.servantId==={servant_id}&&!!i.story?.trim()&&!!i.kind?.trim()&&(i.sourceUrl||"").startsWith("https://")&&FateData.SERVANTS.some(s=>s.id===i.servantId)}})()')
        check(f'war question {index+1} does not reveal its inspired Servant', f'(()=>{{const q=FateData.QUESTIONS[{index}],s=FateData.SERVANTS.find(x=>x.id===q.inspiration?.servantId);if(!s)return false;const text=[q.title,q.statement,q.context,...q.options.flatMap(o=>[o.label,o.text]),document.querySelector("#quiz-question-slot").textContent].filter(Boolean).join(" ").toLocaleLowerCase();return ![s.name,s.en].filter(Boolean).some(name=>text.includes(name.toLocaleLowerCase()))}})()')
    if meta['type'] == 'scale':
        check(f'scale {index+1} is an accessible seven-option radio group', 'document.querySelectorAll(".agreement-scale[role=radiogroup]").length===1 && document.querySelectorAll(".agreement-scale [data-action=answer][role=radio].option").length===7')
        check(f'scale {index+1} has a zero-vector middle answer rather than a skip', f'(()=>{{const o=FateData.QUESTIONS[{index}].options[3];return !o.neutral&&Object.values(o.scores).every(v=>v===0)}})()')
        check(f'scale {index+1} keeps its contracted weight', f'FateData.QUESTIONS[{index}].weight===0.75')
        if fresh:
            check(f'scale {index+1} has no default answer', '[...document.querySelectorAll(".agreement-scale [role=radio]")].every(o=>o.getAttribute("aria-checked")!=="true"&&!o.classList.contains("selected")) && document.querySelector("#next-question").disabled')
            js('document.querySelector(".agreement-scale [role=radio]").focus({preventScroll:true})')
            for key, expected in [('ArrowRight',1),('ArrowLeft',0),('End',6),('Home',0)]:
                press_key(key)
                check(f'scale {index+1} {key} selects without advancing', at_question(index) + ' && ' + selected_option(expected))
            time.sleep(.85)
            check(f'scale {index+1} arrow selection waits for explicit confirmation', at_question(index))
            click('[data-action="answer"][data-index="3"]')
            check(f'scale {index+1} records its middle answer', selected_option(3) + ' && !document.querySelector("#next-question").disabled')
    return meta

cdp('Page.enable')
cdp('Runtime.enable')
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'no-preference'}]})
viewport(1440,1050)
cdp('Page.navigate', {'url':(ROOT/'index.html').as_uri()})
wait_for('document.readyState==="complete" && !!document.querySelector(".hero")')
js('localStorage.clear()')
cdp('Page.reload')
wait_for('!!document.querySelector(".hero")')
js('localStorage.setItem("fate-summoning-contract-v8",JSON.stringify({version:1,name:"旧版记录",answers:Array(24).fill(0),index:23,completed:true}))')
cdp('Page.reload')
wait_for('!!document.querySelector(".hero")')
check('new actor question bank does not reuse old answers', 'FateData.STORAGE_KEY.endsWith("v9") && !document.querySelector("[data-action=resume]") && !document.querySelector("[data-action=last-result]")')
wait_for('typeof FateData!=="undefined" && !!FateData.QUESTIONS && typeof FateIdentity!=="undefined" && !!FateIdentity.generateMasterCode && typeof FateReading!=="undefined" && typeof FateReading.buildAnswerReading==="function"')
question_count = js('FateData.QUESTIONS.length')
last_index = question_count - 1
check('v9 loads twenty-four questions and four chapters', 'FateData.QUESTIONS.length===24 && FateData.STAGES.length===4')
check('chapters retain their story order and the war chapter uses actor roles', '(()=>{const expected=["远行之前","军旗之下","灯火归途","星海与圣杯"];return FateData.STAGES.every((s,i)=>s.title===expected[i]&&s.role?.trim())&&FateData.STAGES[1].role!=="领兵的将军"})()')
check('home retains Fate artwork', 'document.querySelectorAll(".preview-card img").length===3')
check('opening has no tutorial sales pitch', '!/(不需要玩过|不必了解|不考历史|没有知识考点|标准答案)/.test(document.querySelector("main").textContent)')
screenshot('home-desktop-v9.png')
viewport(390,844,True)
check('mobile home fits', 'document.documentElement.scrollWidth<=innerWidth')
screenshot('home-mobile-v9.png')
click('[data-action="setup"]')
check('setup is concise', 'document.querySelector("#modal").open && !/(不需要玩过|知识考点|标准答案|这些题关于)/.test(document.querySelector("#modal").textContent)')
check('setup omits explanatory code origin note', '!document.querySelector(".code-origin-note")')
screenshot('setup-mobile-v9.png',False)
master_identity = js('FateIdentity.generateMasterCode("旅人")')
master_code = master_identity['code']
js('document.querySelector("#master-name").value="旅人";document.querySelector("#master-name").dispatchEvent(new Event("input",{bubbles:true}))')
check('setup previews the generated code and language live', '(()=>{const v=document.querySelector("#master-code-preview .master-code-value"),i=FateIdentity.generateMasterCode("旅人");return !!v&&v.textContent.trim()===i.code&&v.lang===i.languageTag})()')
js('document.querySelector("#master-name").value="青岚";document.querySelector("#master-name").dispatchEvent(new Event("input",{bubbles:true}))')
check('changing the name updates the live identity', 'document.querySelector("#master-code-preview .master-code-value").textContent.trim()===FateIdentity.generateMasterCode("青岚").code && FateIdentity.generateMasterCode("青岚").code!==FateIdentity.generateMasterCode("旅人").code')
js('document.querySelector("#master-name").value="旅人";document.querySelector("#master-name").dispatchEvent(new Event("input",{bubbles:true}))')
check('restoring a name restores its original identity', f'document.querySelector("#master-code-preview .master-code-value").textContent.trim()==={json.dumps(master_code)}')
screenshot('setup-identity-v9.png',False)
js('document.querySelector("#setup-form").requestSubmit()')
wait_for(at_question(0))
wait_for('!document.getAnimations().some(a=>a.playState==="running" && a.effect?.target?.classList?.contains("view-enter"))')
check('initial question cannot advance empty', 'document.querySelector("#next-question").disabled')
check('HUD carries the setup identity', f'document.querySelector(".master-hud-code").textContent.includes({json.dumps(master_code)})')
first_meta = inspect_question(0)
viewport(320,760,True)
check('320px question fits', 'document.documentElement.scrollWidth<=innerWidth')
viewport(390,844,True)
screenshot('quiz-mobile-v9.png')
check('mobile controls do not cover the last option','document.querySelector(".quiz-bottom").getBoundingClientRect().top>=document.querySelector(".options").getBoundingClientRect().bottom')
check('mobile uses the current scene height without a blank reserve','Math.abs(document.querySelector("#quiz-question-slot").getBoundingClientRect().height-document.querySelector(".question-body").getBoundingClientRect().height)<3')
js('window.__qaShell=document.querySelector(".quiz-shell");window.__qaHUD=document.querySelector(".master-hud");window.__qaTrack=document.querySelector(".stage-track")')

# A number key selects only; even Enter on the question requires explicit confirmation.
first_choice = min(1, first_meta['optionCount'] - 1)
press_key(str(first_choice + 1), f'Digit{first_choice + 1}')
time.sleep(.85)
check('number key selects without advancing after 800ms', at_question(0) + ' && ' + selected_option(first_choice))
check('selected answer enables Continue', '!document.querySelector("#next-question").disabled')
js('document.querySelector("#question-title").focus({preventScroll:true})')
press_key('Enter')
time.sleep(.85)
check('Enter on the question does not advance', at_question(0))

# Inspect every animation frame only after the explicit Continue click.
motion = js('''(async()=>{
 const samples=[]; const start=performance.now();
 document.querySelector('[data-action="next"]').click();
 document.querySelector('[data-action="next"]').click();
 await new Promise(resolve=>{
   const frame=()=>{
     const hud=document.querySelector('.master-hud'); let opacity=1;
     for(let e=hud;e;e=e.parentElement)opacity*=Number(getComputedStyle(e).opacity);
     samples.push({t:performance.now()-start,opacity,kept:hud===window.__qaHUD});
     if(performance.now()-start<1200)requestAnimationFrame(frame);else resolve();
   };requestAnimationFrame(frame);
 });
 return {frames:samples.length,minHUDOpacity:Math.min(...samples.map(s=>s.opacity)),sameHUD:samples.every(s=>s.kept),sameShell:window.__qaShell===document.querySelector('.quiz-shell'),sameTrack:window.__qaTrack===document.querySelector('.stage-track')};
})()''')
wait_for(at_question(1))
checks.append({'check':'question transition keeps the interface visible and mounted','pass':motion['sameHUD'] and motion['sameShell'] and motion['sameTrack'] and motion['minHUDOpacity']>.98,'details':motion})
check('Continue click advances one question', at_question(1))

# Reselection reads the current option count, and focused Continue must accept Enter.
second_meta = inspect_question(1)
second_choice = min(2, second_meta['optionCount'] - 1)
js('document.querySelector(".quiz-bottom").scrollIntoView({block:"end",behavior:"instant"})')
click('[data-action="answer"][data-index="0"]')
click(f'[data-action="answer"][data-index="{second_choice}"]')
time.sleep(.85)
check('reselecting waits for confirmation after 800ms', at_question(1) + ' && ' + selected_option(second_choice))
js('document.querySelector("#next-question").focus({preventScroll:true})')
press_key('Enter')
wait_for(at_question(2))
check('Enter on focused Continue advances one question', at_question(2))
time.sleep(.85)
check('rapid next does not skip another question', at_question(2))
check('advancing from the page bottom brings the next scene into view', '(()=>{const r=document.querySelector("#question-title").getBoundingClientRect();return r.top>=0&&r.top<innerHeight*.6})()')
click('[data-action="previous"]')
wait_for(at_question(1))
check('back restores the selected answer', selected_option(second_choice))
js('document.querySelector(\'[data-action="answer"][data-index="0"]\').click();document.querySelector(\'[data-action="save-exit"]\').click()')
wait_for('!!document.querySelector(".hero")')
time.sleep(.85)
check('saving and leaving keeps the home view', '!!document.querySelector(".hero")')
cdp('Page.reload')
wait_for('!!document.querySelector("[data-action=resume]")')
click('[data-action="resume"]')
wait_for(at_question(2))
check('resume goes to the next unanswered question', at_question(2))
check('reload restores the same name-derived identity', f'document.querySelector(".master-hud-code").textContent.includes({json.dumps(master_code)}) && FateIdentity.generateMasterCode(JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)).name).code==={json.dumps(master_code)}')

# Every remaining answer, including neutral culture choices, needs an explicit Continue click.
for i in range(2, question_count):
    wait_for(at_question(i))
    check(f'question {i+1} fits mobile', 'document.documentElement.scrollWidth<=innerWidth')
    meta = inspect_question(i)
    option_count = meta['optionCount']
    neutral = meta['neutralIndex']
    if neutral>=0:
        check('historical aesthetic preference includes an unscored choice', '!!document.querySelector(".option-neutral")')
        screenshot('preference-mobile-v9.png')
        press_key(str(neutral+1), f'Digit{neutral+1}')
    else:
        choice = 3 if meta['type'] == 'scale' else i % option_count
        click(f'[data-action="answer"][data-index="{choice}"]')
    time.sleep(.85)
    check(f'question {i+1} waits at least 800ms for confirmation', at_question(i))
    if i == last_index:
        check('selecting the final answer cannot summon without confirmation', '!document.querySelector(".ritual-view") && !document.querySelector("#next-question").disabled')
        js('document.querySelector("#question-title").focus({preventScroll:true})')
        press_key('Enter')
        time.sleep(.85)
        check('Enter on the final question cannot summon', at_question(last_index) + ' && !document.querySelector(".ritual-view")')
    click('[data-action="next"]')
    if i<last_index: wait_for(at_question(i+1))

wait_for('!!document.querySelector(".ritual-view")')
wait_for('!!document.querySelector("#reveal-button") && !document.querySelector("#reveal-button").hidden && !document.querySelector("#reveal-button").disabled')
screenshot('ritual-mobile-v9.png')
click('[data-action="unveil"]')
wait_for('!!document.querySelector("#reveal-card.is-flipped")')
check('card front is already decoded at reveal', 'document.querySelector(".reveal-front img").complete && document.querySelector(".reveal-front img").naturalWidth>0')
wait_for('!!document.querySelector("#result-name")',10)
check('one reveal click reaches the result', '!!document.querySelector(".summon-card .servant-portrait")')
check('result retains the same Master identity', f'document.querySelector(".result-master-code").textContent.includes({json.dumps(master_code)})')
check('answer reasons precede the profile', 'document.querySelectorAll(".reason-list .reason-trace").length===3 && !!(document.querySelector(".insights").compareDocumentPosition(document.querySelector("#history-panel")) & Node.DOCUMENT_POSITION_FOLLOWING)')
wait_for('!!document.querySelector("#personal-reading, .personal-reading")')
reading_audit = js('''(()=>{
 const saved=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)),result=FateData.calculateResult(saved.answers);
 const readings=FateReading.buildAnswerReading(saved.answers,result),container=document.querySelector('#personal-reading, .personal-reading');
 window.__qaReadings=readings;
 const validEvidence=e=>Number.isInteger(e.questionIndex)&&e.questionIndex>=0&&e.questionIndex<FateData.QUESTIONS.length&&e.answerText===FateData.QUESTIONS[e.questionIndex].options[saved.answers[e.questionIndex]].text&&FateData.QUESTIONS[e.questionIndex].category!=='culture'&&!FateData.QUESTIONS[e.questionIndex].options[saved.answers[e.questionIndex]].neutral;
 return {count:readings.length,deterministic:JSON.stringify(readings)===JSON.stringify(FateReading.buildAnswerReading(saved.answers,result)),
 actualAnswers:readings.every(r=>r.title&&r.text&&Array.isArray(r.evidence)&&r.evidence.length>=2&&new Set(r.evidence.map(e=>e.questionIndex)).size>=2&&r.evidence.every(validEvidence)),
 rendered:!!container&&readings.every(r=>container.textContent.includes(r.title)&&container.textContent.includes(r.text)),
 linked:!!container&&readings.every(r=>r.evidence.every(e=>[...container.querySelectorAll('[data-action="review-question"], [data-action="review-reading-question"]')].some(b=>Number(b.dataset.index)===e.questionIndex)))};
})()''')
checks.append({'check':'personal reading is supported by repeated actual answers and rendered evidence links','pass':2<=reading_audit['count']<=3 and all(reading_audit[k] for k in ('deterministic','actualAnswers','rendered','linked')),'details':reading_audit})
if not checks[-1]['pass']: raise AssertionError('Personal reading evidence failed')
reading_links=js('[...document.querySelector("#personal-reading, .personal-reading").querySelectorAll(\'[data-action="review-question"], [data-action="review-reading-question"]\')].map((e,i)=>({index:Number(e.dataset.index),position:i}))')
for link in reading_links:
    position=link['position']
    js(f'document.querySelector("#personal-reading, .personal-reading").querySelectorAll(\'[data-action="review-question"], [data-action="review-reading-question"]\')[{position}].click()')
    wait_for('document.querySelector("#modal").open && !!document.querySelector(".answer-trace")')
    check(f'personal evidence for question {link["index"]+1} opens the actual saved answer', f'(()=>{{const saved=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY));return document.querySelector(".answer-trace").textContent.includes(FateData.QUESTIONS[{link["index"]}].options[saved.answers[{link["index"]}]].text)}})()')
    click('[data-action="close"]')
check('radar explains the axes', 'document.querySelectorAll(".axis-endpoints dt").length===6')
check('mobile result fits', 'document.documentElement.scrollWidth<=innerWidth')
screenshot('result-mobile-v9.png')
click('.reason-list .reason-trace')
check('reason shows the exact saved answer','(()=>{const saved=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY));const i=Number(document.querySelector(".reason-list .reason-trace").dataset.index);return document.querySelector(".answer-trace").textContent.includes(FateData.QUESTIONS[i].options[saved.answers[i]].text)})()')
screenshot('answer-evidence-mobile-v9.png',False)
click('[data-action="close"]')
viewport(1440,1050)
screenshot('result-desktop-v9.png')
click('[data-action="result-tab"][data-tab="history"]')
check('history retains its sources', 'document.querySelector("#result-lore-content .source-link").href.startsWith("https:")')
screenshot('result-history-desktop-v9.png')
click('[data-action="result-tab"][data-tab="fate"]')
check('Fate profile retains noble phantasm data', '!!document.querySelector(".np-command-card") && !!document.querySelector(".np-name h3")')
js('window.__qaCanvasText=[];window.__qaOriginalFillText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__qaCanvasText.push(String(text));return window.__qaOriginalFillText.call(this,text,...args)}')
click('[data-action="share"]')
wait_for('!!document.querySelector(".share-preview") && document.querySelector(".share-preview").complete')
check('PNG drawing includes the stable Master code', f'window.__qaCanvasText.some(text=>text.includes({json.dumps(master_code)}))')
js('CanvasRenderingContext2D.prototype.fillText=window.__qaOriginalFillText')
check('share exports 1080px image', 'document.querySelector(".share-preview").naturalWidth===1080')
check('saved card includes a full 1920px record', 'document.querySelector(".share-preview").naturalHeight===1920')
check('phone preview is a real standalone PNG', 'document.querySelector(".share-preview").src.startsWith("data:image/png;base64,")')
check('image keeps its native long-press menu', 'document.querySelector(".share-preview").dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true})) && getComputedStyle(document.querySelector(".share-preview")).pointerEvents!=="none"')
check('PNG download has a useful filename', 'document.querySelector(".share-actions a[download]").download.includes(document.querySelector("#result-name").textContent) && document.querySelector(".share-actions a[download]").download.endsWith(".png")')
png=js('document.querySelector(".share-preview").src.split(",")[1]')
(OUT/'summoning-record-v9.png').write_bytes(base64.b64decode(png))
download_dir=OUT/'downloads-v9'
download_dir.mkdir(exist_ok=True)
download_name=js('document.querySelector(".share-actions a[download]").download')
download_file=download_dir/download_name
if download_file.exists(): download_file.unlink()
cdp('Browser.setDownloadBehavior',{'behavior':'allow','downloadPath':str(download_dir.resolve())})
click('.share-actions a[download]')
deadline=time.monotonic()+8
while not download_file.exists() and time.monotonic()<deadline: time.sleep(.08)
download_ok=download_file.exists() and download_file.read_bytes()==base64.b64decode(png)
checks.append({'check':'downloaded PNG matches the long-press preview','pass':download_ok})
if not download_ok: raise AssertionError('PNG download failed')
viewport(390,844,True)
check('phone save dialog fits the viewport', 'document.querySelector("#modal").getBoundingClientRect().right<=innerWidth && document.querySelector(".share-preview").getBoundingClientRect().width<=innerWidth')
screenshot('save-record-mobile-v9.png',False)
cdp('Input.dispatchKeyEvent',{'type':'rawKeyDown','key':'Escape','code':'Escape','windowsVirtualKeyCode':27,'nativeVirtualKeyCode':27})
cdp('Input.dispatchKeyEvent',{'type':'keyUp','key':'Escape','code':'Escape','windowsVirtualKeyCode':27,'nativeVirtualKeyCode':27})
wait_for('!document.querySelector("#modal").open')
click('[data-action="share"]')
wait_for('document.querySelector("#modal").open && !!document.querySelector(".share-preview") && document.querySelector(".share-preview").complete')
check('save preview can be reopened after Escape', 'document.querySelector(".share-preview").naturalHeight===1920')
click('[data-action="close"]')
click('[data-action="archive"]')
wait_for('document.querySelectorAll(".archive-card").length===24')
check('all 24 servants remain available', 'document.querySelectorAll(".archive-card").length===24')
js('document.querySelector("#origin-filter").value="历史人物";document.querySelector("#origin-filter").dispatchEvent(new Event("change"))')
check('history filter works', 'document.querySelectorAll(".archive-card").length>0 && [...document.querySelectorAll(".archive-origin")].every(e=>e.textContent.includes("历史人物"))')
viewport(390,844,True)
screenshot('archive-mobile-v9.png')

# A second run verifies reduced motion and that leaving a summoning cancels it.
cdp('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
js('document.querySelector(".brand").click()')
wait_for('!!document.querySelector(".hero")')
click('[data-action="last-result"]')
wait_for('!!document.querySelector("#result-name")')
click('[data-action="review"]')
wait_for('!!document.querySelector(".question-body")')
check('review uses reduced motion', 'matchMedia("(prefers-reduced-motion: reduce)").matches')
for i in range(question_count - 1):
    wait_for(at_question(i))
    click('[data-action="next"]')
    wait_for(at_question(i+1))
click('[data-action="next"]')
wait_for('!!document.querySelector(".ritual-view")')
wait_for('!!document.querySelector("#reveal-button") && !document.querySelector("#reveal-button").hidden && !document.querySelector("#reveal-button").disabled')
js('document.querySelector(\'[data-action="unveil"]\').click();document.querySelector(".brand").click()')
wait_for('!!document.querySelector(".hero")')
time.sleep(.8)
check('leaving the reveal cancels the pending result transition', '!!document.querySelector(".hero") && !document.querySelector("#result-name")')

audit=js('''(()=>{
 const {QUESTIONS,STAGES,SERVANTS,AXES,calculateResult,STORAGE_KEY}=FateData;
 const stageIndex=q=>typeof q.stage==='number'?q.stage:STAGES.findIndex(s=>s.id===q.stage);
 const actualCount=q=>q.options.filter(o=>!o.neutral).length;
 const answers=QUESTIONS.map((q,i)=>q.options.some(o=>o.neutral)?q.options.findIndex(o=>o.neutral):q.type==='scale'?3:i%q.options.length);
 const a=calculateResult(answers),b=calculateResult(answers);
 const scales=QUESTIONS.filter(q=>q.type==='scale'),cultures=QUESTIONS.filter(q=>q.category==='culture');
 const intimacy=QUESTIONS.filter(q=>q.category==='intimacy'),wars=QUESTIONS.filter(q=>q.category==='war');
 const ordinary=QUESTIONS.filter(q=>q.type!=='scale'&&q.category!=='culture');
 const counts=[...new Set(ordinary.map(actualCount))].sort();
 const stageCounts=STAGES.map((_,i)=>QUESTIONS.filter(q=>stageIndex(q)===i).length);
 const intimacyCounts=STAGES.map((_,i)=>intimacy.filter(q=>stageIndex(q)===i).length);
 const warCounts=STAGES.map((_,i)=>wars.filter(q=>stageIndex(q)===i).length);
 const visibleText=q=>[q.title,q.statement,q.context,...q.options.flatMap(o=>[o.label,o.text])].filter(Boolean).join(' ').toLocaleLowerCase();
 const validInspiration=q=>{const i=q.inspiration,s=SERVANTS.find(s=>s.id===i?.servantId);return !!s&&!!i.story?.trim()&&!!i.kind?.trim()&&(i.sourceUrl||'').startsWith('https://')&&![s.name,s.en].filter(Boolean).some(name=>visibleText(q).includes(name.toLocaleLowerCase()));};
 const identity=FateIdentity.generateMasterCode('旅人'),last=QUESTIONS.at(-1);
 const readings=FateReading.buildAnswerReading(answers,a);
 return {questions:QUESTIONS.length,servants:SERVANTS.length,key:STORAGE_KEY,stages:STAGES.length,stageCounts,intimacyCounts,warCounts,ordinaryOptionCounts:counts,
 deterministic:a.best.id===b.best.id&&JSON.stringify(a.scores)===JSON.stringify(b.scores)&&JSON.stringify(a.reasons)===JSON.stringify(b.reasons),
 nameDoesNotAffectScores:JSON.stringify(a.scores)===JSON.stringify(calculateResult(answers,'另一个昵称').scores),
 fourContinuousChapters:STAGES.length===4&&stageCounts.every(n=>n===6)&&QUESTIONS.every((q,i)=>stageIndex(q)===Math.floor(i/(QUESTIONS.length/STAGES.length))),
 roleAndAuthority:STAGES.every(s=>typeof s.role==='string'&&s.role.trim()&&typeof s.authority==='string'&&s.authority.trim())&&QUESTIONS.every(q=>typeof q.role==='string'&&q.role.trim()&&typeof q.authority==='string'&&q.authority.trim())&&new Set(wars.map(q=>q.role)).size>=4,
 threeIntimacyPrompts:intimacy.length===3&&JSON.stringify(intimacyCounts)===JSON.stringify([2,0,1,0]),
 sevenCitedAnonymousWarPrompts:wars.length===7&&JSON.stringify(warCounts)===JSON.stringify([0,6,1,0])&&wars.every(validInspiration),
 traceable:a.evidence.length===3&&a.evidence.every(e=>e.answerText===QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].text&&!QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].neutral),
 threeNeutralPreferences:cultures.length===3&&cultures.every(q=>q.weight===0.4&&q.options.filter(o=>o.neutral).length===1&&q.options.filter(o=>o.neutral).every(o=>Object.values(o.scores).every(v=>v===0))),
 neutralOnlyInCulture:QUESTIONS.every(q=>!q.options.some(o=>o.neutral)||q.category==='culture'),
 twoSevenPointScales:scales.length===2&&scales.every(q=>q.options.length===7&&q.weight===0.75&&q.statement===q.title&&!q.options.some(o=>o.neutral)&&Object.values(q.options[3].scores).every(v=>v===0)),
 mixedOrdinaryCounts:counts.length>1&&ordinary.every(q=>actualCount(q)>=2&&actualCount(q)<=5),
 finalGrailWish:last.category==='wish'&&actualCount(last)>=2&&actualCount(last)<=5&&last.options.length<=5&&/圣杯/.test(visibleText(last))&&!last.options.some(o=>o.neutral),
 personalReadingTraceable:readings.length>=2&&readings.length<=3&&readings.every(r=>r.evidence.length>=2&&new Set(r.evidence.map(e=>e.questionIndex)).size>=2&&r.evidence.every(e=>e.answerText===QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].text&&QUESTIONS[e.questionIndex].category!=='culture')),
 identityDeterministic:JSON.stringify(identity)===JSON.stringify(FateIdentity.generateMasterCode('旅人'))&&FateIdentity.generateMasterCode('　旅人　').code===identity.code,
 identityFourLanguages:new Set(Array.from({length:256},(_,i)=>FateIdentity.generateMasterCode('御主'+i).languageTag)).size===4};
})()''')
audit_fields=('deterministic','nameDoesNotAffectScores','fourContinuousChapters','roleAndAuthority','threeIntimacyPrompts','sevenCitedAnonymousWarPrompts','traceable','threeNeutralPreferences','neutralOnlyInCulture','twoSevenPointScales','mixedOrdinaryCounts','finalGrailWish','personalReadingTraceable','identityDeterministic','identityFourLanguages')
checks.append({'check':'v9 four-chapter question bank, identity and evidence contract','pass':audit['questions']==24 and audit['servants']==24 and audit['key'].endswith('v9') and all(audit[k] for k in audit_fields),'details':audit})
build_bytes=(ROOT/'index.html').read_bytes()
output={'checks':checks,'runtimeErrors':errors,'motion':motion,'screenshots':sorted(p.name for p in OUT.glob('*-v9.png')),'build':{'bytes':len(build_bytes),'sha256':hashlib.sha256(build_bytes).hexdigest()}}
(OUT/'report-v9.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'runtimeErrors':errors,'motion':motion,'audit':audit},ensure_ascii=False,indent=2))
ws.close()
if errors or not all(c['pass'] for c in checks):
    raise SystemExit(1)
