"""Focused v11 320/390px result, identity, scale and reading layout checks.
Run only after the full QA suite, using the same isolated Chrome instance.
"""
import hashlib

from qa_cdp import *

def wait_for(expression, timeout=7):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        if js(expression): return
        time.sleep(.035)
    raise AssertionError(expression)

def reload_home():
    cdp('Page.reload')
    wait_for('!!document.querySelector(".hero")')

cdp('Page.enable')
cdp('Runtime.enable')
cdp('Page.navigate', {'url': (ROOT/'index.html').as_uri()})
wait_for('typeof FateIdentity!=="undefined" && typeof FateReading!=="undefined" && !!document.querySelector(".hero")')
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
js('localStorage.clear()')
reload_home()
question_count=js('FateData.QUESTIONS.length')
last_index=question_count-1
scale_indices=js('FateData.QUESTIONS.map((q,i)=>q.type==="scale"?i:null).filter(i=>i!==null)')
stage_starts=js('FateData.QUESTIONS.map((q,i)=>i===0||q.stage!==FateData.QUESTIONS[i-1].stage?i:null).filter(i=>i!==null)')
actor_indices=js('FateData.QUESTIONS.map((q,i)=>q.category==="war"?i:null).filter(i=>i!==null)')
check('v11 layout loads four eight-question chapters','FateData.STAGES.length===4 && FateData.QUESTIONS.length===32')
identities=js('''(()=>{const found={};for(let i=0;i<1000;i++){const name='星尘'+i,identity=FateIdentity.generateMasterCode(name);if(!found[identity.languageTag]||identity.code.length>found[identity.languageTag].code.length)found[identity.languageTag]={name,...identity};}return found;})()''')
viewport(320,760,True)
click('[data-action="setup"]')
check('identity preview has no code-generation explanation','!document.querySelector(".code-origin-note")')
for language,identity in identities.items():
    js(f'document.querySelector("#master-name").value={json.dumps(identity["name"])};document.querySelector("#master-name").dispatchEvent(new Event("input",{{bubbles:true}}))')
    check(language+' long code fits the narrow setup', '(()=>{const e=document.querySelector(".master-code-value"),m=document.querySelector("#modal");return e.scrollWidth<=e.clientWidth+1 && m.getBoundingClientRect().right<=innerWidth && document.documentElement.scrollWidth<=innerWidth})()')
    if language=='fr': screenshot('setup-french-320-v12.png')
click('[data-action="close"]')

name=identities['fr']['name']
def seed_question(index):
    js(f'''localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({{version:1,name:{json.dumps(name)},answers:FateData.QUESTIONS.map((q,i)=>i<{index}?0:null),index:{index},completed:false}}))''')
    reload_home()
    if index == 0:
        # A saved name with no answers is not resumable progress. Start through
        # the actual setup flow, keeping the long identity used for layout QA.
        click('[data-action="setup"]')
        js('document.querySelector("#setup-form").requestSubmit()')
    else:
        click('[data-action="resume"]')
    wait_for(f'document.querySelector(".question-body")?.dataset.questionIndex==="{index}" && document.querySelector(".question-body").getAttribute("aria-busy")!=="true"')

# Audit every war scene, chapter entry and the final wish.
for index in sorted(set(stage_starts + actor_indices + [last_index])):
    seed_question(index)
    for width in (320,390):
        viewport(width,844,True)
        time.sleep(.15)
        check(f'current actor identity at question {index+1} fits {width}px', f'(()=>{{const q=FateData.QUESTIONS[{index}],stageIndex=typeof q.stage==="number"?q.stage:FateData.STAGES.findIndex(s=>s.id===q.stage),role=document.querySelector("#quiz-aside .stage-role, #quiz-aside [data-stage-role]");return document.documentElement.scrollWidth<=innerWidth&&!!role&&role.textContent.includes(q.role)&&getComputedStyle(role).display!=="none"&&role.getBoundingClientRect().height>0}})()')
        check(f'question {index+1} controls clear the options at {width}px','document.querySelector(".quiz-bottom").getBoundingClientRect().top>=document.querySelector(".options").getBoundingClientRect().bottom')
        screenshot(f'chapter-{index+1}-{width}-v12.png')

for index in scale_indices:
    seed_question(index)
    for width in (320,390):
        viewport(width,844,True)
        time.sleep(.15)
        check(f'scale {index+1} at {width}px fits and stays unselected','document.documentElement.scrollWidth<=innerWidth && !document.querySelector(".question-role") && document.querySelectorAll(".agreement-scale [role=radio]").length===7 && [...document.querySelectorAll(".scale-option")].every(e=>e.getAttribute("aria-checked")==="false" && e.getBoundingClientRect().width>=30)')
        screenshot(f'scale-{index+1}-{width}-v12.png')
    click('[data-action="answer"][data-index="6"]')
    time.sleep(.9)
    check(f'scale {index+1} still awaits Continue', f'document.querySelector(".question-body").dataset.questionIndex==="{index}" && !document.querySelector("#next-question").disabled')
    screenshot(f'scale-{index+1}-selected-v12.png')

js(f'''localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({{version:1,name:{json.dumps(name)},answers:FateData.QUESTIONS.map((q,i)=>q.type==='scale'?6:i%q.options.length),index:{last_index},completed:true}}))''')
reload_home()
click('[data-action="last-result"]')
wait_for('!!document.querySelector(".result-master-code")')
viewport(320,844,True)
check('long French code fits result', 'document.documentElement.scrollWidth<=innerWidth && document.querySelector(".result-master-code").scrollWidth<=document.querySelector(".result-master-code").clientWidth+1')
check('personal reading and evidence links fit narrow results','(()=>{const r=document.querySelector("#personal-reading, .personal-reading");return !!r&&r.scrollWidth<=r.clientWidth+1&&r.querySelectorAll(\'[data-action="review-question"], [data-action="review-reading-question"]\').length>=4})()')
for width in (320,390):
    viewport(width,844,True)
    check(f'matching result fits {width}px', 'document.documentElement.scrollWidth<=innerWidth && document.querySelector(".result-master-code").scrollWidth<=document.querySelector(".result-master-code").clientWidth+1')
    screenshot(f'result-french-{width}-v12.png')
click('[data-action="share"]')
wait_for('!!document.querySelector(".share-preview") && document.querySelector(".share-preview").complete')
png=js('document.querySelector(".share-preview").src.split(",")[1]')
(OUT/'summoning-record-french-v12.png').write_bytes(base64.b64decode(png))
check('long French code PNG has intended dimensions','document.querySelector(".share-preview").naturalWidth===1080 && document.querySelector(".share-preview").naturalHeight===1920')
click('[data-action="close"]')
js('localStorage.clear()')
reload_home()
viewport(1440,1050)
build_bytes=(ROOT/'index.html').read_bytes()
output={'checks':checks,'runtimeErrors':errors,'identities':identities,'build':{'bytes':len(build_bytes),'sha256':hashlib.sha256(build_bytes).hexdigest()}}
(OUT/'report-layout-v12.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'runtimeErrors':errors},ensure_ascii=False))
ws.close()
if errors or not all(c['pass'] for c in checks): raise SystemExit(1)
