"""Loads every page at several widths and reports JavaScript errors, missing files and sideways scrolling.
Run with the site served on http://localhost:8766 (see README)."""
from playwright.sync_api import sync_playwright
BASE="http://localhost:8766"
pages=["index","services","locations","book","work","reviews","faq","contact","terms","404","admin/index"]
widths=[320,375,414,768,1024,1280,1536]
with sync_playwright() as p:
    b=p.chromium.launch(); problems=0
    for w in widths:
        ctx=b.new_context(viewport={"width":w,"height":800}); ctx.add_init_script("sessionStorage.setItem('fn_welcome','1')")
        for name in pages:
            pg=ctx.new_page(); errs=[]; bad=[]
            pg.on("console",lambda m,e=errs: e.append(m.text[:140]) if m.type=="error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "404" not in m.text else None)
            pg.on("pageerror",lambda x,e=errs: e.append("PAGEERR "+str(x)[:200]))
            pg.on("response",lambda r,bd=bad: bd.append(r.url.split("8766")[-1]) if r.status>=400 and "/api/" not in r.url else None)
            pg.goto(f"{BASE}/{name}.html" if name!="admin/index" else f"{BASE}/admin/"); pg.wait_for_timeout(800)
            ov=pg.evaluate("""()=>{const W=innerWidth,bad=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.width>0&&(r.right>W+1)){const cs=getComputedStyle(e);if(cs.position!=='fixed'&&!e.closest('.jump-row,.welcome,.w-bubbles,dialog,.nav,.sr-only,.hp,.skip,.scroll-x'))bad.append?0:bad.push(e.tagName+'.'+String(e.className).slice(0,30)+' r='+Math.round(r.right))}});return {sw:document.documentElement.scrollWidth,W,bad:bad.slice(0,4)}}""")
            if ov["sw"]>ov["W"]+1 or errs or bad or ov["bad"]:
                problems+=1; print(w,name,"OVERFLOW" if ov["sw"]>ov["W"]+1 else "",ov["sw"],ov["bad"],errs[:3],bad[:3])
            pg.close()
        ctx.close()
    print("problems:",problems); b.close()
