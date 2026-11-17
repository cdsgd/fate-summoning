"""Exercise the actual local page, including automatic progression and motion.
Run with an isolated Chrome DevTools instance on localhost:9333.
"""
from pathlib import Path
import json
import time

from qa_cdp import *

def wait_for(expression, timeout=7):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if js(expression): return
        time.sleep(.035)
    raise AssertionError('Timed out: ' + expression)

def at_question(index):
    return f'!!document.querySelector(\'.question-body[data-question-index="{index}"]\') && document.querySelector(\'.question-body[data-question-index="{index}"]\').getAttribute("aria-busy")!=="true"'

cdp('Page.enable')
cdp('Runtime.enable')
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'no-preference'}]})
viewport(1440,1050)
cdp('Page.navigate', {'url':(ROOT/'index.html').as_uri()})
wait_for('document.readyState==="complete" && !!document.querySelector(".hero")')
js('localStorage.clear()')
cdp('Page.reload')
wait_for('!!document.querySelector(".hero")')
check('home retains Fate artwork', 'document.querySelectorAll(".preview-card img").length===3')
check('opening has no tutorial sales pitch', '!/(不需要玩过|不必了解|不考历史|没有知识考点|标准答案)/.test(document.querySelector("main").textContent)')
screenshot('home-desktop.png')
viewport(390,844,True)
check('mobile home fits', 'document.documentElement.scrollWidth<=innerWidth')
screenshot('home-mobile.png')
click('[data-action="setup"]')
check('setup is concise', 'document.querySelector("#modal").open && !/(不需要玩过|知识考点|标准答案|这些题关于)/.test(document.querySelector("#modal").textContent)')
screenshot('setup-mobile.png',False)
js('document.querySelector("#master-name").value="旅人";document.querySelector("#setup-form").requestSubmit()')
wait_for(at_question(0))
wait_for('!document.getAnimations().some(a=>a.playState==="running" && a.effect?.target?.classList?.contains("view-enter"))')
check('initial question cannot advance empty', 'document.querySelector("#next-question").disabled')
viewport(320,760,True)
check('320px question fits', 'document.documentElement.scrollWidth<=innerWidth')
viewport(390,844,True)
screenshot('quiz-mobile.png')
check('mobile controls do not cover the last option','document.querySelector(".quiz-bottom").getBoundingClientRect().top>=document.querySelector(".options").getBoundingClientRect().bottom')
check('mobile uses the current scene height without a blank reserve','Math.abs(document.querySelector("#quiz-question-slot").getBoundingClientRect().height-document.querySelector(".question-body").getBoundingClientRect().height)<3')
js('window.__qaShell=document.querySelector(".quiz-shell");window.__qaHUD=document.querySelector(".master-hud");window.__qaTrack=document.querySelector(".stage-track")')

# Inspect every animation frame while the first answer moves to the second.
motion = js('''(async()=>{
 const samples=[]; const start=performance.now();
 document.querySelector('[data-action="answer"][data-index="1"]').click();
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
check('selection automatically advances once', at_question(1))

# Fast selection/next is one action, and the old automatic timer must not fire later.
js('document.querySelector(".quiz-bottom").scrollIntoView({block:"end",behavior:"instant"})')
js('document.querySelector(\'[data-action="answer"][data-index="0"]\').click();document.querySelector(\'[data-action="answer"][data-index="2"]\').click();document.querySelector(\'[data-action="next"]\').click();document.querySelector(\'[data-action="next"]\')?.click()')
wait_for(at_question(2))
time.sleep(.7)
check('rapid next does not skip another question', at_question(2))
check('advancing from the page bottom brings the next scene into view', '(()=>{const r=document.querySelector("#question-title").getBoundingClientRect();return r.top>=0&&r.top<innerHeight*.6})()')
click('[data-action="previous"]')
wait_for(at_question(1))
check('back restores the selected answer', 'document.querySelectorAll(".option")[2].getAttribute("aria-pressed")==="true"')
js('document.querySelector(\'[data-action="answer"][data-index="0"]\').click();document.querySelector(\'[data-action="save-exit"]\').click()')
wait_for('!!document.querySelector(".hero")')
time.sleep(.7)
check('leaving cancels automatic progression', '!!document.querySelector(".hero")')
cdp('Page.reload')
wait_for('!!document.querySelector("[data-action=resume]")')
click('[data-action="resume"]')
wait_for(at_question(2))
check('resume goes to the next unanswered question', at_question(2))

# Complete by automatic progression. Neutral culture choices are real skips.
for i in range(2,18):
    wait_for(at_question(i))
    check(f'question {i+1} fits mobile', 'document.documentElement.scrollWidth<=innerWidth')
    neutral = js(f'FateData.QUESTIONS[{i}].options.findIndex(o=>o.neutral)')
    if neutral>=0:
        check('preference includes an unscored choice', '!!document.querySelector(".option-neutral")')
        screenshot('preference-mobile.png')
        cdp('Input.dispatchKeyEvent',{'type':'keyDown','key':str(neutral+1),'code':f'Digit{neutral+1}'})
        cdp('Input.dispatchKeyEvent',{'type':'keyUp','key':str(neutral+1),'code':f'Digit{neutral+1}'})
    else:
        click(f'[data-action="answer"][data-index="{i%4}"]')
    if i<17: wait_for(at_question(i+1))

wait_for('!!document.querySelector(".ritual-view")')
wait_for('!!document.querySelector("#reveal-button") && !document.querySelector("#reveal-button").hidden && !document.querySelector("#reveal-button").disabled')
screenshot('ritual-mobile.png')
click('[data-action="unveil"]')
wait_for('!!document.querySelector("#reveal-card.is-flipped")')
check('card front is already decoded at reveal', 'document.querySelector(".reveal-front img").complete && document.querySelector(".reveal-front img").naturalWidth>0')
wait_for('!!document.querySelector("#result-name")',10)
check('one reveal click reaches the result', '!!document.querySelector(".summon-card .servant-portrait")')
check('answer reasons precede the profile', 'document.querySelectorAll(".reason-trace").length===3 && !!(document.querySelector(".insights").compareDocumentPosition(document.querySelector("#history-panel")) & Node.DOCUMENT_POSITION_FOLLOWING)')
check('radar explains the axes', 'document.querySelectorAll(".axis-endpoints dt").length===6')
check('mobile result fits', 'document.documentElement.scrollWidth<=innerWidth')
screenshot('result-mobile.png')
click('.reason-trace')
check('reason shows the exact saved answer','(()=>{const saved=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY));const i=Number(document.querySelector(".reason-trace").dataset.index);return document.querySelector(".answer-trace").textContent.includes(FateData.QUESTIONS[i].options[saved.answers[i]].text)})()')
screenshot('answer-evidence-mobile.png',False)
click('[data-action="close"]')
viewport(1440,1050)
screenshot('result-desktop.png')
click('[data-action="result-tab"][data-tab="history"]')
check('history retains its sources', 'document.querySelector("#result-lore-content .source-link").href.startsWith("https:")')
screenshot('result-history-desktop.png')
click('[data-action="result-tab"][data-tab="fate"]')
check('Fate profile retains noble phantasm data', '!!document.querySelector(".np-command-card") && !!document.querySelector(".np-name h3")')
click('[data-action="share"]')
wait_for('!!document.querySelector(".share-preview") && document.querySelector(".share-preview").complete')
check('share exports 1080px image', 'document.querySelector(".share-preview").naturalWidth===1080')
click('[data-action="close"]')
click('[data-action="archive"]')
wait_for('document.querySelectorAll(".archive-card").length===24')
check('all 24 servants remain available', 'document.querySelectorAll(".archive-card").length===24')
js('document.querySelector("#origin-filter").value="历史人物";document.querySelector("#origin-filter").dispatchEvent(new Event("change"))')
check('history filter works', 'document.querySelectorAll(".archive-card").length>0 && [...document.querySelectorAll(".archive-origin")].every(e=>e.textContent.includes("历史人物"))')
viewport(390,844,True)
screenshot('archive-mobile.png')

# A second run verifies reduced motion and that leaving a summoning cancels it.
cdp('Emulation.setEmulatedMedia',{'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
js('document.querySelector(".brand").click()')
wait_for('!!document.querySelector(".hero")')
click('[data-action="last-result"]')
wait_for('!!document.querySelector("#result-name")')
click('[data-action="review"]')
wait_for('!!document.querySelector(".question-body")')
check('review uses reduced motion', 'matchMedia("(prefers-reduced-motion: reduce)").matches')
for i in range(17):
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
 const {QUESTIONS,SERVANTS,AXES,calculateResult,STORAGE_KEY}=FateData;
 const answers=QUESTIONS.map((q,i)=>q.options.findIndex(o=>o.neutral)>=0?q.options.findIndex(o=>o.neutral):i%4);
 const a=calculateResult(answers),b=calculateResult(answers);
 const text=QUESTIONS.map(q=>q.title+' '+q.context+' '+q.options.map(o=>o.text).join(' ')).join(' ');
 return {questions:QUESTIONS.length,servants:SERVANTS.length,key:STORAGE_KEY,deterministic:a.best.id===b.best.id&&JSON.stringify(a.scores)===JSON.stringify(b.scores),noFateKnowledgeGate:!/(御主|圣杯|令咒|灵基|宝具|触媒|职阶)/.test(text),traceable:a.evidence.every(e=>e.answerText===QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].text&&!QUESTIONS[e.questionIndex].options[answers[e.questionIndex]].neutral),threeNeutralPreferences:QUESTIONS.filter(q=>q.options.some(o=>o.neutral)).length===3};
})()''')
checks.append({'check':'new scenario data and traceable matching','pass':audit['questions']==18 and audit['servants']==24 and audit['key'].endswith('v4') and all(audit[k] for k in ('deterministic','noFateKnowledgeGate','traceable','threeNeutralPreferences')),'details':audit})
output={'checks':checks,'runtimeErrors':errors,'motion':motion,'screenshots':sorted(p.name for p in OUT.glob('*.png'))}
(OUT/'report-v4.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'failed':[c for c in checks if not c['pass']],'runtimeErrors':errors,'motion':motion,'audit':audit},ensure_ascii=False,indent=2))
ws.close()
