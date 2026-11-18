"""Verify calibrated ranking in the actual browser, including saved v9 answers.
Run after qa_v8.py and qa_v8_layout.py with the isolated Chrome on port 9333.
"""
from qa_cdp import *
import hashlib
import argparse

parser=argparse.ArgumentParser()
parser.add_argument('--url',default=(ROOT/'index.html').as_uri())
parser.add_argument('--label',default='v10')
args=parser.parse_args()


def wait_for(expression, timeout=7):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if js(expression): return
        time.sleep(.035)
    raise AssertionError(expression)


def saved_result(answers, name):
    js(f"localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({{version:1,name:{json.dumps(name)},answers:{json.dumps(answers)},index:23,completed:true}}))")
    cdp('Page.reload')
    wait_for('!!document.querySelector(".hero") && typeof FateData!=="undefined"')
    click('[data-action="last-result"]')
    wait_for('!!document.querySelector("#result-name")')
    return js("""(()=>{const answers=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)).answers,r=FateData.calculateResult(answers);return {modelVersion:r.modelVersion,best:r.best.id,name:r.best.name,runners:r.runnersUp.map(s=>s.id),scores:r.scores,reasons:r.reasons,evidence:r.evidence,weakSignal:r.weakSignal,nearTie:r.nearTie,matchGap:r.matchGap,resonance:r.resonance};})()""")


cdp('Page.enable')
cdp('Runtime.enable')
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
viewport(390,844,True)
cdp('Page.navigate', {'url':args.url})
wait_for('typeof FateData!=="undefined" && !!document.querySelector(".hero")')
js('localStorage.clear()')
check('calibrated model preserves the unchanged v9 answer storage', 'FateData.STORAGE_KEY==="fate-summoning-contract-v9"')
check('browser exports the calibrated semantic-direction model', 'FateData.MATCHING_VERSION==="semantic-direction-v10"')
cases=js("""(()=>{let state=0x39f28d17;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296};const found={};for(let i=0;i<4096;i++){const answers=FateData.QUESTIONS.map(q=>Math.floor(random()*q.options.length)),r=FateData.calculateResult(answers),key=r.weakSignal?'weak':r.nearTie?'near':'clear';if(!found[key])found[key]={answers,best:r.best.id,runner:r.runnersUp[0].id,gap:r.matchGap,weakSignal:r.weakSignal,nearTie:r.nearTie};if(found.near&&found.clear&&found.weak)break;}return found;})()""")
if set(cases)!={'near','clear','weak'}: raise AssertionError('Could not find near, clear and weak matching cases')
for label,case in cases.items():
    initial=saved_result(case['answers'],'旅人')
    expected=json.dumps(initial['name'])
    check(f'{label} result displays the calculated best match',f'document.querySelector("#result-name").textContent==={expected}')
    check(f'{label} result displays the calculated runners in order',f'JSON.stringify([...document.querySelectorAll(".runner-card")].map(e=>e.dataset.id))==={json.dumps(json.dumps(initial["runners"],ensure_ascii=False,separators=(",",":")))}')
    check(f'{label} result recomputes saved answers with the new model','FateData.calculateResult(JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)).answers).modelVersion==="semantic-direction-v10"')
    check(f'{label} result has the appropriate matching notice',f'Boolean(document.querySelector(".result-match-note"))==={str(initial["nearTie"] or initial["weakSignal"]).lower()}')
    if initial['weakSignal']:
        check('weak-signal notice takes precedence over near-tie text','document.querySelector(".result-match-note").textContent==="这些选择还没有形成鲜明的整体倾向。这次回应可以作为一种可能，也可以看看下方其他英灵。"')
    elif initial['nearTie']:
        check('near-tie notice names the first runner','(()=>{const a=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)).answers,r=FateData.calculateResult(a);return document.querySelector(".result-match-note").textContent.includes(r.runnersUp[0].name)})()')
    check(f'{label} result evidence uses actual saved answers', '(()=>{const a=JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)).answers,r=FateData.calculateResult(a);return r.evidence.length===3&&r.evidence.every(e=>e.answerText===FateData.QUESTIONS[e.questionIndex].options[a[e.questionIndex]].text)})()')
    for width in (320,390):
        viewport(width,844,True)
        check(f'{label} calibrated result fits {width}px','document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll(".runner-card")].every(e=>e.getBoundingClientRect().right<=innerWidth)')
        screenshot(f'result-{label}-{width}-{args.label}.png')
    repeated=saved_result(case['answers'],'旅人')
    checks.append({'check':label+' same answers and name remain stable after reload','pass':initial==repeated})
    renamed=saved_result(case['answers'],'另一个昵称')
    checks.append({'check':label+' name change cannot change ranking, scores or evidence','pass':initial==renamed})
    if initial!=repeated or initial!=renamed: raise AssertionError('Matching changed for identical answers')
    js('window.__qaCanvasText=[];window.__qaFillText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__qaCanvasText.push(String(text));return window.__qaFillText.call(this,text,...args)}')
    click('[data-action="share"]')
    wait_for('document.querySelector(".share-preview")?.complete')
    check(f'{label} PNG contains the calculated best match',f'window.__qaCanvasText.some(t=>t.includes({expected}))')
    check(f'{label} PNG near-tie note agrees with result',f'window.__qaCanvasText.some(t=>t.startsWith("另一个接近的回应："))==={str(initial["nearTie"] and not initial["weakSignal"]).lower()}')
    check(f'{label} PNG weak-signal note agrees with result',f'window.__qaCanvasText.some(t=>t==="整体倾向尚不鲜明，这次回应只是一种可能")==={str(initial["weakSignal"]).lower()}')
    png=js('document.querySelector(".share-preview").src.split(",")[1]')
    (OUT/f'summoning-record-{label}-{args.label}.png').write_bytes(base64.b64decode(png))
    js('CanvasRenderingContext2D.prototype.fillText=window.__qaFillText')
    click('[data-action="close"]')
js('localStorage.clear()')
cdp('Page.reload')
wait_for('!!document.querySelector(".hero")')
build_bytes=opener.open(args.url,timeout=20).read()
output={'checks':checks,'runtimeErrors':errors,'cases':cases,'build':{'url':args.url,'bytes':len(build_bytes),'sha256':hashlib.sha256(build_bytes).hexdigest()}}
(OUT/f'report-matching-{args.label}.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'runtimeErrors':errors,'cases':cases},ensure_ascii=False))
ws.close()
if errors or not all(c['pass'] for c in checks):raise SystemExit(1)
