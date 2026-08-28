/* ============================================================
   CMS LOADER — shared content loader for Fly Fit Jags.

   Usage (one line in any page, before </body>):
     <script src="/assets/cms-loader.js" data-page="my-page-slug" defer></script>

   It fetches /assets/content/<slug>.json and applies:
     - data-cms-field="dot.path"  -> element text (textContent)
     - data-cms-link="dot.path"   -> element href (safe schemes only)

   Graceful fallback: if the JSON is missing or a field isn't in it, the
   static HTML stays exactly as written — a bad content file can never
   blank a page or break a link. That is also why placeholder markers like
   [[DONATE_URL]] are safe to leave in the JSON: they fail the href test,
   so the button keeps whatever the HTML says until a real URL is set.

   IMPORTANT FOR ANYONE EDITING COPY BY HAND:
   the JSON wins. Changing text in the HTML alone will look right for a
   moment and then get overwritten when this script runs. Change BOTH, or
   change it in the admin console (which writes the JSON for you).

   To make a new page admin-editable:
     1. Tag its text:   <h2 data-cms-field="hero.headline">...</h2>
        ...and links:   <a data-cms-link="hero.ctaUrl" href="...">
     2. This script:    <script src="/assets/cms-loader.js" data-page="slug" defer></script>
     3. Seed content:   assets/content/<slug>.json  (copy of the current text + hrefs)
     4. Register it:    add { slug, name, url } to assets/content/manifest.json
   The admin console picks it up from the manifest automatically.
   ============================================================ */

(() => {
  const script = document.currentScript;
  const slug = script && script.dataset ? script.dataset.page : null;
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return;

  const getByPath = (obj, path) =>
    path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);

  // Only hrefs a public site legitimately needs. Anything else (javascript:, data:,
  // an unfilled [[MARKER]]) is ignored and the static href stays.
  const isSafeHref = (v) => /^(https?:\/\/|\/|#|tel:|mailto:|sms:)/i.test(String(v).trim());

  const apply = (data) => {
    if (!data || typeof data !== 'object') return;
    document.querySelectorAll('[data-cms-field]').forEach((el) => {
      if (el.dataset.cmsType) return;
      const val = getByPath(data, el.dataset.cmsField);
      if (typeof val === 'string' && val.trim()) el.textContent = val;
    });
    document.querySelectorAll('[data-cms-link]').forEach((el) => {
      const val = getByPath(data, el.dataset.cmsLink);
      if (typeof val === 'string' && val.trim() && isSafeHref(val)) el.setAttribute('href', val.trim());
    });
  };

  const run = () => {
    fetch('/assets/content/' + slug + '.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(slug + '.json not found (' + r.status + ')'); return r.json(); })
      .then(apply)
      .catch((err) => { console.warn('[cms-loader] using static fallback copy:', err); });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
