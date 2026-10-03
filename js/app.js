/* ============================================================
   ChakriMatch BD — app logic
   ============================================================ */

/* Fixed "today" so demo deadlines stay meaningful */
const TODAY = Date.now() > new Date("2026-09-01").getTime() ? new Date() : new Date("2026-10-02T00:00:00");

const DEFAULT_PROFILE = {
  name: "",
  education: "Bachelor's",
  degree: "B.Sc. in CSE",
  major: "CSE",
  cgpa: "3.50",
  age: "24",
  gender: "male",
  location: "Dhaka",
  experience: "0",
  relocate: "yes",
  skills: ["Programming", "Java", "Python", "Web Development", "Networking", "Database"],
  grades: ["Grade 9", "Grade 10", "Grade 11", "Grade 12", "Grade 13", "Grade 14", "Grade 15", "Grade 16"],
  jobTypes: ["BCS", "ICT Jobs", "Ministry", "Directorate", "Autonomous Organization", "Government Bank", "Non-Cadre"],
  onlyCse: false
};

const state = {
  profile: load("cm_profile", DEFAULT_PROFILE),
  jobs: JOBS.map(j => ({ ...j })),
  meta: { live: false, generatedAt: null, source: null, sourceUrl: null,
          organizations: SOURCES_COUNT, qualificationNote: "" },
  saved: new Set(load("cm_saved", [])),
  notifs: load("cm_notifs", []),
  filters: { edu: [], type: [], grade: [] },
  status: "all",
  sort: "deadline",
  query: null,          // parsed smart query
  queryText: "",
  incomingQueue: INCOMING_JOBS.map(j => ({ ...j })),
  lastScan: Date.now(),
  scanning: false
};

/* ============================================================
   LIVE DATA — data/jobs.json is rebuilt by scraper/collect.py
   (GitHub Actions runs it every 6 hours). If fetch fails
   (e.g. opened via file://) the embedded demo circulars stay.
   ============================================================ */
async function fetchJobsJson() {
  const res = await fetch("data/jobs.json", { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function loadLiveJobs() {
  try {
    const d = await fetchJobsJson();
    if (!d || !Array.isArray(d.jobs) || !d.jobs.length) return false;
    state.jobs = d.jobs.map(j => ({ ...j }));
    state.meta = {
      live: true,
      generatedAt: d.generatedAt || null,
      source: d.source || null,
      sourceUrl: d.sourceUrl || null,
      organizations: d.organizations || SOURCES_COUNT,
      qualificationNote: d.qualificationNote || ""
    };
    return true;
  } catch {
    return false;               // offline / file:// → keep demo circulars
  }
}

/** Re-fetch the JSON and return only circulars we have not seen yet. */
async function refreshLiveData() {
  if (!state.meta.live) return [];
  try {
    const d = await fetchJobsJson();
    if (!d || !Array.isArray(d.jobs)) return [];
    const known = new Set(state.jobs.map(j => j.id));
    const added = d.jobs.filter(j => !known.has(j.id)).map(j => ({ ...j, fresh: true }));
    if (added.length) {
      state.jobs.unshift(...added);
      state.meta.generatedAt = d.generatedAt || state.meta.generatedAt;
    }
    return added;
  } catch {
    return [];
  }
}

function generatedLabel() {
  if (!state.meta.generatedAt) return "not known";
  const t = new Date(state.meta.generatedAt);
  return isNaN(t) ? "not known" : t.toLocaleString("en-GB",
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UTC";
}

function renderSourceInfo() {
  const line = $("#dataSource");
  if (line) {
    line.innerHTML = state.meta.live
      ? `🟢 Live: <b>${state.meta.organizations} organisations</b> · ${state.jobs.length} open circulars · updated ${esc(generatedLabel())}`
      : `🟡 Offline demo mode — open through a web server for live circulars`;
  }
  const src = $("#sourceLine");
  if (src) {
    src.innerHTML = state.meta.live
      ? `Data source: <a href="${esc(state.meta.sourceUrl || "#")}" target="_blank" rel="noopener">${esc(state.meta.source)}</a> — rebuilt automatically every 6 hours.`
      : `Data source: embedded demo circulars (live fetch unavailable).`;
  }
  const pipe = $("#pipeSources");
  if (pipe) pipe.textContent = `${state.meta.organizations} sources`;
  if ($("#statSources")) $("#statSources").textContent = state.meta.organizations;
}

/* ============================================================
   CRAWLER STATUS — read straight from GitHub's public Actions
   API so the site can prove the scheduled job is still running.
   Results are cached for 5 minutes; on failure we fall back to
   the cached copy, then to a plain link to the Actions tab.
   ============================================================ */
const GH_RUNS_URL =
  "https://api.github.com/repos/Shazid41/chakrimatch-bd/actions/workflows/update-jobs.yml/runs?per_page=3";
const GH_ACTIONS_URL = "https://github.com/Shazid41/chakrimatch-bd/actions";

function shortAgo(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} hour${h > 1 ? "s" : ""} ago`;
  return `${Math.floor(h / 24)} day${Math.floor(h / 24) > 1 ? "s" : ""} ago`;
}

async function renderCrawlerStatus() {
  const cached = load("cm_ghruns", null);
  const isFresh = cached && cached.ts && (Date.now() - cached.ts) < 5 * 60000;
  if (isFresh) { paintCrawlerStatus(cached.runs, false); return; }
  try {
    const res = await fetch(GH_RUNS_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
    if (!runs.length) throw new Error("no runs");
    save("cm_ghruns", { ts: Date.now(), runs });
    paintCrawlerStatus(runs, false);
  } catch {
    paintCrawlerStatus(cached && cached.runs, true);   // stale copy or nothing
  }
}

function paintCrawlerStatus(runs, stale) {
  const dot = $("#csDot"), stateEl = $("#csState"), body = $("#csBody");
  if (!dot) return;

  if (!runs || !runs.length) {
    dot.className = "cs-dot unknown";
    stateEl.textContent = stale ? "cached" : "unknown";
    body.innerHTML = `Live status could not be read right now ` +
      `${stale ? "(no saved copy either)" : "(GitHub may be rate-limiting this page)"}. ` +
      `The workflow badge below is served straight from GitHub: ` +
      `<a href="${GH_ACTIONS_URL}" target="_blank" rel="noopener">Actions tab ↗</a>` +
      `<img class="cs-badge" alt="Refresh live circulars workflow status" ` +
      `src="https://github.com/Shazid41/chakrimatch-bd/actions/workflows/update-jobs.yml/badge.svg">`;
    return;
  }

  const r = runs[0];
  const when = new Date(r.created_at);
  const ago = shortAgo(Date.now() - when.getTime());
  const link = `<a href="${esc(r.html_url)}" target="_blank" rel="noopener">run #${r.run_number} ↗</a>`;
  const eventTxt = r.event === "schedule" ? "automatic schedule" :
                   r.event === "workflow_dispatch" ? "manual trigger" : r.event;

  let tone = "ok", stateTxt = "healthy", headline;
  if (r.status !== "completed") {
    tone = "running"; stateTxt = "running";
    headline = `<b>Crawling now</b> — started ${ago} (${eventTxt}). ${link}`;
  } else if (r.conclusion === "success") {
    headline = `<b>Last crawl succeeded</b> ${ago} (${eventTxt}) — ${link}`;
  } else if (r.conclusion === null || r.conclusion === undefined) {
    headline = `<b>Last crawl finished</b> ${ago} — ${link}`;
  } else {
    tone = "fail"; stateTxt = "failed";
    headline = `<b>Last crawl ${esc(r.conclusion)}</b> ${ago} (${eventTxt}) — ` +
               `<a href="${esc(r.html_url)}" target="_blank" rel="noopener">open the log to see why ↗</a>`;
  }

  dot.className = "cs-dot " + tone;
  stateEl.textContent = stateTxt + (stale ? " (cached)" : "");
  body.innerHTML =
    headline +
    `<span class="cs-sub">Scheduled every 6 hours · ${runs.length} most recent runs ` +
    `(<a href="${GH_ACTIONS_URL}" target="_blank" rel="noopener">view all</a>).</span>`;
}

/* ---------------- helpers ---------------- */
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? structuredClone(fallback) : v;
  } catch { return structuredClone(fallback); }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function daysLeft(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return Math.ceil((d - TODAY) / 86400000);
}
function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function agoLabel(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "Last scan: just now";
  if (m < 60) return `Last scan: ${m} minute${m > 1 ? "s" : ""} ago`;
  return `Last scan: ${Math.floor(m / 60)} hour${Math.floor(m / 60) > 1 ? "s" : ""} ago`;
}
const STATUS_META = {
  eligible: { cls: "is-eligible", badge: "match-eligible", label: "✅ Eligible" },
  check: { cls: "is-check", badge: "match-check", label: "⚠️ Check Requirements" },
  not: { cls: "is-not", badge: "match-not", label: "❌ Not Eligible" }
};

/* ============================================================
   PROFILE FORM
   ============================================================ */
function renderForm() {
  const p = state.profile;
  $("#fName").value = p.name || "";
  $("#fEducation").value = p.education;
  $("#fDegree").value = p.degree;
  $("#fCgpa").value = p.cgpa;
  $("#fAge").value = p.age;
  $("#fGender").value = p.gender;
  $("#fLocation").value = p.location;
  $("#fExperience").value = p.experience;
  $("#fRelocate").value = p.relocate;
  $("#fOnlyCse").checked = !!p.onlyCse;

  // major select
  $("#fMajor").innerHTML = MAJORS
    .map(m => `<option value="${m}" ${m === p.major ? "selected" : ""}>${m} — ${DEGREE_LABELS[m]}</option>`)
    .join("");

  renderSkills();
  renderCheckboxes("#jobTypeChecks", JOB_TYPES, p.jobTypes, "type");
  renderCheckboxes("#gradeChecks", GRADES, p.grades, "grade");
}

function renderSkills() {
  $("#skillsBox").innerHTML = state.profile.skills.map(s => `
    <span class="skill-tag">${esc(s)}<button type="button" data-skill="${esc(s)}" aria-label="remove">✕</button></span>`).join("");
}

function renderCheckboxes(sel, options, selected, group) {
  $(sel).innerHTML = options.map(o => `
    <label><input type="checkbox" data-group="${group}" value="${esc(o)}" ${selected.includes(o) ? "checked" : ""}/> ${esc(o)}</label>
  `).join("");
}

function readForm() {
  const p = state.profile;
  p.name = $("#fName").value.trim();
  p.education = $("#fEducation").value;
  p.degree = $("#fDegree").value.trim();
  p.major = $("#fMajor").value;
  p.cgpa = $("#fCgpa").value;
  p.age = $("#fAge").value;
  p.gender = $("#fGender").value;
  p.location = $("#fLocation").value.trim();
  p.experience = $("#fExperience").value;
  p.relocate = $("#fRelocate").value;
  p.onlyCse = $("#fOnlyCse").checked;
  save("cm_profile", p);
  return p;
}

/* ============================================================
   FILTERS / CATEGORIES
   ============================================================ */
const EDU_GROUPS = ["All Graduates", "CSE", "ICT", "EEE", "Civil", "Mechanical", "BBA", "Accounting", "Finance", "Economics", "English", "Law", "Medical", "Pharmacy", "Statistics", "Science", "General"];

function jobMatchesEdu(job, edu) {
  return job.requiredDegrees.includes(edu) || job.edu === edu ||
    (edu === "CSE" && job.requiredDegrees.includes("ICT")) ||
    (edu === "ICT" && job.requiredDegrees.includes("CSE"));
}

/** Live summaries do not publish a grade → a grade query must not wipe out the list. */
function gradesArePublished() {
  return state.jobs.some(j => j.grade && j.grade !== "Other");
}

function buildFilterGroup(sel, options, key, counter) {
  const list = $(sel).querySelector(".filter-list");
  list.innerHTML = options.map(o => {
    const n = state.jobs.filter(j => counter(j, o)).length;
    if (n === 0 && !["CSE", "ICT", "EEE", "Civil"].includes(o)) return "";
    return `<label><input type="checkbox" data-fkey="${key}" value="${esc(o)}" ${state.filters[key].includes(o) ? "checked" : ""}/> ${esc(o)} <span class="cnt">${n}</span></label>`;
  }).join("");
}

function renderFilters() {
  buildFilterGroup("#eduFilter", EDU_GROUPS, "edu", (j, o) => jobMatchesEdu(j, o));
  buildFilterGroup("#typeFilter", JOB_TYPES, "type", (j, o) => j.type === o || j.edu === o);
  buildFilterGroup("#gradeFilter", GRADES, "grade", (j, o) => j.grade === o);
}

function renderCategories() {
  const blocks = [
    { title: "By Education", sub: "Department / degree অনুযায়ী", key: "edu", opts: EDU_GROUPS, counter: (j, o) => jobMatchesEdu(j, o) },
    { title: "By Job Type", sub: "সেবার ধরন অনুযায়ী", key: "type", opts: JOB_TYPES, counter: (j, o) => j.type === o || j.edu === o },
    { title: "By Grade", sub: "গ্রেড অনুযায়ী", key: "grade", opts: GRADES, counter: (j, o) => j.grade === o }
  ];
  $("#categoryGrid").innerHTML = blocks.map(b => {
    const items = b.opts.map(o => {
      const n = state.jobs.filter(j => b.counter(j, o)).length;
      if (n === 0) return "";
      if (b.key === "grade" && o === "Other") return "";   // "unpublished" is not a grade
      return `<button class="cat-item" data-key="${b.key}" data-val="${esc(o)}">${esc(o)} <span class="cnt">${n}</span></button>`;
    }).join("");
    const note = (b.key === "grade" && items.indexOf("Grade") === -1 && !state.jobs.some(j => j.grade && j.grade !== "Other"))
      ? `<div class="cat-note">Grade কেবল circular PDF-এ থাকে — summary data-তে নেই। প্রতিটা job-এর “📄 View Circular” খুলে দেখুন।</div>`
      : "";
    return `
    <div class="cat-block">
      <h3>${b.title}</h3>
      <div class="cat-sub">${b.sub}</div>
      <div class="cat-items">${items}</div>
      ${note}
    </div>`;
  }).join("");
}

/* ============================================================
   RESULTS
   ============================================================ */
function currentProfile() {
  const p = { ...state.profile };
  const q = state.query;
  if (q) {
    if (q.age) p.age = String(q.age);
    if (q.gender) p.gender = q.gender;
    if (q.relocate) p.relocate = q.relocate;
  }
  return p;
}

function visibleJobs() {
  const profile = currentProfile();
  const rows = buildRows(profile, true);
  // safety: if keywords alone emptied the list, retry without keyword filtering
  if (rows.length === 0 && state.query && state.query.titleWords.length) {
    return buildRows(profile, false);
  }
  return rows;
}

function buildRows(profile, useKeywords) {
  return state.jobs
    .filter(job => {
      // 1) CSE-only preference
      if (state.profile.onlyCse) {
        const cseish = job.requiredDegrees.some(d => ["CSE", "ICT", "SWE", "IT", "General", "All"].includes(d));
        if (!cseish) return false;
      }
      // 2) sidebar filters
      if (state.filters.edu.length && !state.filters.edu.some(o => jobMatchesEdu(job, o))) return false;
      if (state.filters.type.length && !state.filters.type.some(o => job.type === o || job.edu === o)) return false;
      if (state.filters.grade.length && !state.filters.grade.includes(job.grade)) return false;
      // 3) smart query
      const q = state.query;
      if (q) {
        // a query for a major must also return "any bachelor's degree" posts
        if (q.majors.length &&
            !q.majors.some(m => job.requiredDegrees.includes(m) || job.requiredDegrees.includes("All"))) return false;
        // grades: only filter when the live data actually publishes them
        if (q.grades.length && gradesArePublished() && !q.grades.includes(job.grade)) return false;
        if (q.deadlineDays && daysLeft(job.deadline) > q.deadlineDays) return false;
        if (useKeywords && q.titleWords.length) {
          const hay = (job.title + " " + job.org + " " + job.summary + " " + job.edu + " " + job.type).toLowerCase();
          if (!q.titleWords.some(w => hay.includes(w.toLowerCase()))) return false;
        }
      }
      // 4) closed jobs hidden
      return daysLeft(job.deadline) >= 0;
    })
    .map(job => ({ job, ev: evaluateJob(job, profile) }));
}

function applyStatusAndSort(rows) {
  let out = rows;
  if (state.status === "saved") out = out.filter(r => state.saved.has(r.job.id));
  else if (state.status !== "all") out = out.filter(r => r.ev.status === state.status);

  const order = { eligible: 0, check: 1, not: 2 };
  if (state.sort === "deadline") out.sort((a, b) => new Date(a.job.deadline) - new Date(b.job.deadline));
  else if (state.sort === "match") out.sort((a, b) => b.ev.score - a.ev.score || order[a.ev.status] - order[b.ev.status]);
  else out.sort((a, b) => new Date(b.job.posted) - new Date(a.job.posted));
  return out;
}

function deadlineCell(job) {
  const d = daysLeft(job.deadline);
  const cls = d <= 3 ? "urgent" : d <= 10 ? "soon" : "";
  const left = d === 0 ? "🔴 Last day today" : d === 1 ? "⚠️ 1 day left" : `⏰ ${d} days left`;
  return `<span class="dl-date">${fmtDate(job.deadline)}</span><span class="dl-left ${cls}">${left}</span>`;
}

function whyPanelHTML(job, ev) {
  const ico = { ok: "✅", warn: "⚠️", bad: "❌" };
  const items = ev.checks.map(c => {
    const level = c.ok ? "ok" : (c.severity === "soft" ? "warn" : "bad");
    const tail = c.ok
      ? (c.key === "degree" || c.key === "age" || c.key === "cgpa" || c.key === "experience"
          ? `<b>${esc(c.yours)}</b>` : "")
      : (c.severity === "soft" ? `<b>${esc(c.warnText || "mismatch")}</b>` : "");
    return `<li class="why-${level}"><span class="why-ico">${ico[level]}</span>
      <span><b>${esc(c.label)}:</b> ${esc(c.required)} ${c.ok ? "→" : "→ ✗"} ${tail || (!c.ok && c.severity === "hard" ? `<b>${esc(c.yours)}</b>` : "")}</span></li>`;
  }).join("");

  return `
    <div class="why-panel" id="why-${job.id}" hidden>
      <h5>🧠 Why ${ev.status === "not" ? "not " : ""}am I ${ev.status === "eligible" ? "eligible" : ev.status === "check" ? "eligible (with notes)" : "not eligible"}?</h5>
      <ul class="why-list">${items}</ul>
      <div class="why-verdict"><b>Verdict:</b> ${esc(ev.verdict)}</div>
    </div>`;
}

function jobCardHTML(job, ev) {
  const meta = STATUS_META[ev.status];
  const saved = state.saved.has(job.id);
  const d = daysLeft(job.deadline);
  return `
  <article class="job-card ${meta.cls}" data-id="${job.id}">
    <div class="job-main">
      <div class="job-title">${esc(job.title)}${job.fresh ? '<span class="job-new-badge">NEW</span>' : ""}</div>
      <div class="job-org">${esc(job.org)}</div>
      <div class="job-meta">
        ${job.grade && job.grade !== "Other"
          ? `<span class="tag grade">${esc(job.grade)}</span>`
          : `<span class="tag">🎓 ${esc(job.edu || "Any degree")}</span>`}
        <span class="tag">${esc(job.type)}</span>
        <span class="tag">💼 ${job.vacancies || esc(job.vacancyRaw) || "—"} posts</span>
        <span class="tag">📍 ${esc(job.location)}</span>
        ${job.expYears ? `<span class="tag"> exp ${job.expYears}y</span>` : ""}
        ${job.isLive ? `<span class="tag tag-live">● LIVE</span>` : ""}
      </div>
      <button class="why-btn" data-why="${job.id}">🧠 Why am I ${ev.status === "not" ? "not " : ""}eligible? ▾</button>
    </div>
    <div class="job-deadline">${deadlineCell(job)}</div>
    <div class="job-match">
      <span class="match-badge ${meta.badge}">${meta.label}</span>
      <span class="match-score">${ev.score}% profile match${d <= 3 ? " · closing!" : ""}</span>
    </div>
    <div class="job-actions">
      <a class="btn btn-outline" href="${esc(job.pdfUrl)}" target="_blank" rel="noopener">📄 View Circular</a>
      <a class="btn btn-accent" href="${esc(job.applyUrl)}" target="_blank" rel="noopener">Apply Now ↗</a>
      <button class="save-btn ${saved ? "saved" : ""}" data-save="${job.id}" title="Save job">${saved ? "🔖" : "🔖+"}</button>
    </div>
    ${whyPanelHTML(job, ev)}
  </article>`;
}

function renderResults() {
  const rows = applyStatusAndSort(visibleJobs());
  $("#jobList").innerHTML = rows.map(r => jobCardHTML(r.job, r.ev)).join("");
  $("#emptyState").hidden = rows.length > 0;

  // counts
  const all = visibleJobs();
  const c = { eligible: 0, check: 0, not: 0 };
  all.forEach(r => c[r.ev.status]++);
  $("#nAll").textContent = all.length;
  $("#nEligible").textContent = c.eligible;
  $("#nCheck").textContent = c.check;
  $("#nNot").textContent = c.not;
  $("#nSaved").textContent = all.filter(r => state.saved.has(r.job.id)).length;

  // side score card
  $("#cntEligible").textContent = c.eligible;
  $("#cntCheck").textContent = c.check;
  $("#cntNot").textContent = c.not;
  $("#eligibleCount").textContent = c.eligible;
  const total = Math.max(all.length, 1);
  $("#ringFg").style.strokeDashoffset = String(Math.round(327 * (1 - c.eligible / total)));

  // closest deadline
  const next = all.filter(r => r.ev.status === "eligible").sort((a, b) => new Date(a.job.deadline) - new Date(b.job.deadline))[0];
  $("#closestDeadline").innerHTML = next
    ? `${fmtDate(next.job.deadline)} — <b>${esc(next.job.title)}</b><span class="dl-left ${daysLeft(next.job.deadline) <= 7 ? "urgent" : ""}">${daysLeft(next.job.deadline)} days left</span>`
    : "No eligible job right now — update your profile.";

  renderHeroJobs();
  renderStats();
}

function renderHeroJobs() {
  const rows = visibleJobs().filter(r => r.ev.status === "eligible").slice(0, 3);
  $("#heroJobs").innerHTML = rows.length
    ? rows.map(r => `<li><span><span class="mj-title">${esc(r.job.title)}</span><span class="mj-org">${esc(r.job.org)}</span></span>
        <span class="mg-badge mg-eligible">✅ ${r.ev.score}%</span></li>`).join("")
    : `<li><span class="mj-org">Build your profile to see matching jobs here →</span></li>`;

  const p = state.profile;
  $("#heroProfileLine").textContent = `${p.degree} · CGPA ${p.cgpa || "—"} · Age ${p.age || "—"} · ${p.location || "—"}`;
}

function renderStats() {
  $("#statSources").textContent = state.meta.organizations || SOURCES_COUNT;
  $("#statCirculars").textContent = state.jobs.length;
  const weekAgo = new Date(TODAY.getTime() - 7 * 86400000);
  $("#statNew").textContent = state.jobs.filter(j => new Date(j.posted) >= weekAgo).length;
}

/* ============================================================
   MODAL
   ============================================================ */
function openModal(id) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;
  const ev = evaluateJob(job, currentProfile());
  const meta = STATUS_META[ev.status];
  const saved = state.saved.has(job.id);
  const gradePublished = !!job.grade && job.grade !== "Other";
  const salaryLine = job.salary ? esc(job.salary)
    : gradePublished ? esc(job.grade) + " (grade only)" : "Not published in the summary";
  const cgpaLine = job.minCGPA ? `${job.minCGPA.toFixed(2)} / 4.00` : "Not published in the summary";
  const docsList = (job.docs && job.docs.length)
    ? `<ul class="m-docs">${job.docs.map(d => `<li>${esc(d)}</li>`).join("")}</ul>`
    : `<p class="m-muted">The document list is inside the circular PDF — open it below before applying.</p>`;

  $("#modalBody").innerHTML = `
    <div class="m-badges">
      <span class="match-badge ${meta.badge}">${meta.label}</span>
      ${job.grade && job.grade !== "Other"
        ? `<span class="tag grade">${esc(job.grade)}</span>`
        : `<span class="tag">🎓 ${esc(job.edu || "Any degree")}</span>`}
      <span class="tag">${esc(job.type)}</span>
      <span class="tag">${ev.score}% profile match</span>
    </div>
    <h2>${esc(job.title)}</h2>
    <div class="m-org">${esc(job.org)} · 📍 ${esc(job.location)}</div>
    <p style="margin-top:12px;color:var(--ink-2);font-size:14.5px">${esc(job.summary)}</p>

    <div class="m-grid">
      <div class="m-field"><span>Vacancies</span><b>${job.vacancies || esc(job.vacancyRaw) || "—"} posts</b></div>
      <div class="m-field"><span>Salary / Grade</span><b>${salaryLine}</b></div>
      <div class="m-field"><span>Age limit</span><b>${job.ageMin || "?"}–${job.ageMax || "?"} years</b></div>
      <div class="m-field"><span>Minimum CGPA</span><b>${cgpaLine}</b></div>
      <div class="m-field"><span>Experience</span><b>${job.expYears ? job.expYears + " year(s)" : "Not required"}</b></div>
      <div class="m-field"><span>Application start</span><b>${job.start ? fmtDate(job.start) : "—"}</b></div>
      <div class="m-field"><span>Deadline</span><b>${fmtDate(job.deadline)} (${daysLeft(job.deadline)} days left)</b></div>
      <div class="m-field"><span>Gender</span><b>${job.gender === "any" ? "Open to all" : job.gender === "female" ? "Female only" : "Male only"}</b></div>
      ${job.advertisementNo ? `<div class="m-field"><span>Circular no.</span><b>${esc(job.advertisementNo)}</b></div>` : ""}
      ${job.jobId ? `<div class="m-field"><span>Job ID</span><b>${esc(job.jobId)}</b></div>` : ""}
      ${job.orgWebsite ? `<div class="m-field"><span>Organisation website</span><b><a href="${esc(job.orgWebsite)}" target="_blank" rel="noopener">${esc(job.orgWebsite.replace(/^https?:\/\//, ""))} ↗</a></b></div>` : ""}
    </div>

    <div class="m-section">
      <h4>🎓 Educational qualification</h4>
      <p>${esc(job.degreeText)}</p>
    </div>

    <div class="m-section">
      <h4>🤖 AI Eligibility Analysis — “Why am I eligible?”</h4>
      <div class="m-why">
        <ul class="why-list">
          ${ev.checks.map(c => {
            const level = c.ok ? "ok" : (c.severity === "soft" ? "warn" : "bad");
            const ico = { ok: "✅", warn: "⚠️", bad: "❌" }[level];
            return `<li class="why-${level}"><span class="why-ico">${ico}</span>
              <span><b>${esc(c.label)}:</b> Required: ${esc(c.required)} — Yours: ${esc(c.yours)}</span></li>`;
          }).join("")}
        </ul>
        <div class="why-verdict">${esc(ev.verdict)}</div>
      </div>
    </div>

    <div class="m-section">
      <h4>📑 Required documents</h4>
      ${docsList}
    </div>

    <div class="m-section">
      <h4>🔎 Data source</h4>
      <p class="m-muted">Collected from <a href="${esc(job.detailUrl)}" target="_blank" rel="noopener">${esc(job.source || "the official listing")} ↗</a>
      ${job.posted ? ` · posted ${fmtDate(job.posted)}` : ""}
      ${job.viewCount ? ` · ${Number(job.viewCount).toLocaleString("en-GB")} views` : ""}.</p>
      ${job.degreeSource === "inferred" ? `<p class="m-muted">* Qualification, grade and salary are <b>not published</b> by the source summary — the qualification shown above is inferred from the post title. Always confirm in the circular PDF.</p>` : ""}
    </div>

    ${job.note ? `<div class="m-section"><h4>⚠️ Note</h4><p>${esc(job.note)}</p></div>` : ""}

    <div class="m-actions">
      <a class="btn btn-accent btn-lg" href="${esc(job.applyUrl)}" target="_blank" rel="noopener">Apply Now (official website) ↗</a>
      <a class="btn btn-outline" href="${esc(job.pdfUrl)}" target="_blank" rel="noopener">📄 View Circular PDF</a>
      <a class="btn btn-ghost" href="${esc(job.detailUrl)}" target="_blank" rel="noopener">🔗 Official listing</a>
      <button class="btn btn-ghost" data-save="${job.id}">${saved ? "🔖 Saved" : "🔖 Save job"}</button>
    </div>
    <p style="margin-top:14px;font-size:13px;color:var(--ink-3)">🛡️ ChakriMatch does not submit applications — “Apply Now” opens the official source only.</p>
  `;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

/* ============================================================
   NOTIFICATIONS + TOASTS
   ============================================================ */
function toast(title, body, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
  $("#toastWrap").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".4s"; }, 5200);
  setTimeout(() => el.remove(), 5700);
}
function pushNotif(title, body) {
  state.notifs.unshift({ title, body, at: Date.now() });
  state.notifs = state.notifs.slice(0, 25);
  save("cm_notifs", state.notifs);
  renderNotifs(true);
}
function renderNotifs(flash) {
  const list = $("#notifList");
  if (!state.notifs.length) {
    list.innerHTML = `<li class="notif-empty">No notifications yet. Run the crawler or save a job to get alerts.</li>`;
  } else {
    list.innerHTML = state.notifs.map(n => `
      <li><span>🔔</span><span><b>${esc(n.title)}</b><span>${esc(n.body)}</span>
      <span>${new Date(n.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span></li>`).join("");
  }
  const dot = $("#bellDot");
  if (flash && state.notifs.length) {
    dot.hidden = false;
    dot.textContent = Math.min(state.notifs.length, 99);
  }
  if (!state.notifs.length) dot.hidden = true;
}

/* ============================================================
   CRAWLER / PIPELINE SIMULATION
   ============================================================ */
function runPipeline(manual = true) {
  if (state.scanning) return;
  state.scanning = true;
  const steps = $$("#pipelineSteps .pipe-step");
  steps.forEach(s => s.classList.remove("active", "done"));
  if (manual) $("#runPipelineBtn").textContent = "⏳ Scanning sources…";

  let i = 0;
  const tick = () => {
    if (i > 0) { steps[i - 1].classList.remove("active"); steps[i - 1].classList.add("done"); }
    if (i < steps.length) {
      steps[i].classList.add("active");
      i++;
      setTimeout(tick, 240);
    } else {
      finishScan();
    }
  };
  tick();
}

async function finishScan() {
  state.scanning = false;
  state.lastScan = Date.now();
  $("#lastScan").textContent = agoLabel(0);
  $("#runPipelineBtn").textContent = "▶ Run crawler now";
  $$("#pipelineSteps .pipe-step").forEach(s => s.classList.remove("active"));

  /* ---- LIVE MODE: re-read data/jobs.json and report only new circulars ---- */
  if (state.meta.live) {
    const added = await refreshLiveData();
    renderSourceInfo();
    renderCrawlerStatus();
    if (added.length) {
      renderFilters(); renderCategories(); renderResults();
      added.forEach(j => pushNotif("New Job Alert",
        `“${j.title}” at ${j.org} — deadline ${fmtDate(j.deadline)}.`));
      const first = added[0];
      if ($("#optSite").checked) {
        toast("🔔 New Job Alert", `A new government circular has been published: ${first.title} at ${first.org}`, "alert");
      }
      if ($("#optEmail").checked) {
        toast("📧 Email queued", `Alert for “${first.title}” → ${$("#emailInput").value || "your email"}`, "alert");
      }
      if ($("#optTelegram").checked) {
        toast("✈️ Telegram queued", `Alert for “${first.title}” → ${$("#tgInput").value || "@yourhandle"}`, "alert");
      }
      $("#alertSampleJob").innerHTML =
        `<b>${esc(first.title)}</b> — ${esc(first.org)} · Deadline: ${fmtDate(first.deadline)}`;
      toast("✅ New circulars found", `${added.length} new circular${added.length > 1 ? "s" : ""} pulled from the live source.`, "alert");
    } else {
      toast("✅ Scan complete", `No new circular since ${generatedLabel()}. The source itself refreshes every 6 hours.`);
    }
    return;
  }

  /* ---- FALLBACK MODE: embedded demo queue ---- */
  const nextJob = state.incomingQueue.shift();
  if (nextJob) {
    state.jobs.unshift(nextJob);
    renderFilters(); renderCategories(); renderResults();

    pushNotif("New Job Alert", `“${nextJob.title}” at ${nextJob.org} — deadline ${fmtDate(nextJob.deadline)}.`);
    if ($("#optSite").checked) {
      toast("🔔 New Job Alert", `A new government job matching your ${state.profile.major} background has been published: ${nextJob.title}`, "alert");
    }
    if ($("#optEmail").checked) {
      toast("📧 Email queued", `Alert for “${nextJob.title}” → ${$("#emailInput").value || "your email"}`, "alert");
    }
    if ($("#optTelegram").checked) {
      toast("✈️ Telegram queued", `Alert for “${nextJob.title}” → ${$("#tgInput").value || "@yourhandle"}`, "alert");
    }
    // update sample alert card
    $("#alertSampleJob").innerHTML = `<b>${esc(nextJob.title)}</b> — ${esc(nextJob.org)} · Deadline: ${fmtDate(nextJob.deadline)}`;
  } else {
    toast("✅ Scan complete", "No new circular found. Next auto-scan in 5 minutes.");
  }
}

function scanCountdown() {
  const EVERY = 300;                    // auto re-check every 5 minutes
  let n = EVERY;
  setInterval(() => {
    n--;
    if (n <= 0) {
      n = EVERY;
      runPipeline(false);
    }
    $("#nextScan").textContent = `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
    $("#lastScan").textContent = agoLabel(Date.now() - state.lastScan);
  }, 1000);
}

/* ============================================================
   SMART SEARCH
   ============================================================ */
function runSmartSearch() {
  const raw = $("#smartQuery").value.trim();
  state.queryText = raw;
  state.query = raw ? parseSmartQuery(raw) : null;
  renderParsed();
  renderResults();
  if (raw) {
    const n = visibleJobs().length;
    toast("🧠 Query parsed", `"${raw.slice(0, 60)}${raw.length > 60 ? "…" : ""}" → ${n} job${n === 1 ? "" : "s"} found.`);
    document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderParsed() {
  const box = $("#parsedFilters");
  const q = state.query;
  if (!q) { box.hidden = true; box.innerHTML = ""; return; }
  const tags = [];
  if (q.majors.length) tags.push(["Degree", q.majors.join(", ")]);
  if (q.age) tags.push(["Age", q.age]);
  if (q.grades.length) {
    tags.push(["Grades", gradesArePublished()
      ? q.grades.map(g => g.replace("Grade ", "")).join(", ")
      : `${q.grades.map(g => g.replace("Grade ", "")).join(", ")} — not published in live circulars, ignored`]);
  }
  if (q.gender) tags.push(["Gender", q.gender === "female" ? "Female" : "Male"]);
  if (q.relocate) tags.push(["Location", q.relocate === "yes" ? "Anywhere OK" : "Own location only"]);
  if (q.deadlineDays) tags.push(["Deadline", `within ${q.deadlineDays} days`]);
  if (q.titleWords.length) tags.push(["Keywords", q.titleWords.slice(0, 5).join(", ")]);

  box.hidden = tags.length === 0;
  box.innerHTML = tags.map(([k, v]) => `<span class="parsed-tag">${k}: <b>${esc(v)}</b></span>`).join("") +
    `<span class="parsed-tag" style="background:#FFF6E5;border-color:#F3E4BE;color:#8A5A00">AI parsed your query ✨</span>`;
}

/* ============================================================
   EVENTS
   ============================================================ */
function bindEvents() {
  // nav
  $("#hamburger").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
  $$(".nav-link").forEach(a => a.addEventListener("click", () => $("#mainNav").classList.remove("open")));

  // notifications panel
  $("#bellBtn").addEventListener("click", e => {
    e.stopPropagation();
    $("#notifPanel").hidden = !$("#notifPanel").hidden;
    if (!$("#notifPanel").hidden) { $("#bellDot").hidden = true; }
  });
  document.addEventListener("click", e => {
    if (!$("#notifPanel").hidden && !$("#notifPanel").contains(e.target)) $("#notifPanel").hidden = true;
  });
  $("#clearNotifs").addEventListener("click", () => { state.notifs = []; save("cm_notifs", []); renderNotifs(); });

  // form
  $("#profileForm").addEventListener("submit", e => {
    e.preventDefault();
    readForm();
    renderResults();
    toast("🔎 Matching complete", `Found ${visibleJobs().length} circulars — ${$("#nEligible").textContent} fully eligible for you.`);
    document.getElementById("results").scrollIntoView({ behavior: "smooth" });
  });
  $("#profileForm").addEventListener("change", () => { readForm(); renderResults(); });

  $("#resetProfile").addEventListener("click", () => {
    state.profile = structuredClone(DEFAULT_PROFILE);
    save("cm_profile", state.profile);
    renderForm(); renderResults();
    toast("Profile reset", "Loaded the sample CSE profile again.");
  });

  // skills
  $("#skillInput").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = e.target.value.trim();
      if (v && !state.profile.skills.includes(v)) {
        state.profile.skills.push(v);
        save("cm_profile", state.profile);
        renderSkills(); renderResults();
      }
      e.target.value = "";
    }
  });
  $("#skillsBox").addEventListener("click", e => {
    const btn = e.target.closest("[data-skill]");
    if (!btn) return;
    state.profile.skills = state.profile.skills.filter(s => s !== btn.dataset.skill);
    save("cm_profile", state.profile);
    renderSkills(); renderResults();
  });

  // checkbox groups (profile)
  ["#jobTypeChecks", "#gradeChecks"].forEach(sel => {
    $(sel).addEventListener("change", e => {
      const g = e.target.dataset.group;
      const arr = g === "type" ? state.profile.jobTypes : state.profile.grades;
      const val = e.target.value;
      if (e.target.checked) { if (!arr.includes(val)) arr.push(val); }
      else { const i = arr.indexOf(val); if (i > -1) arr.splice(i, 1); }
      save("cm_profile", state.profile);
      renderResults();
    });
  });

  // sidebar filters
  $("#filters").addEventListener("change", e => {
    const key = e.target.dataset.fkey;
    if (!key) return;
    const arr = state.filters[key];
    const v = e.target.value;
    if (e.target.checked) { if (!arr.includes(v)) arr.push(v); }
    else { const i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); }
    renderResults();
  });
  $("#clearFilters").addEventListener("click", () => {
    state.filters = { edu: [], type: [], grade: [] };
    renderFilters(); renderResults();
  });

  // status chips + sort
  $("#statusChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-status]");
    if (!chip) return;
    state.status = chip.dataset.status;
    $$("#statusChips .chip").forEach(c => c.classList.toggle("active", c === chip));
    renderResults();
  });
  $("#sortSelect").addEventListener("change", e => { state.sort = e.target.value; renderResults(); });

  // results interactions (delegated)
  $("#jobList").addEventListener("click", e => {
    const whyBtn = e.target.closest("[data-why]");
    if (whyBtn) {
      const panel = document.getElementById("why-" + whyBtn.dataset.why);
      panel.hidden = !panel.hidden;
      whyBtn.textContent = panel.hidden ? "🧠 Why am I eligible? ▾" : "🧠 Hide explanation ▴";
      return;
    }
    const saveBtn = e.target.closest("[data-save]");
    if (saveBtn) { toggleSave(saveBtn.dataset.save); renderResults(); return; }
    const card = e.target.closest(".job-card");
    if (card && !e.target.closest("a")) openModal(card.dataset.id);
  });

  $("#emptyReset").addEventListener("click", () => {
    state.filters = { edu: [], type: [], grade: [] };
    state.status = "all"; state.query = null;
    $("#smartQuery").value = "";
    $$("#statusChips .chip").forEach(c => c.classList.toggle("active", c.dataset.status === "all"));
    renderParsed(); renderFilters(); renderResults();
  });

  // smart search
  $("#smartSearchBtn").addEventListener("click", runSmartSearch);
  $("#smartQuery").addEventListener("keydown", e => { if (e.key === "Enter") runSmartSearch(); });
  $$(".chip-example").forEach(b => b.addEventListener("click", () => {
    $("#smartQuery").value = b.dataset.query;
    runSmartSearch();
  }));

  // categories
  $("#categoryGrid").addEventListener("click", e => {
    const item = e.target.closest("[data-key]");
    if (!item) return;
    const { key, val } = item.dataset;
    if (!state.filters[key].includes(val)) state.filters[key].push(val);
    renderFilters(); renderResults();
    document.getElementById("results").scrollIntoView({ behavior: "smooth" });
    toast("Filter applied", `${key === "edu" ? "Education" : key === "type" ? "Job type" : "Grade"}: ${val}`);
  });

  // crawler
  $("#runPipelineBtn").addEventListener("click", () => runPipeline(true));
  $("#scanNowBtn").addEventListener("click", () => {
    document.getElementById("pipeline").scrollIntoView({ behavior: "smooth" });
    runPipeline(true);
  });

  // alerts
  $("#testAlertBtn").addEventListener("click", () => {
    const job = visibleJobs().find(r => r.ev.status === "eligible")?.job || state.jobs[0];
    pushNotif("New Job Alert", `A new government job matching your ${state.profile.major} background: ${job.title}`);
    toast("🔔 New Job Alert", `A new government job matching your ${state.profile.major} background has been published.`, "alert");
    $("#alertSampleJob").innerHTML = `<b>${esc(job.title)}</b> — ${esc(job.org)} · Deadline: ${fmtDate(job.deadline)}`;
  });
  $("#optEmail").addEventListener("change", e => toast("Email alerts", e.target.checked ? "Enabled — add your email address below." : "Disabled."));
  $("#optTelegram").addEventListener("change", e => toast("Telegram alerts", e.target.checked ? "Enabled — add your Telegram handle below." : "Disabled."));

  // modal
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", e => { if (e.target === $("#modalBackdrop")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  $("#modalBody").addEventListener("click", e => {
    const s = e.target.closest("[data-save]");
    if (s) { toggleSave(s.dataset.save); openModal(s.dataset.save); renderResults(); }
  });
}

function toggleSave(id) {
  if (state.saved.has(id)) { state.saved.delete(id); toast("Removed", "Job removed from saved list."); }
  else {
    state.saved.add(id);
    const j = state.jobs.find(x => x.id === id);
    pushNotif("Job saved", `${j.title} — ${j.org}`);
    toast("🔖 Saved", `${j.title} saved to your list.`);
  }
  save("cm_saved", [...state.saved]);
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  const live = await loadLiveJobs();      // live circulars, falls back to demo data
  $("#alertMajor").textContent = state.profile.major;
  renderForm();
  renderFilters();
  renderCategories();
  renderResults();
  renderNotifs();
  bindEvents();
  renderSourceInfo();
  renderCrawlerStatus();                    // proves the 6-hourly cron is alive
  setInterval(renderCrawlerStatus, 5 * 60000);
  const first = state.jobs[0];
  $("#alertSampleJob").innerHTML = first
    ? `<b>${esc(first.title)}</b> — ${esc(first.org)} · Deadline: ${fmtDate(first.deadline)}`
    : `<b>Computer Programmer</b> — DSHE · Deadline: 20 Oct 2026`;
  $("#lastScan").textContent = "Last scan: just now";
  scanCountdown();
  if (live) {
    setTimeout(() => toast("🟢 Live circulars loaded",
      `${state.jobs.length} open government jobs from ${state.meta.source}`), 500);
  } else {
    setTimeout(() => toast("🟡 Offline demo mode",
      "Could not fetch data/jobs.json — showing the bundled sample circulars."), 500);
  }
}
document.addEventListener("DOMContentLoaded", init);
