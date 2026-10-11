"""Bangladesh Bank eRecruitment (erecruitment.bb.org.bd) — bank job collector.

The Apply Online page
    https://erecruitment.bb.org.bd/onlineapp/joblist.php
is plain server-rendered HTML (no JavaScript, no API needed) with one table:

    Job ID | Position | No of Post | Salary Scale | Age calculated on |
    Educational requirement | Payment | Deadline | Apply

...plus section rows ``Advertisement published by: <publisher>``.

Unlike the Teletalk API this source **publishes the educational requirement in
plain text**, so bank jobs carry ``degreeSource: "official"`` and the matcher is
allowed to fail them hard.
"""

from __future__ import annotations

import datetime as dt
import html as _html
import re
import sys

BASE = "https://erecruitment.bb.org.bd"
JOBLIST = f"{BASE}/onlineapp/joblist.php"

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

LOG = (lambda *a: print(*a, file=sys.stderr)) if __name__ == "__main__" else (lambda *a: None)


# ---------------------------------------------------------------- helpers
def _clean(fragment: str) -> str:
    """HTML fragment → single-line plain text."""
    fragment = re.sub(r"<li[^>]*>", " • ", fragment, flags=re.I)
    fragment = re.sub(r"</p>|<br\s*/?>", " ", fragment, flags=re.I)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", _html.unescape(fragment)).strip()


def _iso_date(value: str) -> str | None:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return dt.datetime.strptime(value.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _to_int(value, default=0):
    try:
        return int(re.sub(r"[^\d]", "", str(value)) or default)
    except (TypeError, ValueError):
        return default


# ------------------------------------------------------------ education
# order matters: the first match that fires is the one we keep as the primary
SPECIFIC_RULES = [
    (r"computer science|computer engineering|\bcse\b|software|information technology"
     r"|ict\b|cyber|robotics|artificial intelligence|data science|networking|\bit\b",
     ["CSE", "ICT", "SWE", "IT"]),
    (r"\bcivil\b|structural|public health engineering", ["Civil"]),
    (r"electrical|electronic|\beee\b|\bece\b|power|telecom", ["EEE", "ECE"]),
    (r"mechanical|textile|industrial|production|automobile", ["Mechanical"]),
    (r"architect|urban|rural planning", ["Architecture", "Civil"]),
    (r"accounting|chartered account|\bcca\b|\bca\b|cost and management|cost & management",
     ["Accounting", "Finance"]),
    (r"finance|banking|\bmbm\b|money|investment", ["Finance", "BBA"]),
    (r"bba|business administration|management studies|\bmgt\b", ["BBA"]),
    (r"econom", ["Economics"]),
    (r"statistic|\bmathemat|\bmath\b", ["Statistics", "Mathematics"]),
    (r"\blaw\b|\bll\.?\s*b\b|legal", ["Law"]),
    (r"mbbs|medical|physician|surgery", ["Medical"]),
    (r"pharmac", ["Pharmacy"]),
    (r"\benglish\b|literature|bangla|bengali", ["English"]),
    (r"\bphysics\b|\bchemistry\b|biochemistry|\bbiology\b", ["Statistics", "Mathematics",
                                                              "Physics", "Chemistry"]),
]

OPEN_WORDS = r"any discipline|any subject|any faculty|any department|any recognized university"

# level markers (word-boundary guarded: "Diploma" must NOT match the "ma" in it)
RE_MASTER = re.compile(r"\bmaster|post-?graduate|m\.?sc\b|\bmba\b")
RE_BACHELOR = re.compile(r"bachelor|honours|honors|b\.?sc\b|b\.?a\.?\b|bba|\bll\.?\s*b\b"
                         r"|mbbs|four year|4 year|graduation|\bgraduate\b")
RE_DIPLOMA = re.compile(r"\bdiploma|\bhsc\b|\bssc\b")
# "Honours/Masters", "Masters or Honours" → either one is enough
RE_SOFT_MASTER = re.compile(r"(?:honours|honors)\s*/\s*master|master'?s?\s*/\s*(?:honours|honors)"
                            r"|master'?s?\s+or\s+(?:equivalent\s+)?(?:honours|honors)"
                            r"|(?:honours|honors)\s+or\s+master")


def parse_bb_education(text: str) -> dict:
    """Plain-text requirement → requiredDegrees + minimum education level.

    ``requiredDegrees == ["All"]`` means "any bachelor's degree".
    ``minEducationLevel`` is one of "" | "diploma" | "bachelor" | "master".
    """
    t = (text or "").lower()
    degrees: list[str] = []
    cse_hit = False
    for pattern, mapped in SPECIFIC_RULES:
        if re.search(pattern, t):
            if mapped[0] == "CSE":
                cse_hit = True
            for d in mapped:
                if d not in degrees:
                    degrees.append(d)
    if cse_hit:
        # "Computer Science" must not drag the generic science subjects in
        degrees = [d for d in degrees if d not in ("Statistics", "Mathematics", "Physics", "Chemistry")]

    open_ended = bool(re.search(OPEN_WORDS, t))
    if not degrees or (open_ended and not degrees):
        degrees = ["All"]
    elif open_ended and len(degrees) > 4:
        # "any discipline" + a very broad keyword hit → treat as open
        degrees = ["All"]

    # minimum education level = the LOWEST level that still satisfies the circular
    has_master = bool(RE_MASTER.search(t))
    has_bachelor = bool(RE_BACHELOR.search(t))
    if has_master and has_bachelor and RE_SOFT_MASTER.search(t):
        level = "bachelor"                    # "Honours/Masters" → either is enough
    elif has_master:
        level = "master"
    elif has_bachelor:
        level = "bachelor"
    elif RE_DIPLOMA.search(t):
        level = "diploma"
    else:
        level = ""

    # experience in years: "2 (two) years", "two years", "minimum 03 years"
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
             "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    exp = 0
    m = re.search(r"(\d{1,2})\s*\)?\s*(?:\(\w+\))?\s*\)?\s*years?\s+of\s+(?:working\s+)?experience", t)
    if m:
        exp = int(m.group(1))
    else:
        m = re.search(r"(\w+)\s+years?\s+of\s+(?:working\s+)?experience", t)
        if m and m.group(1) in words:
            exp = words[m.group(1)]

    # CGPA / class bar ("second class", "at least a second class", "3.00 out of 4")
    cgpa = 0.0
    m = re.search(r"(\d\.\d{1,2})\s*(?:out of|/)\s*4", t)
    if m:
        cgpa = float(m.group(1))

    return {"requiredDegrees": degrees, "minEducationLevel": level,
            "expYears": exp, "minCGPA": cgpa}


# ------------------------------------------------------------ title fields
def _bank_name(position: str) -> str | None:
    """'Principal Officer (Grade-6) for Ansar VDP Unnayan Bank' → 'Ansar VDP Unnayan Bank'."""
    m = re.search(r"\b(?:for|of)\s+(.+?)\s*$", position, flags=re.I)
    if not m:
        return None
    name = m.group(1).strip(" .,;:")
    if not re.search(r"bank|financial institution|\bfi\b|bankers", name, flags=re.I):
        return None
    return name


def _grade_from_title(position: str) -> str:
    """'Principal Officer (Grade-6)' → 'Grade 6'; '(10th Grade)' → 'Grade 10'."""
    m = re.search(r"grade[-\s]*(\d{1,2})", position, flags=re.I)
    if m:
        return f"Grade {int(m.group(1))}"
    m = re.search(r"\((\d{1,2})(?:st|nd|rd|th)\s*grade\)", position, flags=re.I)
    if m:
        return f"Grade {int(m.group(1))}"
    return "Other"


def _publish_date(pdf_url: str, text: str) -> str | None:
    """Circular PDFs are named ``20261005_bscs_321.pdf`` → 2026-10-05."""
    m = re.search(r"/(\d{8})_[^/]*\.pdf", pdf_url or "", flags=re.I)
    if m:
        raw = m.group(1)
        try:
            return dt.datetime.strptime(raw, "%Y%m%d").date().isoformat()
        except ValueError:
            pass
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", text or "")
    if m:
        return _iso_date(m.group(0))
    return None


# ------------------------------------------------------------ page fetch
def fetch(url: str, tries: int = 3, pause: float = 0.8) -> str:
    import time
    import urllib.request

    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/pdf,*/*",
        "Referer": f"{BASE}/",
    })
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:            # noqa: BLE001 - retry then surface
            last = e
            time.sleep(pause * (attempt + 1))
    raise last


def _edu_label(degrees: list[str]) -> str:
    """Short, human readable education tag for the card."""
    if not degrees or degrees == ["All"]:
        return "Any bachelor's degree"
    labels = {"CSE": "CSE", "ICT": "ICT", "SWE": "SWE", "IT": "IT", "EEE": "EEE",
              "ECE": "ECE", "Civil": "Civil", "Mechanical": "Mechanical",
              "Architecture": "Architecture", "BBA": "BBA", "Accounting": "Accounting",
              "Finance": "Finance", "Economics": "Economics", "English": "English",
              "Law": "Law", "Medical": "Medical", "Pharmacy": "Pharmacy",
              "Statistics": "Statistics", "Mathematics": "Mathematics",
              "Physics": "Physics", "Chemistry": "Chemistry"}
    shown = [labels.get(d, d) for d in degrees[:3]]
    extra = f" +{len(degrees) - 3}" if len(degrees) > 3 else ""
    return " / ".join(shown) + extra


def build_job(row: dict, publisher: str, today: str) -> dict | None:
    """One parsed table row → our normalised job record (or None if closed)."""
    position = row["position"]
    if not position or not row["deadline"]:
        return None
    if row["deadline"] < today:            # application window is over
        return None

    pdf = row["pdf"]
    bank = _bank_name(position)
    publisher = (publisher or "").replace("´", "'").replace("`", "'")
    title = re.sub(r"\s*\((?:for|of)\s+.+?\)\s*$", "", position).strip() or position
    # keep the bank visible on the card even when it was inside the title
    if bank and bank.lower() not in title.lower():
        title = f"{title} — {bank}"

    edu = parse_bb_education(row["education"])
    grade = _grade_from_title(position)
    posted = _publish_date(pdf, position + " " + row["education"])
    jid = row["job_id"]
    apply_url = JOBLIST                       # BB accepts applications only through its form

    return {
        # identity -------------------------------------------------------------
        "id": f"b{jid}",
        "sourceId": jid,
        "jobId": jid,
        "title": title,
        "titleBn": None,
        "org": bank or publisher or "Bangladesh Bank",
        "orgBn": None,
        "orgWebsite": BASE,
        "type": "Government Bank",
        "isBank": True,
        "bank": bank,
        "publisher": publisher,
        "edu": _edu_label(edu["requiredDegrees"]),
        "grade": grade,
        # eligibility inputs ----------------------------------------------------
        "requiredDegrees": edu["requiredDegrees"],
        "degreeText": _degree_text(row["education"], edu),
        "degreeSource": "official",
        "degreeRule": "bb-erecruitment-text",
        "minEducationLevel": edu["minEducationLevel"],
        "minCGPA": edu["minCGPA"],
        "ageMin": 0,                          # 0 = not published in this table
        "ageMax": 0,
        "ageOn": row["age_on"],
        "gender": "any",
        "expYears": edu["expYears"],
        "skills": [],
        # posting ----------------------------------------------------------------
        "vacancies": _to_int(row["posts"]),
        "vacancyRaw": row["posts"] or None,
        "vacancyNotSpecific": False,
        "salary": row["salary"] or None,
        "fee": row["fee"] or None,
        "location": "All Bangladesh",
        "allLocations": True,
        "start": posted,
        "deadline": row["deadline"],
        "posted": posted or row["deadline"],
        "advertisementNo": None,
        "advertisementPublished": posted,
        "viewCount": 0,
        # links -----------------------------------------------------------------
        "applyUrl": apply_url,
        "pdfUrl": pdf or JOBLIST,
        "detailUrl": apply_url,
        "docs": [],
        "summary": _summary(title, row),
        "source": "erecruitment.bb.org.bd (Bangladesh Bank eRecruitment)",
        "isLive": True,
    }


def _degree_text(raw: str, edu: dict) -> str:
    base = _clean(raw)
    if not base:
        base = "See the circular PDF."
    extra = []
    if edu["minEducationLevel"]:
        extra.append(f"minimum education level: {edu['minEducationLevel']}")
    if edu["expYears"]:
        extra.append(f"{edu['expYears']} year(s) experience")
    if edu["minCGPA"]:
        extra.append(f"CGPA ≥ {edu['minCGPA']:.2f}/4.00")
    suffix = f" ({'; '.join(extra)})" if extra else ""
    return f"{base}{suffix}"


def _summary(title: str, row: dict) -> str:
    bits = [f"{title} at Bangladesh Bank eRecruitment."]
    if row["posts"]:
        bits.append(f"Vacancies: {row['posts']}.")
    if row["salary"]:
        bits.append(f"Salary: {row['salary']}.")
    if row["fee"]:
        bits.append(f"Application fee {row['fee']}.")
    bits.append("Apply only through the official application form.")
    return " ".join(bits)


def parse_page(page: str, today: str | None = None, limit: int | None = None) -> list[dict]:
    """Parse an already-downloaded joblist.php document into job records."""
    today = today or dt.date.today().isoformat()
    publisher = "Bankers' Selection Committee Secretariat"
    jobs: list[dict] = []
    seen: set[str] = set()

    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S | re.I):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S | re.I)
        if len(cells) == 1:                    # section separator row
            txt = _clean(cells[0])
            if "Advertisement published by" in txt:
                publisher = txt.split(":", 1)[-1].strip() or publisher
            continue
        if len(cells) < 8:
            continue

        pos_cell = cells[1]
        pdf = re.search(r"showpdf\(\s*['\"]([^'\"]+\.pdf)", pos_cell, flags=re.I)
        pdf_url = ""
        if pdf:
            rel = pdf.group(1)
            pdf_url = rel if rel.startswith("http") else f"{BASE}/career/{rel.split('/')[-1]}"

        row = {
            "job_id": _clean(cells[0]),
            "position": _clean(re.sub(r"<a[^>]*>.*?</a>", " ", pos_cell, flags=re.S | re.I)),
            "posts": _clean(cells[2]),
            "salary": _clean(cells[3]),
            "age_on": _clean(cells[4]),
            "education": _clean(cells[5]),
            "fee": _clean(cells[6]),
            "deadline": _iso_date(_clean(cells[7])) or "",
            "pdf": pdf_url,
        }
        if not row["job_id"] or not row["position"] or row["job_id"] in seen:
            continue
        seen.add(row["job_id"])

        job = build_job(row, publisher, today)
        if job:
            jobs.append(job)
        if limit and len(jobs) >= limit:
            break

    return jobs


def collect(today: str | None = None, limit: int | None = None,
            offline_page: str | None = None) -> tuple[list[dict], dict]:
    """Return (jobs, info) — info describes the fetch for the pipeline report.

    Bangladesh Bank puts the site behind Tencent TSPD bot protection: some
    requests (and most data-centre IPs) get a JavaScript challenge instead of the
    table. We try a few times, surface what happened, and let the caller decide
    whether to fall back to the last good snapshot.
    """
    today = today or dt.date.today().isoformat()
    info = {"url": JOBLIST, "ok": False, "count": 0, "blocked": False, "error": None}

    if offline_page is not None:               # tests / snapshot rebuilds
        jobs = parse_page(offline_page, today, limit)
        info.update(ok=True, count=len(jobs))
        return jobs, info

    try:
        page = fetch(JOBLIST)
    except Exception as e:                     # noqa: BLE001
        info["error"] = str(e)
        return [], info

    if "bobcmn" in page or "TSPD" in page:
        info["blocked"] = True
        info["error"] = "bot-protection challenge page returned"
        return [], info

    jobs = parse_page(page, today, limit)
    if not jobs:
        info["error"] = "page loaded but no active jobs were parsed"
        return [], info

    info.update(ok=True, count=len(jobs))
    return jobs, info


if __name__ == "__main__":
    import json
    out, meta = collect()
    print(json.dumps({"source": JOBLIST, **meta}, indent=1))
    for j in out:
        print(f"[{j['jobId']:>6}] {j['title'][:70]}")
        print(f"          grade={j['grade']:<9} posts={j['vacancies']:<4} {j['deadline']}  "
              f"levels={j['minEducationLevel'] or '-':<8} exp={j['expYears']}")
        print(f"          degrees={j['requiredDegrees']}")
        print(f"          edu: {j['degreeText'][:120]}")
        print(f"          pdf={j['pdfUrl'][-34:]}")
