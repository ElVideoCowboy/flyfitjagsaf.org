# flyfitjagsaf.org

Static site for **Fly Fit Jags Athletic Foundation**, hosted on Cloudflare Pages,
with a password-protected admin console that lets a non-developer edit the website
text and links from a browser.

Same framework as elvideocowboy.com. If you know that repo, you know this one.

---

## How it works in one paragraph

`index.html` is a plain, self-contained HTML page — no build step, no framework.
Every piece of editable text carries a `data-cms-field="dot.path"` attribute and every
editable link carries `data-cms-link="dot.path"`. On page load, `assets/cms-loader.js`
fetches `assets/content/home.json` and overwrites those elements with whatever the JSON
says. The admin console at `/admin` loads the real page in an iframe, makes those same
elements directly editable, and on **Save & Publish** commits the updated JSON back to
GitHub through the Contents API. Cloudflare Pages sees the commit and redeploys. Live
in about a minute, no developer involved.

> **The one rule that matters.** The JSON wins. If you edit copy in `index.html` alone,
> it will look right for a split second and then get overwritten when the loader runs.
> Change **both** the HTML and `assets/content/home.json`, or make the change in the
> admin console (which writes the JSON for you).

---

## File map

```
flyfitjagsaf.org/
├── index.html                    the entire public site (one page, anchor nav)
├── 404.html
├── robots.txt  ·  sitemap.xml
├── admin/
│   ├── index.html                CMS — live-preview editing, Save & Publish
│   └── login.html                email + password
├── assets/
│   ├── cms-loader.js             applies the JSON over the HTML at load time
│   ├── content/
│   │   ├── home.json             ← all editable copy lives here
│   │   └── manifest.json         which pages the admin console offers
│   └── images/                   put logo.png here (see README.txt inside)
├── functions/                    Cloudflare Pages Functions (the API)
│   ├── _lib/auth.js              PBKDF2 hashing + HMAC session tokens
│   ├── _lib/mail.js              Resend wrapper
│   ├── admin/_middleware.js      blocks /admin/* at the edge without a session
│   └── api/
│       ├── login.js  logout.js  me.js
│       ├── save.js               commits content JSON to GitHub
│       └── contact.js            homepage form → email
└── scripts/
    └── generate-admin-hash.js    run locally to make ADMIN_PASSWORD_HASH
```

---

## Setup, start to finish

### 1. Put it on GitHub

```
cd flyfitjagsaf.org
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin git@github.com:<owner>/flyfitjagsaf.org.git
git push -u origin main
```

### 2. Create the Cloudflare Pages project

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
pick the repo, then:

| Setting | Value |
|---|---|
| Production branch 