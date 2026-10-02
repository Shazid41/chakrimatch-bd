#!/usr/bin/env python3
"""
ChakriMatch BD — live government job collector.

Source: Alljobs by Teletalk (https://alljobs.teletalk.com.bd) public API.
No authentication required for:
    GET /api/v1/govt-jobs/org-list?page=N&limit=M   (organizations + their posts)
    GET /api/v1/govt-jobs/public-details?id=J       (age limit, dates, circular PDF, apply link)

The API does NOT publish an educational-qualification field, so the required
degree is INFERRED from the post title by rule (see infer_qualification()).
Every job produced here is marked degreeSource="inferred" so the frontend can
show "verify in circular" instead of a hard rejection.

Output: data/jobs.json  (consumed by js/app.js)

Stdlib only — runs unchanged on GitHub Actions.
"""

from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import ssl
import sys
import time
import urllib.error
import urllib.request

BASE = "https://alljobs.teletalk.com.bd"
API = f"{BASE}/api/v1"
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = ROOT / "data" / "jobs.json"

HEADERS = {
    "User-Agent": "ChakriMatch-BD/1.0 (+https://github.com/Shazid41)",
    "Accept": "application/json",
    "Referer": f"{BASE}/jobs/government",
}

CTX = ssl.create_default_context()
LOG = lambda *a: print(*a, file=sys.stderr)


# --------------------------------------------------------------------------- HTTP
def http(url: str, binary: bool = False, tries: int = 3, pause: float = 0.4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=45, context=CTX) as r:
                data = r.read()
                return data if binary else json.loads(data.decode("utf-8", "ignore"))
        except Exception as e:  # noqa: BLE001 - retry on any transport/API error
            last = e
            LOG(f"  retry {i + 1}/{tries} {url.split('/')[-1][:60]} -> {e}")
            time.sleep(pause * (i + 1))
    raise RuntimeError(f"failed after {tries} tries: {url}") from last


# ------------------------------------------------------------------- source data
def fetch_org_pages(limit: int = 50):
    """Every organization that currently has live posts, with its job index."""
    orgs, page, total = [], 1, None
    while True:
        d = http(f"{API}/govt-jobs/org-list?page={page}&limit={limit}")
        batch = d.get("govtOrgJobs") or []
        total = d.get("count", total)
        orgs.extend(batch)
        if not batch or len(orgs) >= (total or 0):
            break
        page += 1
        if page > 40:  # safety net
            break
    return orgs


def fetch_detail(job_id: int):
    return http(f"{API}/govt-jobs/public-details?id={job_id}").get("details") or {}


# ------------------------------------------------------- qualification inference
# (label, regex on POST TITLE, accepted majors, education category, skills)
DEGREE_RULES = [
    ("engineering-elec-mech",          # combined posts e.g. "(Electrical/Mechanical)"
     r"electro\s?-?mechanical|electrical\s*[/&+-]\s*mechanical|mechanical\s*[/&+-]\s*electrical",
     ["EEE", "Mechanical"], "Mechanical", []),
    ("engineering-civil",
     r"\bcivil\b|structural|draughtsman|draughts(wo)?man|surveyor|architect",
     ["Civil"], "Civil", []),
    ("engineering-mechanical",
     r"mechanical|auto[- ]?mechanic|diesel|blacksmith|fitter|machinist|foundry|boiler",
     ["Mechanical"], "Mechanical", []),
    ("engineering-electrical",
     r"electrical|electrician|wireman|powerhouse|sub[- ]assistant engineer",
     ["EEE"], "EEE", []),
    ("electronics-telecom",
     r"electronics|telecommunication|radio|radar",
     ["ECE", "EEE", "CSE", "ICT"], "ICT", ["Networking"]),
    ("medical-health",
     r"medical|doctor|nurse|pharmacist|paramedic|dentist|surgeon|health assistant|midwif|"
     r"mbbs|hospital|clinic|health officer|sub assistant medical|eye|anesthesia|pathology",
     ["Medical", "Pharmacy"], "Medical", []),
    ("law-legal",
     r"legal|law officer|judicial|advocate|barrister|court|munshi",
     ["Law"], "Law", []),
    ("science-lab",
     r"chemis|physics|scientific|lab attendant|lab assistant|lab technician|biochem|geology",
     ["Chemistry", "Physics", "Mathematics"], "Science", ["Research"]),
    ("statistics-data",
     r"statistician|statistics|econometric|population census",
     ["Statistics", "Mathematics", "Economics"], "Statistics", ["Data Analysis"]),
    ("teaching-subject",
     r"assistant professor|lecturer|teacher|instructor|professor|trainer|faculty",
     None, None, []),                       # resolved by subject hints below
    ("education-teaching",
     r"headmaster|assistant head|shastri|purohit|quran|arabic|islamic|religion",
     ["General"], "Education", []),
    ("business-finance",
     r"accountant|accounting|audit|auditor|cashier|cash officer|revenue|taxation|tax|"
     r"bank|banking|finance|finance officer|marketing|commerce|store officer|purchase|"
     r"procurement|inventory",
     ["BBA", "Accounting", "Finance", "Economics"], "Accounting", ["Accounting"]),
    ("language-english",
     r"\benglish\b|translator|interpreter|translation",
     ["English"], "English", []),
    ("it-programmer",
     r"programmer|software|developer|web|database|system administrator|sys ?admin|network|"
     r"cyber|information technology|\bict\b|\bit officer\b|multimedia|digital|data scientist|"
     r"data analyst|\bmis\b|e[- ]governance|robot|artificial intelligence|devops|cloud",
     ["CSE", "ICT", "SWE", "IT"], "CSE", ["Programming"]),
    ("computer-operations",
     r"computer|operator|typist|stenographer|data entry|clerk|ms office|it support|"
     r"hardware|photographer|video editor",
     ["All"], "All Graduates", ["Computer Basics", "Typing"]),
]

# subject hints inside teaching / generic titles -> restrict the degree
SUBJECT_HINTS = [
    (r"computer|cse|\bict\b|software|programming", ["CSE", "ICT", "SWE", "IT"], "CSE"),
    (r"electrical|electronics", ["EEE", "ECE"], "EEE"),
    (r"civil", ["Civil"], "Civil"),
    (r"mechanical", ["Mechanical"], "Mechanical"),
    (r"english", ["English"], "English"),
    (r"bangla|বাংলা", ["Bangla", "General"], "General"),
    (r"math|গণিত", ["Mathematics"], "Mathematics"),
    (r"statistic", ["Statistics"], "Statistics"),
    (r"physics", ["Physics"], "Science"),
    (r"chemis", ["Chemistry"], "Science"),
    (r"econom", ["Economics"], "Economics"),
    (r"account|commerce|finance", ["Accounting", "BBA", "Finance"], "Accounting"),
    (r"law|legal", ["Law"], "Law"),
    (r"management|bba", ["BBA"], "BBA"),
    (r"history|political|sociology|philosophy|islamic studies|bangladesh studies", ["General"], "General"),
]

# skills hinted by the title (matched after degree rules)
SKILL_HINTS = [
    (r"typist|stenographer|clerk|ms office|data entry", ["Typing", "Computer Basics"]),
    (r"driver", ["Driving Licence"]),
    (r"accountant|cashier|audit", ["Accounting"]),
    (r"computer|programmer|operator|software|mis", ["Computer Basics"]),
    (r"first aid|guard|police|security", ["Security"]),
    (r"survey|draughts|architect", ["CAD Drawing"]),
    (r"lab|scientific|research", ["Research"]),
]


def infer_qualification(title: str) -> dict:
    """Return accepted majors + education category inferred from the post title."""
    t = (title or "").lower()
    degrees, edu, skills, matched = None, None, [], []

    for label, pat, deg, category, extra in DEGREE_RULES:
        if not re.search(pat, t):             # rule only applies if the title matches
            continue
        if deg is None:                       # teaching/training post -> subject decides
            for hpat, hdeg, hcat in SUBJECT_HINTS:
                if re.search(hpat, t):
                    degrees, edu = hdeg, hcat
                    matched.append(f"{label}[subject:{hpat}]")
                    break
            if degrees is None:               # no subject named -> any bachelor
                degrees, edu = ["All"], "All Graduates"
                matched.append(f"{label}[any]")
        else:
            degrees, edu = deg, category
            matched.append(label)
        skills += extra
        break

    if degrees is None:                       # no rule matched -> any bachelor
        degrees, edu = ["All"], "All Graduates"
        matched.append("default:any-degree")

    # subject hints can further restrict a generic title (e.g. "Assistant (Civil)")
    if len(matched) == 1 and matched[0] == "default:any-degree":
        for hpat, hdeg, hcat in SUBJECT_HINTS:
            if re.search(hpat, t):
                degrees, edu = hdeg, hcat
                matched.append("hint:" + hpat)
                break

    for pat, extra in SKILL_HINTS:
        if re.search(pat, t):
            for s in extra:
                if s not in skills:
                    skills.append(s)

    return {
        "requiredDegrees": degrees,
        "edu": edu,
        "skills": skills,
        "rule": "|".join(matched),
    }


def infer_org_type(org_name: str) -> str:
    n = (org_name or "").lower()
    if "university" in n:
        return "Government University"
    if "polytechnic" in n or "college" in n or "institute of technology" in n:
        return "Government College"
    if "bank" in n:
        return "Government Bank"
    if "ministry" in n or " division" in n or "secretariat" in n:
        return "Ministry"
    if "director" in n:
        return "Directorate"
    if "public service commission" in n:
        return "BCS"
    if any(k in n for k in ("commission", "council", "authority", "corporation", "board",
                            "bureau", "force", "police", "agency", "trust", "hospital",
                            "development", "electricity", "water", "railway", "judicial")):
        return "Autonomous Organization"
    if any(k in n for k in ("office", "upazila", "district", "dc office", "adc", "judge")):
        return "Directorate"
    return "Non-Cadre"


GENDER_MAP = {1: "male", 2: "female", 3: "any", 4: "any"}


def norm_date(value) -> str | None:
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
    except Exception:                          # noqa: BLE001
        return str(value)[:10]


def to_int(value, default=0):
    try:
        digits = re.sub(r"\D", "", str(value or ""))
        return int(digits) if digits else default
    except Exception:                          # noqa: BLE001
        return default


def build_job(detail: dict) -> dict | None:
    if not detail:
        return None
    title = detail.get("job_title") or ""
    org = detail.get("job_utilities_govtorganization") or {}
    org_name = org.get("name") or "Government Organization"
    q = infer_qualification(title)
    adv = detail.get("advertisement_file") or ""

    return {
        # identity -------------------------------------------------------------
        "id": f"t{detail.get('id')}",
        "sourceId": detail.get("id"),
        "jobId": detail.get("job_id"),
        "title": title,
        "titleBn": detail.get("job_title_bn"),
        "org": org_name,
        "orgBn": org.get("name_bn"),
        "orgWebsite": org.get("website"),
        "type": infer_org_type(org_name),
        "edu": q["edu"],
        "grade": "Other",                      # not published by the API
        # eligibility inputs ----------------------------------------------------
        "requiredDegrees": q["requiredDegrees"],
        "degreeText": _degree_text(q),
        "degreeSource": "inferred",
        "degreeRule": q["rule"],
        "minCGPA": 0,                          # 0 = not published
        "ageMin": detail.get("min_age") or 0,
        "ageMax": detail.get("max_age") or 0,
        "gender": GENDER_MAP.get(detail.get("gender"), "any"),
        "expYears": 0,
        "skills": q["skills"],
        # posting ----------------------------------------------------------------
        "vacancies": to_int(detail.get("vacancy")),
        "vacancyRaw": detail.get("vacancy"),
        "vacancyNotSpecific": bool(detail.get("vacancy_not_specific")),
        "salary": None,
        "location": "All Bangladesh",
        "allLocations": True,
        "start": norm_date(detail.get("published_date")),
        "deadline": norm_date(detail.get("deadline_date")),
        "posted": norm_date(detail.get("published_date")),
        "advertisementNo": (detail.get("advertisement_no") or "").strip() or None,
        "advertisementPublished": norm_date(detail.get("advertisement_published_date")),
        "viewCount": detail.get("view_count") or 0,
        # links -----------------------------------------------------------------
        "applyUrl": detail.get("application_site") or detail.get("job_source") or BASE + "/jobs/government",
        "pdfUrl": f"{BASE}/media/{adv}" if adv else f"{BASE}/jobs/government/",
        "detailUrl": f"{BASE}/jobs/government/{detail.get('organization_id') or org.get('id')}?jobId={detail.get('id')}",
        "docs": [],
        "summary": _summary(title, org_name, detail),
        "source": "alljobs.teletalk.com.bd",
        "isLive": True,
    }


def _degree_text(q: dict) -> str:
    deg = q["requiredDegrees"]
    if deg == ["All"]:
        return ("Any 4-year bachelor's degree (inferred from the post title — "
                "confirm the exact requirement in the circular PDF).")
    labels = ", ".join(deg)
    return (f"{labels} (inferred from the post title — confirm the exact "
            f"requirement in the circular PDF).")


def _summary(title, org, detail):
    bits = [f"{title} at {org}."]
    if detail.get("advertisement_no"):
        bits.append(f"Recruitment circular no. {detail['advertisement_no']}.")
    v = detail.get("vacancy")
    if v:
        bits.append(f"Vacancies: {v}.")
    bits.append("Apply only through the official application link.")
    return " ".join(bits)


# -----------------------------------------------------------------------------main
def main() -> int:
    only = None
    if "--limit" in sys.argv:                  # --limit 20 for quick local runs
        only = int(sys.argv[sys.argv.index("--limit") + 1])

    LOG("reading organization index …")
    orgs = fetch_org_pages()
    plan = []                                   # (org, job_index_entry)
    for o in orgs:
        for j in o.get("govt_jobs") or []:
            plan.append((o, j))
    LOG(f"  {len(orgs)} organizations, {len(plan)} live posts")
    if only:
        plan = plan[:only]

    jobs, seen, failed = [], set(), 0
    for i, (_org, j) in enumerate(plan, 1):
        jid = j.get("id")
        if not jid or jid in seen:
            continue
        seen.add(jid)
        try:
            detail = fetch_detail(jid)
        except Exception as e:                 # noqa: BLE001
            failed += 1
            LOG(f"  !! detail {jid} failed: {e}")
            continue
        job = build_job(detail)
        if job:
            jobs.append(job)
        if i % 25 == 0:
            LOG(f"  … {i}/{len(plan)}")
        time.sleep(0.15)                        # be gentle with the source

    # newest deadlines first is not useful — keep soonest deadline on top
    jobs.sort(key=lambda x: (x.get("deadline") or "9999-12-31"))

    payload = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "source": "alljobs.teletalk.com.bd (Alljobs by Teletalk — public API)",
        "sourceUrl": f"{BASE}/jobs/government",
        "organizations": len(orgs),
        "count": len(jobs),
        "qualificationNote": (
            "Educational qualification is not published by the source API; it is inferred "
            "from the post title and must be verified in the official circular PDF."
        ),
        "jobs": jobs,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    LOG(f"wrote {OUT} ({len(jobs)} jobs, {failed} failures)")
    print(json.dumps({"count": len(jobs), "failed": failed, "out": str(OUT)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
