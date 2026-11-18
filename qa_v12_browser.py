"""Focused v12 mobile controls, visible servant stories and profile checks.

Run after building index.html, with an isolated project Chrome on port 9333.
The script changes only that test browser's local answer storage.
"""
import hashlib

from qa_cdp import *


def wait_for(expression, timeout=10):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if js(expression):
            return
        time.sleep(.035)
    raise AssertionError('Timed out: ' + expression)


def reload_home():
    cdp('Page.reload')
    wait_for('typeof FateLore!=="undefined" && !!document.querySelector(".hero")')


def at_question(index):
    return f'document.querySelector(".question-body")?.dataset.questionIndex==="{index}" && document.querySelector(".question-body").getAttribute("aria-busy")!=="true"'


# Check rendered labels and CSS-generated content, not the key names used by
# accessible keyboard navigation. Detached/hidden controls do not count.
no_control_arrows = r'''(()=>{
 const arrow=/[\u2190-\u21ff\u2794\u279c\u27a1]/;
 const visible=e=>e.getClientRects().length>0 && getComputedStyle(e).visibility!=="hidden";
 return ![...document.querySelectorAll("button,a")].filter(visible).some(e=>
   arrow.test(e.textContent) || ["::before","::after"].some(p=>arrow.test(getComputedStyle(e,p).content))) &&
   ![...document.querySelectorAll(".arrow,.runner-arrow")].some(visible);
})()'''


cdp('Page.enable')
cdp('Runtime.enable')
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})
viewport(390,844,True)
cdp('Page.navigate', {'url':(ROOT/'index.html').as_uri()})
wait_for('typeof FateLore!=="undefined" && !!document.querySelector(".hero")')
js('localStorage.clear()')
reload_home()
check('v12 uses the same 32-question answers with the new matching version',
      'FateData.QUESTIONS.length===32 && FateData.STORAGE_KEY==="fate-summoning-contract-v11" && FateData.MATCHING_VERSION==="evidence-and-behavior-v12"')
check('all 24 servants have original game introductions and sourced famous stories', '''(()=>{
 const lore=FateLore.SERVANT_LORE;
 return Object.keys(lore).length===FateData.SERVANTS.length && FateData.SERVANTS.every(s=>{
   const l=lore[s.id],f=l?.famousStory;
   return l?.gameIntro?.length>=35 && l.gameIntro!==s.summary && l.gameIntro!==s.compatibility &&
     l.gameSourceUrl?.startsWith("https://") && l.gameSourceLabel?.trim() &&
     f?.title?.trim() && f.text?.length>=35 && f.text!==s.origin.text &&
     f.kind?.trim() && f.sourceLabel?.trim() && f.sourceUrl?.startsWith("https://");
 });
})()''')
check('fictional people and uncertain legends keep the right story category', '''(()=>{
 const l=FateLore.SERVANT_LORE;
 return /作品/.test(l.emiya.famousStory.kind) && /作品/.test(l.mash.famousStory.kind) &&
   /传说/.test(l.kojiro.famousStory.kind);
})()''')
check('new-test home controls have no decorative arrows', no_control_arrows)

click('[data-action="setup"]')
check('mobile registration controls have no decorative arrows', no_control_arrows)
js('document.querySelector("#master-name").value="星辰验收";document.querySelector("#setup-form").requestSubmit()')
wait_for(at_question(0))
click('[data-action="answer"][data-index="0"]')
time.sleep(.15)
check('answer selection still waits for confirmation without arrow controls',
      at_question(0) + ' && !document.querySelector("#next-question").disabled && ' + no_control_arrows)
click('[data-action="next"]')
wait_for(at_question(1))
click('[data-action="previous"]')
wait_for(at_question(0))
check('text-only Previous still returns to the selected answer',
      '''document.querySelector(".option[data-index='0']").getAttribute("aria-pressed")==="true"''')
click('[data-action="save-exit"]')
wait_for('!!document.querySelector(".hero")')
for width in (320,390):
    viewport(width,844,True)
    check(f'Continue last test fits {width}px and contains no arrow',
          'document.documentElement.scrollWidth<=innerWidth && document.querySelector("[data-action=resume]")?.textContent.trim()==="继续上次测试" && ' + no_control_arrows)
    screenshot(f'home-resume-{width}-v12.png')

# Inspect the chapter transition once with normal motion. A fresh answer after
# the last choice in chapter one opens the transient chapter heading.
js('localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({version:1,name:"星辰验收",answers:FateData.QUESTIONS.map((q,i)=>i<7?0:null),index:7,completed:false}))')
reload_home()
click('[data-action="resume"]')
wait_for(at_question(7))
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'no-preference'}]})
click('[data-action="answer"][data-index="0"]')
click('[data-action="next"]')
wait_for('!!document.querySelector(".quiz-chapter")')
check('chapter Continue is a text label without a decorative arrow', no_control_arrows)
click('[data-action="chapter-continue"]')
wait_for(at_question(8))
cdp('Emulation.setEmulatedMedia', {'features':[{'name':'prefers-reduced-motion','value':'reduce'}]})

# Use the real model for the visible result; no servant is forced into storage.
js('localStorage.setItem(FateData.STORAGE_KEY,JSON.stringify({version:1,name:"星辰验收",answers:FateData.QUESTIONS.map((q,i)=>q.type==="scale"?6:i%q.options.length),index:31,completed:true}))')
reload_home()
click('[data-action="last-result"]')
wait_for('!!document.querySelector(".servant-overview [data-game-intro]") && !!document.querySelector(".servant-overview [data-famous-story]")')
best_id=js('FateData.calculateResult(JSON.parse(localStorage.getItem(FateData.STORAGE_KEY)).answers).best.id')
best_literal=json.dumps(best_id)
check('result introduces the actual summoned servant and famous story', f'''(()=>{{
 const l=FateLore.SERVANT_LORE[{best_literal}],o=document.querySelector(".servant-overview");
 return o.querySelector("[data-game-intro]").textContent.includes(l.gameIntro) &&
   o.querySelector("[data-famous-story]").textContent.includes(l.famousStory.text) &&
   o.textContent.includes(l.famousStory.title) && o.textContent.includes(l.famousStory.kind);
}})()''')
check('both stories are expanded directly after the result card and before answer readings', '''(()=>{
 const o=document.querySelector(".servant-overview"),card=document.querySelector(".result-layout"),reading=document.querySelector("#personal-reading");
 return !!(card.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING) &&
   !!(o.compareDocumentPosition(reading)&Node.DOCUMENT_POSITION_FOLLOWING) &&
   [o.querySelector("[data-game-intro]"),o.querySelector("[data-famous-story]")].every(e=>
     e.getClientRects().length && e.getBoundingClientRect().height>30 && !e.closest("details:not([open])"));
})()''')
check('the visible overview provides both source links', f'''(()=>{{
 const l=FateLore.SERVANT_LORE[{best_literal}],links=[...document.querySelectorAll(".servant-overview a")];
 return [l.gameSourceUrl,l.famousStory.sourceUrl].every(u=>links.some(a=>a.href===new URL(u).href));
}})()''')
for width in (320,390):
    viewport(width,844,True)
    time.sleep(.1)
    check(f'expanded result stories fit {width}px without control arrows',
          'document.documentElement.scrollWidth<=innerWidth && document.querySelector(".servant-overview").scrollWidth<=document.querySelector(".servant-overview").clientWidth+1 && ' + no_control_arrows)
    js('document.querySelector(".servant-overview").scrollIntoView({block:"start",behavior:"instant"})')
    screenshot(f'servant-stories-{width}-v12.png',False)

click('[data-action="result-tab"][data-tab="history"]')
check('history tab shows the famous story together with the existing origin', f'''(()=>{{
 const text=document.querySelector("#result-lore-content").textContent,l=FateLore.SERVANT_LORE[{best_literal}],s=FateData.SERVANTS.find(s=>s.id==={best_literal});
 return text.includes(l.famousStory.text) && text.includes(s.origin.text);
}})()''')
click('[data-action="result-tab"][data-tab="fate"]')
check('game tab shows the character introduction and existing battle information',
      f'document.querySelector("#result-lore-content").textContent.includes(FateLore.SERVANT_LORE[{best_literal}].gameIntro) && !!document.querySelector("#result-lore-content .np-name h3")')

click('[data-action="share"]')
wait_for('document.querySelector(".share-preview")?.complete')
check('text-only Save still creates the full phone PNG with no arrow controls',
      'document.querySelector(".share-preview").naturalWidth===1080 && document.querySelector(".share-preview").naturalHeight===1920 && document.querySelector(".share-preview").src.startsWith("data:image/png;base64,") && ' + no_control_arrows)
(OUT/'summoning-record-v12.png').write_bytes(base64.b64decode(js('document.querySelector(".share-preview").src.split(",")[1]')))
click('[data-action="close"]')
click('[data-action="archive"]')
wait_for('!!document.querySelector("#archive-grid")')
check('mobile archive controls have no decorative arrows', no_control_arrows)

# Verify both tabs for all servants through the same detail action users use.
# Store one aggregate audit instead of counting every paragraph as a separate test.
detail_audit=[]
for servant_id in js('FateData.SERVANTS.map(s=>s.id)'):
    js(f'document.querySelector(\'[data-action="detail"][data-id="{servant_id}"]\').click()')
    wait_for('document.querySelector("#modal").open && !!document.querySelector("#detail-content")')
    game_ok=js(f'document.querySelector("#detail-content").textContent.includes(FateLore.SERVANT_LORE[{json.dumps(servant_id)}].gameIntro) && !!document.querySelector("#detail-content .np-name h3")')
    click('[data-action="detail-tab"][data-tab="history"]')
    history_ok=js(f'document.querySelector("#detail-content").textContent.includes(FateLore.SERVANT_LORE[{json.dumps(servant_id)}].famousStory.text)')
    ui_ok=js('document.querySelector("#modal").getBoundingClientRect().right<=innerWidth+1 && document.documentElement.scrollWidth<=innerWidth && '+no_control_arrows)
    detail_audit.append({'id':servant_id,'gameIntro':game_ok,'famousStory':history_ok,'mobileControls':ui_ok})
    click('[data-action="close"]')
checks.append({'check':'all 24 archive details render game introductions and famous stories with clean mobile controls',
               'pass':len(detail_audit)==24 and all(all(row[k] for k in ('gameIntro','famousStory','mobileControls')) for row in detail_audit),
               'details':detail_audit})
if not checks[-1]['pass']:
    raise AssertionError('An archive detail failed to show its full sourced lore')

js('localStorage.clear()')
reload_home()
viewport(1440,1050)
build_bytes=(ROOT/'index.html').read_bytes()
output={'checks':checks,'runtimeErrors':errors,'summonedServant':best_id,
        'build':{'bytes':len(build_bytes),'sha256':hashlib.sha256(build_bytes).hexdigest()}}
(OUT/'report-ui-v12.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'passed':sum(c['pass'] for c in checks),'runtimeErrors':errors,
                  'summonedServant':best_id},ensure_ascii=False))
ws.close()
if errors or not all(c['pass'] for c in checks):
    raise SystemExit(1)
