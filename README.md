# Runway: free money-runway toolkit

Plain static site (HTML/CSS/vanilla JS). No build step, no backend, no dependencies.
Upload this folder as-is to GitHub Pages, Cloudflare Pages or Netlify (publish directory = this folder's root).

## Files
- `index.html`: home
- `runway-calculator.html`: savings runway calculator (`assets/js/runway.js`)
- `budget-trimmer.html`: budget trimmer (`assets/js/trimmer.js`)
- `job-tracker.html`: job application tracker with CSV export (`assets/js/tracker.js`)
- `about.html`, `privacy.html`, `contact.html`, `404.html`
- `assets/js/core.js`: all calculation logic (pure functions, also used by the tests)
- `assets/css/style.css`, `favicon.svg`, `assets/og-image.png`
- `sitemap.xml`, `robots.txt`, `ads.txt`
- `tests/core.test.js`: run with `node tests/core.test.js`

## Before you launch
1. **Domain:** replace every `https://space-emporium.github.io/runway` (all `.html` heads, `sitemap.xml`, `robots.txt`) with your real URL, e.g.
   `grep -rl "https://space-emporium.github.io/runway" . | xargs sed -i 's#https://space-emporium.github.io/runway#https://YOURDOMAIN#g'`
   A free `*.pages.dev`, `*.netlify.app` or `*.github.io` URL works.
2. **Contact:** replace `hello@example.com` in `contact.html`.
3. **AdSense** (apply once the site is live and has some content/traffic):
   - In each page's `<head>`, uncomment the `adsbygoogle.js` loader and put in your `ca-pub-…` ID.
   - In each `<aside class="ad-slot">`, uncomment the `<ins class="adsbygoogle">` block, set `data-ad-client` and `data-ad-slot`, and delete the `<span class="ad-label">Ad space</span>` placeholder.
   - In `ads.txt`, uncomment the `google.com, pub-…` line and set your ID.
   - In AdSense > Privacy & messaging, turn on Google's free consent message (needed for EEA/UK/Swiss visitors). The privacy policy already describes it.
   - Or skip slot setup and just use AdSense Auto ads. The dashed placeholders are only visual; remove them if you go that way.
4. Submit `sitemap.xml` in Google Search Console (free).

## Privacy model
All user data lives in `localStorage` under the keys `runway.calculator.v1`, `runway.trimmer.v1`, `runway.jobs.v1` and `runway.profile`. Nothing is sent anywhere.
