"""Local Chrome DevTools smoke test; browser must listen on 127.0.0.1:9333.
This test uses its own temporary Chrome profile and only opens this project's page.
"""
from pathlib import Path
import base64
import json
import time
import urllib.request
import websocket

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'qa'
OUT.mkdir(exist_ok=True)
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
pages = json.load(opener.open('http://127.0.0.1:9333/json', timeout=10))
page = next(p for p in pages if p['type'] == 'page')
ws = websocket.create_connection(page['webSocketDebuggerUrl'], origin='http://localhost:9333', timeout=30, http_no_proxy=['127.0.0.1','localhost'])
seq = 0
errors = []
checks = []

def cdp(method, params=None):
    global seq
    seq += 1
    message_id = seq
    ws.send(json.dumps({'id':message_id,'method':method,'params':params or {}}))
    while True:
        message = json.loads(ws.recv())
        if message.get('method') == 'Runtime.exceptionThrown':
            errors.append(message['params']['exceptionDetails'])
        if message.get('id') == message_id:
            if 'error' in message: raise RuntimeError(message['error'])
            return message.get('result',{})

def js(expression):
    response = cdp('Runtime.evaluate',{'expression':expression,'returnByValue':True,'awaitPromise':True,'userGesture':True})
    if 'exceptionDetails' in response: raise RuntimeError(response['exceptionDetails'])
    return response.get('result',{}).get('value')

def check(label, condition):
    value = js(condition)
    checks.append({'check':label,'pass':bool(value)})
    if not value: raise AssertionError(label)

def viewport(width,height,mobile=False):
    cdp('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':mobile})

def screenshot(name,full=True):
    js('Promise.all([...document.images].map(image=>{image.loading="eager";return image.decode().catch(()=>{});})).then(()=>true)')
    time.sleep(.15)
    params={'format':'png','captureBeyondViewport':True}
    if full:
        size=cdp('Page.getLayoutMetrics')['cssContentSize']
        params['clip']={'x':0,'y':0,'width':size['width'],'height':min(size['height'],12000),'scale':1}
    image=cdp('Page.captureScreenshot',params)
    (OUT/name).write_bytes(base64.b64decode(image['data']))

def click(selector):
    js(f'document.querySelector({json.dumps(selector)}).click()')

