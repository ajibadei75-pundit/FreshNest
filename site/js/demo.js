/* Demo backend: runs the real backend code inside the browser, saving to localStorage. Used only on localhost and in the shared preview. */
(function () {
  "use strict";
  var PREFIX = "fn_demo:", MAIL_KEY = "fn_demo_mail";
  var db = {
    get: function (c, id) { try { var v = localStorage.getItem(PREFIX + c + ":" + id); return Promise.resolve(v ? JSON.parse(v) : null); } catch (e) { return Promise.resolve(null); } },
    set: function (c, id, v) { try { localStorage.setItem(PREFIX + c + ":" + id, JSON.stringify(v)); } catch (e) {} return Promise.resolve(); },
    del: function (c, id) { try { localStorage.removeItem(PREFIX + c + ":" + id); } catch (e) {} return Promise.resolve(); },
    list: function (c) { var out = [], p = PREFIX + c + ":"; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(p) === 0) out.push(JSON.parse(localStorage.getItem(k))); } } catch (e) {} return Promise.resolve(out); }
  };
  var mail = { send: function (m) { var box = []; try { box = JSON.parse(localStorage.getItem(MAIL_KEY) || "[]"); } catch (e) {} box.unshift({ at: new Date().toISOString(), to: m.to, subject: m.subject, html: m.html, text: m.text }); try { localStorage.setItem(MAIL_KEY, JSON.stringify(box.slice(0, 30))); } catch (e) {} return Promise.resolve(); } };
  var PASSWORD = "demo1234", USERNAME = "admin";
  window.FNDemo = {
    password: PASSWORD, username: USERNAME,
    install: function () {
      var app = window.FreshnestCore.createApp({ db: db, mail: mail, ai: null, env: { ADMIN_PASSWORD: PASSWORD, ADMIN_USERNAME: USERNAME, AUTH_SECRET: "demo-secret" } }), realFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = new URL(typeof input === "string" ? input : input.url, /^https?:/.test(location.href) ? location.href : "https://demo.local/");
        if (url.pathname.indexOf("/api/") < 0) return realFetch(input, init);
        url.pathname = url.pathname.slice(url.pathname.indexOf("/api/")); return app.handle(new Request(url.toString(), init));
      };
    },
    mailbox: function () { try { return JSON.parse(localStorage.getItem(MAIL_KEY) || "[]"); } catch (e) { return []; } },
    reset: function () { try { Object.keys(localStorage).filter(function (k) { return k.indexOf(PREFIX) === 0 || k === MAIL_KEY; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} location.reload(); }
  };
})();
