"""Admin job planner in a real browser (demo backend): chat -> plan -> tabs -> adjust -> save to a booking -> email quotation."""
from datetime import date,timedelta
from playwright.sync_api import sync_playwright
BASE="http://localhost:8766"; errs=[]
def log(*a): print(*a,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={"width":1360,"height":1000}); ctx.add_init_script("sessionStorage.setItem('fn_welcome','1')")
    pg=ctx.new_page(); pg.on("console",lambda m: errs.append(m.text[:150]) if m.type=="error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "404" not in m.text else None); pg.on("pageerror",lambda e: errs.append("PAGEERR "+str(e)[:240]))
    pg.goto(BASE+"/book.html?service=construction&city=Ibadan"); pg.wait_for_selector("#tiles .tile"); pg.click("#nextBtn"); pg.click("#nextBtn"); pg.click("#nextBtn")
    pg.fill("#date",(date.today()+timedelta(days=5)).isoformat()); pg.dispatch_event("#date","change"); pg.fill("#street","3 Bodija Estate"); pg.fill("#instructions","Dried emulsion paint splashes on the bathroom tiles after painting, about 15 m2"); pg.click("#nextBtn")
    pg.fill("#name","Ngozi Eze"); pg.fill("#phone","08055550000"); pg.fill("#email","ngozi@example.com"); pg.evaluate("document.getElementById('terms').scrollTop=1e5"); pg.wait_for_timeout(400); pg.check("#consent"); pg.click("#sendEmail"); pg.wait_for_selector("#success:not([hidden])"); ref=pg.inner_text("#refCode"); log("booked",ref)
    pg.goto(BASE+"/admin/"); pg.wait_for_selector("#adLogin:not([hidden])"); pg.fill("#adUser","admin"); pg.fill("#adPw","demo1234"); pg.click("#adLoginBtn"); pg.wait_for_selector("#adShell:not([hidden])"); pg.wait_for_timeout(600)
    log("tabs:",pg.inner_text("#adNav").replace("\n"," | "))
    pg.click('#adNav button[data-view="bookings"]'); pg.wait_for_selector("#bList tr.click"); pg.click("#bList tr.click"); pg.wait_for_selector('[data-plan="new"]'); pg.click('[data-plan="new"]'); pg.wait_for_selector("#plMsgs"); pg.wait_for_timeout(500)
    log("prefilled from booking notes -> area/stain already read:", pg.inner_text("#plMsgs").count("Planning for booking"), "| asked first:", pg.locator(".bub.bot").last.inner_text()[:80])
    def say(t):
        pg.fill("#plIn",t); pg.click("#plSend"); pg.wait_for_timeout(700)
    for t in ["Glazed ceramic tile","Ground level"]:
        if pg.locator("#plIn").count(): say(t)
    pg.wait_for_selector("#plOut .pl-banner"); log("decision:",pg.inner_text("#plOut .pl-banner")[:110])
    for t in ["Occupied","Nothing special","Two technicians and a wet vac","No deadline"]:
        say(t)
    pg.wait_for_timeout(600); pg.screenshot(path="/tmp/shots/pl-quote.png",full_page=True)
    log("quote kpi:",pg.inner_text("#plOut .pl-price .kpi b").split("\n")[0] if pg.locator("#plOut .pl-price").count() else "none","| message has scope:", "Anything not listed will not be done" in pg.input_value("#plQuote"))
    pg.click('#plTabs button[data-t="crew"]'); pg.wait_for_timeout(300); log("crew tab:",pg.inner_text("#plOut table.pl-tbl").replace("\n"," ")[:140]); pg.screenshot(path="/tmp/shots/pl-crew.png",full_page=True)
    pg.click('#plTabs button[data-t="proc"]'); pg.wait_for_timeout(300); log("procedure has SOP steps:", pg.inner_text("#plOut").count("Lift softened paint")>0, "| test patch:", "test patch" in pg.inner_text("#plOut").lower()); pg.screenshot(path="/tmp/shots/pl-proc.png",full_page=True)
    pg.click('#plTabs button[data-t="cost"]'); pg.wait_for_timeout(300); log("cost tab rows:",pg.locator("#plOut table.pl-tbl tr").count()); q1=pg.inner_text("#plOut table.pl-tbl tr.tot >> nth=1")
    pg.fill('[data-c="technician"]',"4"); pg.dispatch_event('[data-c="technician"]',"change"); pg.wait_for_timeout(900); log("after sending 4 technicians:",pg.inner_text("#plOut table.pl-tbl tr.tot >> nth=1")==q1 and "unchanged?" or "plan updated")
    pg.click("#plSaveMail"); pg.wait_for_timeout(1200); log("emails:",pg.evaluate("FNDemo.mailbox().slice(0,2).map(m=>m.subject)"))
    pg.click("#plPrintJ2") if pg.locator("#plPrintJ2").count() else None
    pg.click('#adNav button[data-view="settings"]'); pg.wait_for_selector('[data-path="planner.marginPct"]'); pg.wait_for_timeout(500); log("settings planner fields:",pg.locator('[data-path^="planner."]').count(),"| machine cost/hr shown:",pg.locator("[data-cph]").first.inner_text())
    pg.screenshot(path="/tmp/shots/pl-settings.png"); log("ERRORS:",errs[:6]); b.close()
