# ChakriMatch BD 🇧🇩

[![Refresh live circulars](https://github.com/Shazid41/chakrimatch-bd/actions/workflows/update-jobs.yml/badge.svg)](https://github.com/Shazid41/chakrimatch-bd/actions/workflows/update-jobs.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-live-brightgreen)](https://shazid41.github.io/chakrimatch-bd/)

**Tell us your qualification — we find the government jobs you are eligible for.**

A static, no-build job discovery site for Bangladesh government circulars. Fill in your
education profile once, press **🔎 Find Matching Government Jobs**, and every circular
comes back marked ✅ Eligible / ⚠️ Check Requirements / ❌ Not Eligible — *with the reason why*.

▶ **Live site:** https://shazid41.github.io/chakrimatch-bd/

---

## What it does

| Feature | How |
|---|---|
| Profile → one-click matching | Education, degree, CGPA, age, gender, location, skills, experience, job-type preferences stored in `localStorage` |
| **Government bank jobs first** | Bangladesh Bank eRecruitment vacancies get their own 🏦 strip at the very top of the results |
| "Why am I eligible?" | Every job expands into a check-by-check explanation (degree, education level, CGPA, age, gender, experience, location, grade, job type) with a plain verdict |
| Natural-language search | Bangla **and** English — degree, **job type** (`ব্যাংক`, `মন্ত্রণালয়`, `bcs`), **minimum level** (`মাস্টার্স`, `ডিপ্লোমা`), age, relocation, grade, **sort order** (`recent`, `ending soon`), keywords |
| Sorting & paging | Most recent first (default) / ending soonest / best match, and the list is paginated 10 per page with Prev · Next |
| Categories | Browse **By Education**, **By Job Type**, **By Grade** — counts update live |
| Live circulars | `data/jobs.json` is rebuilt from two official sources every 6 hours by GitHub Actions |
| New Job Alerts | In-site notification bell + toasts; site / e-mail / Telegram preference toggles |
| Deadline countdowns | "3 days left", colour-coded when a circular is closing |
| Safe by design | **Apply** only opens the official application website — this site never submits anything |

## Data sources & honesty notes

### 1. Government banks — Bangladesh Bank eRecruitment

`https://erecruitment.bb.org.bd/onlineapp/joblist.php` is plain server-rendered HTML, so
`scraper/bank_jobs.py` can read it with no JavaScript and no API key. That table publishes
**Job ID, post, number of posts, salary scale, the educational requirement in plain text,
fee and deadline** — real fields, not guesses. Bank jobs therefore carry
`degreeSource: "official"` and the engine is allowed to reject them hard (degree,
education level, experience).

**The catch:** the site sits behind Tencent TSPD bot protection, and many networks —
GitHub's runners almost certainly included — get a JavaScript challenge instead of the
table. A successful read is cached in `data/bank_jobs.json` and reused whenever the source
refuses the crawler, and the site says so openly in a warning line above the bank strip
("blocked today's automated read … verify on erecruitment.bb.org.bd"). Applications go
through Bangladesh Bank's own form — our Apply button opens their job list.

### 2. Everything else — Alljobs by Teletalk

`GET /api/v1/govt-jobs/org-list` and `GET /api/v1/govt-jobs/public-details?id=…` on
<https://alljobs.teletalk.com.bd/jobs/government> give title, vacancies, age limit, gender,
application start/deadline, circular PDF and apply URL.

That API **does not publish** educational qualification, grade or salary. Those fields
therefore show `Not published in the summary`, and the required degree is **inferred from
the post title** by rules in `scraper/collect.py`
(`Programmer → CSE/ICT/SWE/IT`, `Assistant Engineer (Civil) → Civil`, `Accountant →
BBA/Accounting/Finance`, `Medical Officer → Medical`, …). Every inferred field is labelled
as such in the UI, and the circular PDF is always one click away so you can confirm.

### 3. Only open circulars are published

Both sources are filtered to `deadline >= today`, so a job that disappears from the list is
one whose application window actually closed — and `generatedAt` moves as soon as that
happens.

## Eligibility engine

`js/matcher.js` is a rule-based, fully explainable engine (no LLM, no server):

- **Hard checks** — degree, education level *(only when the circular publishes one)*,
  CGPA *(only when published)*, age limit, gender, experience. Any failure → ❌ Not
  Eligible, and the failing check is quoted back to you.
- **Soft checks** — location/relocation preference, grade preference, job-type preference.
  Any warning → ⚠️ *Outside your preferences* (we say so plainly: nothing disqualifies you,
  it is only your own filter that does not match).
- **Informational** — skills. Live circulars do not publish a skill list, so these are only
  hints guessed from the title. They are shown for reference and **never** change the verdict.
- Otherwise → ✅ Eligible, with a match percentage = passed checks.

## Admin panel (site owner only)

The *Run crawler now* button, the next-scan countdown and the ⚙️ *Crawler status* panel are
hidden from visitors. Signing in at the bottom of *How It Works* with the owner account
reveals them:

> **Honest limitation:** this is a static site with no server, so there is nothing to check
> a password against. The gate is a UI lock that keeps the interface simple — it is **not**
> real security, and anyone with DevTools can read the source. Do not store anything secret
> here.

## Project layout

```
govt-job-finder/
├── index.html                     # single-page app
├── css/styles.css                 # all styling + responsive breakpoints
├── js/
│   ├── jobs.js                    # constants (majors, labels, grades) + demo fallback data
│   ├── matcher.js                 # eligibility engine + Bangla/English query parser
│   └── app.js                     # state, rendering, live-data loader, alerts, admin gate
├── data/jobs.json                 # ← regenerated by the crawler (live circulars)
├── data/bank_jobs.json            # ← last good Bangladesh Bank read (snapshot)
├── scraper/collect.py             # crawler: both sources → data/jobs.json (stdlib only)
├── scraper/bank_jobs.py           # Bangladesh Bank eRecruitment parser
├── .github/workflows/update-jobs.yml  # runs the crawler every 6 hours
└── .nojekyll                      # serve the folder as-is on GitHub Pages
```

## Run it locally

```bash
# from this folder
python -m http.server 8765
# → http://localhost:8765/
```

Opening `index.html` directly (double-click) also works — the site then falls back to the
bundled demo circulars, because browsers block `fetch()` on `file://`.

Refresh the data yourself:

```bash
python scraper/collect.py             # all live posts → data/jobs.json
python scraper/collect.py --limit 20  # quick sample run
```

## Automatic updates

`.github/workflows/update-jobs.yml` runs the crawler **every 6 hours** (and on demand from
the *Actions* tab). If `data/jobs.json` changed it is committed back to the repository, and
GitHub Pages redeploys — so the live site keeps itself current with no server to maintain.

## How do I know the crawler is working?

Four places to check — the first two need no login:

1. **On the site itself** — the 🟢 line next to the results shows how many organisations,
   bank posts and circulars are loaded and when the data last changed. Sign in as the site
   owner and the ⚙️ *Crawler status* panel appears under *How It Works*, reading GitHub's
   public Actions API live: when the last crawl ran, whether it succeeded, and a link
   straight to that run's log.
2. **Actions tab** — <https://github.com/Shazid41/chakrimatch-bd/actions> lists every run.
   `schedule` = it fired on its own (cron), `workflow_dispatch` = someone clicked *Run
   workflow*. Green ✅ = fine, red ❌ = failed (GitHub also e-mails you about failures).
3. **Commit history** — <https://github.com/Shazid41/chakrimatch-bd/commits/main/> shows
   `github-actions[bot]` committing `data/jobs.json` **only when the circulars really
   changed**. So *no new commit* means "nothing new was published", **not** "the crawler is
   broken" — check the Actions tab for green runs instead.
4. **Badge at the top of this README** — turns red if the workflow starts failing.

Run the health check yourself at any time:

```bash
python scraper/collect.py      # prints "changed": true = new circulars, false = unchanged
python tools/health_report.py  # Actions run history + data freshness in one go
```

## Deploy / re-deploy

The site is plain HTML/CSS/JS with no build step, so any static host works:

1. **GitHub Pages** (used here): *Settings → Pages → Deploy from a branch → `main` / root*.
2. Netlify / Vercel / any web host: drag the folder in, or point it at this repository.

## Disclaimer

Job discovery and eligibility guidance only. Applications are always submitted on the
official recruitment website; always read the official circular PDF before applying.
