"""Customer journey in a real browser: AI description -> form filled -> book -> emails (demo backend)."""
from playwright.sync_api import sync_playwright
BASE="http://localhost:8766"; errs=[]
def log(*a): print(*a,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1280,"height":900}); ctx.add_init_script("sessionStorage.setItem('fn_welcome','1')")
    pg=ctx.new_page(); pg.on("console",lambda m: errs.append(m.text[:150]) if m.type=="error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "404" not in m.text else None); pg.on("pageerror",lambda e: errs.append("PAGEERR "+str(e)[:200]))
    pg.goto(BASE+"/book.html#ai"); pg.wait_for_selector("#tiles .tile"); pg.wait_for_timeout(900)
    log("services offered:",pg.locator("#tiles .tile").count(),"| fumigation tile:",pg.locator('#tiles .tile:has-text("Fumigation")').count())
    pg.fill("#aiText","We have cockroaches and termites in our 3 bedroom house in Osogbo, the kitchen is very bad. Please fumigate tomorrow."); pg.click("#aiGo"); pg.wait_for_selector("#aiResult:not([hidden])"); pg.wait_for_timeout(600)
    log("AI chose:",pg.evaluate("document.querySelector('input[name=type]:checked').value"),"| city:",pg.input_value("#city"),"| date:",pg.input_value("#date"),"| cond:",pg.evaluate("document.querySelector('input[name=cond]:checked').value"),"| pests:",pg.evaluate("[...document.querySelectorAll('input[name=pests]:checked')].map(i=>i.value)"))
    log("AI result text:",pg.inner_text("#aiResult").replace("\n"," | ")[:330]); pg.screenshot(path="/tmp/shots/f-ai.png")
    pg.click("#nextBtn"); pg.wait_for_timeout(500); log("rooms step title:",pg.inner_text("#roomsTitle"),"| pest groups visible:",pg.locator(".grp-pest:visible").count(),"| home rooms hidden:",not pg.locator("#roomsHome").is_visible()); pg.screenshot(path="/tmp/shots/f-rooms.png")
    log("price:",pg.inner_text("#priceNum"),"|",pg.inner_text("#priceNote")); pg.click("#nextBtn"); pg.wait_for_timeout(400); log("extras hidden for fumigation:",not pg.locator(".grp-extras").first.is_visible()); pg.click("#nextBtn"); pg.wait_for_timeout(400)
    pg.fill("#street","7 Ring Road"); pg.click("#nextBtn"); pg.wait_for_timeout(400); pg.fill("#name","Tolu Ade"); pg.fill("#phone","08031112222"); pg.fill("#email","tolu@example.com")
    pg.evaluate("document.getElementById('terms').scrollTop=1e5"); pg.wait_for_timeout(500); pg.check("#consent"); log("scope shown:",pg.inner_text("#scope").replace("\n"," | ")[:260]); pg.screenshot(path="/tmp/shots/f-review.png")
    pg.click("#sendEmail"); pg.wait_for_selector("#success:not([hidden])"); pg.wait_for_timeout(900); log("SUCCESS:",pg.inner_text("#refCode"),"| calendar link:",pg.locator("#successCal").count(),"| ics ok:",(pg.get_attribute("#successCal","href") or "").startswith("data:text/calendar")); pg.screenshot(path="/tmp/shots/f-success.png")
    log("emails:",pg.evaluate("FNDemo.mailbox().map(m=>m.to+' :: '+m.subject)"))
    log("ERRORS:",errs[:5]); b.close()
