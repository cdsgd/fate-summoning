"""Focused 320/390px identity and agreement-scale visual checks."""
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
wait_for('typeof FateIdentity!=="undefined" && !!document.querySelector(".hero")')
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
js('localStorage.clear()')
reload_home()
identities=js('''(()=>{const found={};for(let i=0;i<1000;i++){const name='星尘'+i,identity=FateIdentity.generateMasterCode(name);if(!found[identity.languageTag]||identity.code.length>found[identity.languageTag].code.length)found[identity.languageTag]={name,...identity};}return found;})()''')
viewport(320,760,True)
click('[data-action="setup"]')
for language,identity in identities.items():
    js(f'document.querySelector("#master-name").value={json.dumps(identity["name"])};document.querySelector("#master-name").dispatchEvent(new Event("input",{{bubbles:true}}))')
    check(language+' long code fits the narrow setup', '(()=>{const e=document.querySelector(".master-code-value"),m=document.querySelector("#modal");return e.scrollWidth<=e.clientWidth+1 && m.getBoundingClientRect().right<=innerWidth && document.documentElement.scrollWidth<=innerWidth})()')
    if language=='fr': screenshot('setup-french-320-v7.png')
click('[data-action="close"]')

name=identities['fr']['name']
def seed_question(index):
    js(f'''localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({{version:1,name:{json.dumps(name)},answers:FateData.QUESTIONS.map((q,i)=>i<{index}?0:null),index:{index},completed:false}}))''')
    reload_home()
    click('[data-action="resume"]')
    wait_for(f'document.querySelector(".question-body")?.dataset.questionIndex==="{index}" && document.querySelector(".question-body").getAttribute("aria-busy")!=="true"')

for index in (5,17):
    seed_question(index)
    for width in (320,390):
        viewport(width,844,True)
        time.sleep(.15)
        check(f'scale {index+1} at {width}px fits and stays unselected','document.documentElement.scrollWidth<=innerWidth && document.querySelectorAll(".agreement-scale [role=radio]").length===7 && [...document.querySelectorAll(".scale-option")].every(e=>e.getAttribute("aria-checked")==="false" && e.getBoundingClientRect().width>=30)')
        screenshot(f'scale-{index+1}-{width}-v7.png')
    click('[data-action="answer"][data-index="6"]')
    time.sleep(.9)
    check(f'scale {index+1} still awaits Continue', f'document.querySelector(".question-body").dataset.questionIndex==="{index}" && !document.querySelector("#next-question").disabled')
    screenshot(f'scale-{index+1}-selected-v7.png')

js(f'''localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({{version:1,name:{json.dumps(name)},answers:FateData.QUESTIONS.map((q,i)=>q.type==='scale'?6:i%q.options.length),index:23,completed:true}}))''')
reload_home()
click('[data-action="last-result"]')
wait_for('!!document.querySelector(".result-master-code")')
viewport(320,844,True)
check('long French code fits result', 'document.documentElement.scrollWidth<=innerWidth && document.querySelector(".result-master-code").scrollWidth<=document.querySelector(".result-master-code").clientWidth+1')
screenshot('result-french-320-v7.png')
click('[data-action="share"]')
wait_for('!!document.querySelector(".share-preview") && document.querySelector(".share-preview").complete')
png=js('document.querySelector(".share-preview").src.split(",")[1]')
(OUT/'summoning-record-french-v7.png').write_bytes(base64.b64decode(png))
check('long French code PNG has intended dimensions','document.querySelector(".share-preview").naturalWidth===1080 && document.querySelector(".share-preview").naturalHeight===1920')
click('[data-action="close"]')
js('localStorage.clear()')
reload_home()
viewport(1440,1050)
output={'checks':checks,'runtimeErrors':errors,'identities':identities}
(OUT/'report-layout-v7.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'runtimeErrors':errors},ensure_ascii=False))
ws.close()
if errors or not all(c['pass'] for c in checks): raise SystemExit(1)
