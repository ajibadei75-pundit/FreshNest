"""Admin journey in a real browser (demo backend): book -> sign in -> confirm -> team -> quote draft -> payment -> receipt -> checklist -> schedule -> settings."""
from datetime import date,timedelta
from playwright.sync_api import sync_playwright
BASE="http://localhost:8766"; errs=[]
def log(*a): print(*a,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1360,"height":900}); ctx.add_init_script("sessionStorage.setItem('fn_welcome','1')")
    pg=ctx.new_page(); pg.on("console",lambda m: errs.append(m.text[:150]) if m.type=="error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "404" not in m.text else None); pg.on("pageerror",lambda e: errs.append("PAGEERR "+str(e)[:240]))
    pg.goto(BASE+"/book.html?city=Lagos&service=fumigation"); pg.wait_for_selector("#tiles .tile"); pg.click("#nextBtn"); pg.click('#presets button:has-text("3 bedrooms")'); pg.click("#nextBtn"); pg.click("#nextBtn")
    pg.fill("#date",(date.today()+timedelta(days=4)).isoformat()); pg.dispatch_event("#date","change"); pg.fill("#street","1 Admiralty Way"); pg.click("#nextBtn"); pg.fill("#name","Tolu Ade"); pg.fill("#phone","08031112222"); pg.fill("#email","tolu@example.com")
    pg.evaluate("document.getElementById('terms').scrollTop=1e5"); pg.wait_for_timeout(400); pg.check("#consent"); pg.click("#sendWa"); pg.wait_for_selector("#success:not([hidden])"); log("booked",pg.inner_text("#refCode"))
    pg.goto(BASE+"/admin/"); pg.wait_for_selector("#adLogin:not([hidden])"); pg.screenshot(path="/tmp/shots/a-login.png")
    pg.fill("#adUser","admin"); pg.fill("#adPw","wrong"); pg.click("#adLoginBtn"); pg.wait_for_timeout(500); log("wrong pw:",pg.inner_text("#adLoginErr"))
    pg.fill("#adPw","demo1234"); pg.click("#adLoginBtn"); pg.wait_for_selector("#adShell:not([hidden])"); pg.wait_for_timeout(1000); pg.screenshot(path="/tmp/shots/a-overview.png"); log("nav:",pg.inner_text("#adNav").replace("\n"," | "))
    pg.click('#adNav button[data-view="bookings"]'); pg.wait_for_selector("#bList tr.click"); pg.click("#bList tr.click"); pg.wait_for_selector("#adDlg[open]"); pg.wait_for_timeout(300)
    pg.fill("#aPrice","72000"); pg.click('[data-do="confirm"]'); pg.wait_for_timeout(900); log("status:",pg.inner_text("#adDlgBody .sp-pill"))
    pg.fill("#aTeam","Tunde and Ngozi"); pg.click('[data-do="assign"]'); pg.wait_for_timeout(700); log("team saved:",pg.input_value("#aTeam"))
    pg.click("[data-quote]"); pg.wait_for_selector("#qMsg"); pg.wait_for_timeout(400); q=pg.input_value("#qMsg"); log("quote has price/scope/team-free:", "₦72,000" in q, "Anything not listed will not be done" in q, "| source line:",pg.inner_text("#adDlgBody header p")[:70]); pg.screenshot(path="/tmp/shots/a-quote.png"); pg.click("#qBack"); pg.wait_for_selector('[data-do="pay"]')
    pg.fill("#pAmt","30000"); pg.select_option("#pMethod","Bank transfer"); pg.fill("#pRef","TRF-9981"); pg.click('[data-do="pay"]'); pg.wait_for_selector("#dFrame"); pg.wait_for_timeout(900); pg.screenshot(path="/tmp/shots/a-receipt.png")
    fr=pg.frame_locator("#dFrame"); log("receipt:",fr.locator("h1").inner_text(),"| balance row:",fr.locator("text=Balance due").count()); pg.click("#dSend"); pg.wait_for_timeout(900); log("emailed:",pg.evaluate("FNDemo.mailbox()[0].subject"))
    pg.click("#dBack"); pg.wait_for_selector('[data-doc="checklist"]'); pg.click('[data-doc="checklist"]'); pg.wait_for_selector(".ck-edit"); pg.wait_for_timeout(700); pg.fill("#ckNew","Seal the gap by the back door"); pg.click("#ckAdd"); pg.wait_for_timeout(500); pg.screenshot(path="/tmp/shots/a-checklist.png")
    html=pg.frame_locator("#dFrame").locator("body").inner_text(); log("checklist:", "Seal the gap" in html, "| team shown:", "Tunde and Ngozi" in html, "| safety prep:", "Remove or tightly cover food" in html, "| agreement:", "Everything listed here will be attended to" in html)
    pg.click("#dSend"); pg.wait_for_timeout(900); log("checklist emailed:",pg.evaluate("FNDemo.mailbox()[0].subject")); pg.evaluate("document.getElementById('adDlg').close()")
    pg.click('#adNav button[data-view="schedule"]'); pg.wait_for_selector(".upc [data-ref]"); pg.screenshot(path="/tmp/shots/a-schedule.png"); log("schedule jobs:",pg.locator(".upc [data-ref]").count())
    pg.click('#adNav button[data-view="settings"]'); pg.wait_for_selector("#cityRows .prow"); pg.wait_for_timeout(500); pg.screenshot(path="/tmp/shots/a-settings.png"); log("fumigation prices in settings:",pg.locator('[data-path="pricing.fumigation.pests.termites.price"]').count(),"| preview:",pg.inner_text("#prevEst")[:150])
    pg.click('#adNav button[data-view="overview"]'); pg.wait_for_timeout(1000); log("ERRORS:",errs[:6]); b.close()
