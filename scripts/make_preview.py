#!/usr/bin/env python3
"""Builds preview.html: the whole site and admin in ONE file, running on the in-browser demo backend.
Usage: python3 scripts/make_preview.py [output.html]"""
import base64, json, os, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
rd = lambda *p: open(os.path.join(root, *p), encoding="utf-8").read()
def b64(path, mime): return "data:%s;base64,%s" % (mime, base64.b64encode(open(os.path.join(root, path), "rb").read()).decode())
css = {n: rd("css", n + ".css") for n in ["base", "site", "book", "admin"]}
js = {n: rd("js", n + ".js") for n in ["pricing", "hours", "docs", "manual", "planner", "seed", "core", "demo", "terms", "api", "site", "home", "booking", "pages", "services", "admin", "theme"]}
mime = {"webp": "image/webp", "png": "image/png", "jpg": "image/jpeg"}
imgs = {f: b64("img/" + f, mime[f.rsplit(".", 1)[1]]) for f in ["logo-mark-128.webp", "logo-disc.webp", "logo-droplet.webp", "logo-sparkle.webp", "logo-word.webp", "logo-word-light.webp", "logo-tag.webp", "logo-tag-light.webp", "logo-email.jpg"]}
pages = {k: rd(*v) for k, v in {"index": ["index.html"], "services": ["services.html"], "locations": ["locations.html"], "book": ["book.html"], "work": ["work.html"], "reviews": ["reviews.html"], "faq": ["faq.html"], "contact": ["contact.html"], "terms": ["terms.html"], "admin": ["admin", "index.html"]}.items()}
shell = r'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>FreshNest Cleaning Services</title>
<style>html,body{margin:0;height:100%;background:#F5FAF8}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;background:#F5FAF8}</style></head><body>
<iframe id="f" title="FreshNest website preview"></iframe>
<script>
var CSS=__CSS__,JS=__JS__,IMG=__IMG__,PAGES=__PAGES__;
var KEYS={"":"index","index.html":"index","admin":"admin","admin/":"admin","admin/index.html":"admin"};
function key(h){h=h.replace(/^(\.\.\/|\.\/|\/)+/,"");var n=h.replace(/\.html$/,"");return KEYS[h]!==undefined?KEYS[h]:(PAGES[n]?n:"index")}
function build(k,q,hash){
  var h=PAGES[k];
  h=h.replace(/<link[^>]*rel="stylesheet"[^>]*href="(?:\.\.\/)?css\/([\w-]+)\.css"[^>]*>/g,function(m,n){return CSS[n]?"<style>"+CSS[n]+"</style>":""});
  h=h.replace(/<link[^>]*rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g,"").replace(/<base[^>]*>/,"");
  var extra=["seed","docs","manual","planner","core","demo"].filter(function(n){return h.indexOf('js/'+n+'.js')<0}).map(function(n){return "<script>"+JS[n]+"<\/script>"}).join("");
  h=h.replace(/<script src="(?:\.\.\/)?js\/([\w-]+)\.js"><\/script>/g,function(m,n){return (n==="api"?extra:"")+"<script>"+JS[n]+"<\/script>"});
  h=h.replace(/(?:\.\.\/)?img\/([\w-]+\.(?:webp|png|jpg))/g,function(m,f){return IMG[f]||m});
  var pre="<script>window.FN_ALLOW_DEMO=true;window.FN_PAGE='"+(k==="index"?"/":"/"+k)+"';window.FN_QUERY='"+(q||"")+"';window.FN_HASH='"+(hash||"")+"';window.FN_LOGO='"+IMG["logo-email.jpg"]+"';<\/script>";
  var post="<script>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a||a.target==='_blank'||e.defaultPrevented||a.hasAttribute('download'))return;var h=a.getAttribute('href');if(!h||/^(https?:|tel:|mailto:|#|data:)/.test(h))return;e.preventDefault();parent.postMessage({fnGo:h},'*')});<\/script>";
  h=h.replace(/<head>/,"<head>"+pre); var i=h.lastIndexOf("</body>"); return h.slice(0,i)+post+h.slice(i);
}
function go(href){var m=href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/),k=key(m[1]),f=document.getElementById("f");f.onload=function(){var d=f.contentDocument;if(m[3]){var el=d.getElementById(m[3].slice(1));if(el)setTimeout(function(){el.scrollIntoView()},300)}};f.srcdoc=build(k,m[2]||"",m[3]||"")}
window.addEventListener("message",function(e){if(e.data&&e.data.fnGo)go(e.data.fnGo)});
go("index.html");
</script></body></html>'''
dump = lambda o: json.dumps(o).replace("</", "<\\/")
out = shell.replace("__CSS__", dump(css)).replace("__JS__", dump(js)).replace("__IMG__", dump(imgs)).replace("__PAGES__", dump(pages))
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "..", "preview.html")
open(dest, "w", encoding="utf-8").write(out); print("wrote", os.path.abspath(dest), round(len(out) / 1024), "KB")
