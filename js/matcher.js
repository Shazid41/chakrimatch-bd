/* ============================================================
   ChakriMatch BD — Eligibility engine + smart query parser
   Rule-based matching with explainability ("Why am I eligible?")
   ============================================================ */

/**
 * Evaluate one job against a user profile.
 * @returns {{status:'eligible'|'check'|'not', score:number, checks:Array, verdict:string}}
 */
function evaluateJob(job, profile) {
  const checks = [];
  /* live circulars do not publish an exact qualification — it is inferred from the post title */
  const inferred = job.degreeSource === "inferred";

  /* ---------- 1. DEGREE / SUBJECT (hard) ---------- */
  const accepted = job.requiredDegrees || [];
  const degreeOk = accepted.includes("All") || accepted.includes(profile.major) ||
                   (accepted.includes("General") && profile.major === "General");
  checks.push({
    key: "degree",
    severity: "hard",
    ok: degreeOk,
    label: "Educational qualification",
    required: accepted.map(d => d === "All" ? "Any bachelor's degree" : (DEGREE_LABELS[d] || d)).join(" / "),
    yours: `${profile.degree || profile.major} (${DEGREE_LABELS[profile.major] || profile.major})`,
    failText: `This post asks for ${accepted.filter(d => d !== "All").join(" / ") || "a specific discipline"} ${inferred ? "(matched from the post title) " : ""}but your department is ${profile.major}. Open the circular PDF to confirm before you rule yourself out.`
  });

  /* ---------- 1b. EDUCATION LEVEL (published by bank circulars only) ---------- */
  /* BB eRecruitment states "Master's degree" / "Diploma" in plain text; the
     Teletalk API never does, so minEducationLevel is empty there and we skip. */
  const LEVEL_ORDER = { "": 0, diploma: 1, bachelor: 2, master: 3 };
  const PROFILE_LEVEL = { Diploma: 1, "Bachelor's": 2, Honours: 2, "Master's": 3, PhD: 3 };
  const needLevel = LEVEL_ORDER[job.minEducationLevel || ""] || 0;
  const haveLevel = PROFILE_LEVEL[profile.education] || 0;
  const levelOk = needLevel === 0 || haveLevel === 0 || haveLevel >= needLevel;
  if (needLevel > 0) {
    checks.push({
      key: "level",
      severity: job.degreeSource === "official" ? "hard" : "soft",
      ok: levelOk,
      label: "Education level",
      required: `${job.minEducationLevel.charAt(0).toUpperCase() + job.minEducationLevel.slice(1)} or above`,
      yours: profile.education || "Not provided",
      failText: `This circular asks for at least a ${job.minEducationLevel} degree; your profile says ${profile.education || "no education level"}.`
    });
  }

  /* ---------- 2. CGPA (hard, only when published) ---------- */
  const cgpa = parseFloat(profile.cgpa);
  const hasCgpa = !isNaN(cgpa);
  const minCgpa = parseFloat(job.minCGPA) || 0;
  const cgpaPublished = minCgpa > 0;
  const cgpaOk = !cgpaPublished || !hasCgpa || cgpa >= minCgpa;
  checks.push({
    key: "cgpa",
    severity: "hard",
    ok: cgpaOk,
    label: "Minimum CGPA",
    required: cgpaPublished ? `${minCgpa.toFixed(2)} (out of 4.00)` : "Not published in this summary — see the circular",
    yours: hasCgpa ? `${cgpa.toFixed(2)} (out of 4.00)` : "Not provided",
    failText: `Minimum CGPA ${minCgpa.toFixed(2)} required, you have ${hasCgpa ? cgpa.toFixed(2) : "not entered a CGPA"}.`
  });

  /* ---------- 3. AGE LIMIT (hard) ---------- */
  const age = parseInt(profile.age, 10);
  const hasAge = !isNaN(age);
  const ageOk = !hasAge || (age >= job.ageMin && age <= job.ageMax);
  checks.push({
    key: "age",
    severity: "hard",
    ok: ageOk,
    label: "Age limit",
    required: `${job.ageMin}–${job.ageMax} years`,
    yours: hasAge ? `${age} years` : "Not provided",
    failText: hasAge
      ? `Age limit is ${job.ageMin}–${job.ageMax}; your age is ${age}.`
      : "Age limit unknown — enter your age in the profile."
  });

  /* ---------- 4. GENDER (hard) ---------- */
  const genderOk = job.gender === "any" || job.gender === profile.gender;
  checks.push({
    key: "gender",
    severity: "hard",
    ok: genderOk,
    label: "Gender requirement",
    required: job.gender === "any" ? "Open to all" : `${job.gender === "female" ? "Female" : "Male"} candidates only`,
    yours: profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : "Not provided",
    failText: job.gender === "female"
      ? "This circular is reserved for female candidates."
      : job.gender === "male" ? "This circular is reserved for male candidates." : ""
  });

  /* ---------- 5. EXPERIENCE (hard) ---------- */
  const exp = parseFloat(profile.experience) || 0;
  const expOk = exp >= (job.expYears || 0);
  checks.push({
    key: "experience",
    severity: "hard",
    ok: expOk,
    label: "Experience",
    required: job.expYears > 0 ? `${job.expYears} year(s) required` : "Not required",
    yours: `${exp} year(s)`,
    failText: job.expYears > 0
      ? `This post requires ${job.expYears} year(s) of experience; you have ${exp}.`
      : ""
  });

  /* ---------- 6. LOCATION (soft) ---------- */
  const samePlace = !profile.location || !job.location ||
    job.allLocations ||
    job.location.toLowerCase().includes((profile.location || "").toLowerCase()) ||
    (profile.location || "").toLowerCase().includes((job.location || "").toLowerCase());
  const wantsHome = profile.relocate === "no";
  const locationOk = !(wantsHome && !samePlace);
  checks.push({
    key: "location",
    severity: "soft",
    ok: locationOk,
    label: "Job location",
    required: `${job.location}${job.allLocations ? " (posting anywhere possible)" : ""}`,
    yours: profile.relocate === "no"
      ? `Only ${profile.location || "your location"}`
      : `Willing to relocate from ${profile.location || "—"}`
  });

  /* ---------- 7. SKILLS (informational — never changes the verdict) ---------- */
  /* The live circulars do not publish a skill list, so these are only hints
     guessed from the post title. Shown for reference, never used to fail you. */
  const userSkills = (profile.skills || []).map(s => s.toLowerCase());
  const wanted = job.skills || [];
  const missingSkills = wanted.filter(s => !userSkills.includes(s.toLowerCase()));
  const skillsOk = missingSkills.length === 0;
  if (wanted.length) {
    checks.push({
      key: "skills",
      severity: "info",
      ok: skillsOk,
      label: "Skills (hint only)",
      required: wanted.join(", "),
      yours: (profile.skills || []).length ? profile.skills.join(", ") : "No skills added",
      warnText: missingSkills.length ? `Not in your profile: ${missingSkills.join(", ")}` : ""
    });
  }

  /* ---------- 8. PREFERRED GRADE (soft) ---------- */
  const prefGrades = profile.grades || [];
  const gradePublished = !!job.grade && job.grade !== "Other";
  const gradeOk = prefGrades.length === 0 || !gradePublished || prefGrades.includes(job.grade);
  checks.push({
    key: "grade",
    severity: "soft",
    ok: gradeOk,
    label: "Your grade preference",
    required: gradePublished ? job.grade : "Grade not published in this summary",
    yours: prefGrades.length ? prefGrades.join(", ") : "No preference set",
    warnText: gradeOk ? "" : `${job.grade} is outside the grades you picked.`
  });

  /* ---------- 9. JOB TYPE PREFERENCE (soft) ---------- */
  const prefTypes = profile.jobTypes || [];
  const typeOk = prefTypes.length === 0 || prefTypes.includes(job.type) ||
    prefTypes.includes(job.edu) || (job.isBank && prefTypes.includes("Government Bank"));
  checks.push({
    key: "type",
    severity: "soft",
    ok: typeOk,
    label: "Your job-type preference",
    required: `${job.type}${job.bank ? ` · ${job.bank}` : ""}`,
    yours: prefTypes.length ? prefTypes.join(", ") : "No preference set",
    warnText: typeOk ? "" : `${job.type} is not one of the job types you picked.`
  });

  /* ---------- verdict ---------- */
  const hardFail = checks.find(c => c.severity === "hard" && !c.ok);
  const softWarns = checks.filter(c => c.severity === "soft" && !c.ok);
  let status;
  if (hardFail) status = "not";
  else if (softWarns.length) status = "check";
  else status = "eligible";

  const passed = checks.filter(c => c.ok).length;
  let score = Math.round((passed / checks.length) * 100);
  if (status === "not") score = Math.min(score, 45);

  /* every warning is a preference you set → say so instead of "check requirements" */
  const PREF_KEYS = ["type", "grade", "location"];
  const prefOnly = status === "check" && softWarns.every(c => PREF_KEYS.includes(c.key));

  let verdict;
  const inferredNote = inferred
    ? " The qualification shown is inferred from the post title — always confirm it in the official circular PDF."
    : "";
  if (status === "eligible") {
    verdict = `You are eligible for this post — required degree, age, CGPA and experience all match your profile.${inferredNote}`;
  } else if (prefOnly) {
    verdict = `Nothing disqualifies you: this job matches your qualification, age and experience. Only your own preferences (${softWarns.map(s => s.label.toLowerCase()).join(", ")}) do not match — you can still apply.${inferredNote}`;
  } else if (status === "check") {
    verdict = `Core requirements are met, but ${softWarns.length} item${softWarns.length > 1 ? "s need" : " needs"} a closer look: ${softWarns.map(s => s.label.toLowerCase()).join(", ")}. Read the full circular before applying.${inferredNote}`;
  } else {
    verdict = `Not eligible: ${hardFail.failText || hardFail.label + " does not match your profile."}`;
  }

  return { status, score, checks, verdict, hardFail, softWarns, prefOnly };
}

/** Human readable status label */
function statusLabel(status, ev) {
  if (status === "eligible") return "✅ Eligible";
  if (status === "check") return ev && ev.prefOnly ? "⚠️ Outside your preferences" : "⚠️ Check requirements";
  return "❌ Not Eligible";
}

/* ============================================================
   Natural-language query parser (Bangla + English)
   e.g. "আমি CSE graduate, বয়স ২৪, ঢাকার বাইরে হলেও সমস্যা নেই, ৯-১৩ গ্রেডের চাকরি চাই"
   ============================================================ */
const BN_DIGITS = { "০":"0","১":"1","২":"2","৩":"3","৪":"4","৫":"5","৬":"6","৭":"7","৮":"8","৯":"9" };

function toEnglishDigits(str) {
  return String(str).replace(/[০-৯]/g, d => BN_DIGITS[d]);
}

function parseSmartQuery(raw) {
  const q = toEnglishDigits(raw).toLowerCase();
  const out = {
    majors: [], grades: [], age: null, gender: null,
    relocate: null, keywords: [], deadlineDays: null, titleWords: [],
    jobTypes: [], minLevel: null, sortHint: null
  };

  /* majors */
  const majorMap = {
    cse:"CSE", "কম্পিউটার":"CSE", "কম্পিউটার সায়েন্স":"CSE", "সফটওয়্যার":"SWE",
    ict:"ICT", "আইসিটি":"ICT", "তথ্য প্রযুক্তি":"ICT", "it":"IT",
    "information technology":"IT", "software":"SWE", "cyber":"CSE", "network":"CSE",
    eee:"EEE", electrical:"EEE", "ইলেকট্রিক্যাল":"EEE", ece:"ECE", electronics:"ECE",
    civil:"Civil", "সিভিল":"Civil", "মেকানিক্যাল":"Mechanical", mechanical:"Mechanical",
    architecture:"Architecture", "আর্কিটেকচার":"Architecture",
    bba:"BBA", accounting:"Accounting", "অ্যাকাউন্টিং":"Accounting",
    finance:"Finance", "ফাইন্যান্স":"Finance", economics:"Economics", "অর্থনীতি":"Economics",
    "english":"English", "ইংরেজি":"English", law:"Law", "আইন":"Law",
    medical:"Medical", "মেডিকেল":"Medical", pharmacy:"Pharmacy", "ফার্মেসি":"Pharmacy",
    statistics:"Statistics", "স্ট্যাটিস্টিক্স":"Statistics", mathematics:"Mathematics",
    "math":"Mathematics", "গণিত":"Mathematics", physics:"Physics", chemistry:"Chemistry",
    "বাংলা":"General"
  };
  Object.keys(majorMap).forEach(k => {
    const re = new RegExp(`(^|[^a-z\\u0980-\\u09ff])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z\\u0980-\\u09ff]|$)`, "i");
    if (re.test(q) && !out.majors.includes(majorMap[k])) out.majors.push(majorMap[k]);
  });

  /* job type — "ব্যাংক", "bank job", "মন্ত্রণালয়", "পরিদপ্তর", "bcs" … */
  const typeMap = [
    [[/ব্যাংক|bank(ing)? job|সরকারি ব্যাংক/], "Government Bank"],
    [[/বিসিএস|\bbcs\b/], "BCS"],
    [[/মন্ত্রণালয়|ministry/], "Ministry"],
    [[/পরিদপ্তর|director(ate)?\b/], "Directorate"],
    [[/স্বায়ত্তশাসিত|autonomous/], "Autonomous Organization"],
    [[/বিশ্ববিদ্যালয়|university/], "Government University"],
    [[/কলেজ|college/], "Government College"],
    [[/তথ্য প্রযুক্তি|আইসিটি চাকরি|ict job/], "ICT Jobs"],
    [[/টেকনিক্যাল|technical/], "Technical Jobs"],
    [[/নন[- ]?ক্যাডার|non[- ]?cadre/], "Non-Cadre"]
  ];
  typeMap.forEach(([patterns, type]) => {
    if (patterns.some(p => p.test(q)) && !out.jobTypes.includes(type)) out.jobTypes.push(type);
  });

  /* minimum education level — "মাস্টার্স", "স্নাতক", "ডিপ্লোমা" */
  if (/মাস্টার্স|মাস্টার |masters?|post.?graduate|পরাস্নাতক/.test(q)) out.minLevel = "master";
  else if (/ডিপ্লোমা|diploma/.test(q)) out.minLevel = "diploma";
  else if (/স্নাতক|bachelor|honours|honors|graduation/.test(q)) out.minLevel = "bachelor";

  /* sort hints — "নতুন", "recent", "শেষ দিন", "ending soon" */
  if (/ending soon|শেষ দিন|শীঘ্রই শেষ|last date|deadline soon|closest deadline/.test(q)) {
    out.sortHint = "deadline";
  } else if (/recent|নতুন|latest|সর্বশেষ|new circular|নতুন চাকরি/.test(q)) {
    out.sortHint = "recent";
  }

  /* age: "বয়স ২৪" / "age 24" / "২৪ বছর" */
  const ageMatch = q.match(/(?:বয়স|age)\D{0,6}(\d{1,2})/) || q.match(/(\d{1,2})\s*(?:বছর|years? old|yo)/);
  if (ageMatch) out.age = parseInt(ageMatch[1], 10);

  /* grades: "৯-১৩ গ্রেড" / "grade 9-12" / "9 থেকে 13" */
  const gradeRange = q.match(/grade[s]?\s*(\d{1,2})\s*(?:-|–|to|থেকে)\s*(\d{1,2})/) ||
                     q.match(/(\d{1,2})\s*(?:-|–|to|থেকে)\s*(\d{1,2})\s*গ্রেড/) ||
                     q.match(/(\d{1,2})\s*(?:-|–|to|থেকে)\s*(\d{1,2})/);
  if (gradeRange) {
    const a = parseInt(gradeRange[1], 10), b = parseInt(gradeRange[2], 10);
    if (a >= 1 && b <= 16 && b > a) {
      for (let g = a; g <= b; g++) {
        const found = GRADES.find(x => x === `Grade ${g}`);
        if (found && !out.grades.includes(found)) out.grades.push(found);
      }
    }
  } else {
    const single = q.match(/grade\s*(\d{1,2})/);
    if (single) {
      const g = GRADES.find(x => x === `Grade ${single[1]}`);
      if (g) out.grades.push(g);
    }
  }

  /* gender */
  if (/female|মহিলা|নারী|women/.test(q)) out.gender = "female";
  else if (/male|পুরুষ/.test(q)) out.gender = "male";

  /* relocation */
  if (/ঢাকার বাইরে|outside dhaka|anywhere|বাইরে হলেও সমস্যা নেই|relocate|যেকোনো জায়গা/.test(q)) out.relocate = "yes";
  if (/শুধু ঢাকা|only dhaka|ঢাকায় চাই|no relocation/.test(q)) out.relocate = "no";

  /* deadline horizon */
  if (/next month|আগামী মাস/.test(q)) out.deadlineDays = 45;
  if (/this month|এ মাস/.test(q)) out.deadlineDays = 30;

  /* remaining words → keywords (drop stopwords / already-consumed numbers) */
  const stop = new Set([
    // Bangla
    "আমি","চাই","চাও","হলেও","সমস্যা","নেই","এর","করে","করা","চাকরি","সরকারি","বয়স",
    "গ্রেড","গ্রেডের","খুঁজে","দাও","শুধু","মাস","আগামী","জন্য","এবং","থেকে","বাইরে",
    "হয়ে","থাকে","কোনো","দিয়ে","সাথে","খুঁজি","চাইলে","লাগবে","লাগে","মানে","হয়",
    "ঢাকার","ঢাকায়","ঢাকা","চট্টগ্রাম","চট্টগ্রামে","নারী","পুরুষ",
    "ব্যাংক","ব্যাংকে","ব্যাংকের","মন্ত্রণালয়","পরিদপ্তর","পরিদপ্তরে","স্বায়ত্তশাসিত",
    "বিশ্ববিদ্যালয়","বিশ্ববিদ্যালয়ে","কলেজ","কলেজে","টেকনিক্যাল","নন","ক্যাডার",
    "মাস্টার্স","মাস্টার","স্নাতক","স্নাতকোত্তর","ডিপ্লোমা","পরাস্নাতক",
    "নতুন","নতুনই","সর্বশেষ","শেষ","দিনের","দিন","শীঘ্রই",
    "আইসিটি","তথ্য","প্রযুক্তি","ইলেকট্রিক্যাল","সিভিল","আর্কিটেকচার","আইন",
    "অ্যাকাউন্টিং","ফাইন্যান্স","অর্থনীতি","ইংরেজি","মেডিকেল","ফার্মেসি","বাংলা",
    // English
    "the","a","an","of","for","in","my","me","i","to","and","or","with","job","jobs",
    "want","wants","find","please","degree","graduate","govt","government","any","some",
    "age","years","year","old","grade","grades","deadline","next","month","am","is","are",
    "per","related","post","posts","apply","new","all","out","only","who","which",
    "female","male","women","men","girl","boy","anywhere","dhaka","chattogram",
    "bank","banks","banking","ministry","directorate","autonomous","university","college",
    "technical","cadre","recent","latest","soon","ending","close","circular","circulars",
    "masters","master","bachelor","bachelors","honours","honors","diploma","graduation"
  ]);

  // remove numeric ranges already captured (grade range / age) so they don't become keywords
  let text = q
    .replace(/grade[s]?\s*\d{1,2}\s*(?:-|–|to|থেকে)\s*\d{1,2}/g, " ")
    .replace(/\b(?:বয়স|age)\D{0,6}\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}\s*(?:-|–)\s*\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}\s*(?:বছর|years?)\b/g, " ");

  out.titleWords = text
    .replace(/[^\p{L}\p{M}\s]/gu, " ")   // keep letters (incl. Bangla combining marks) only
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !stop.has(w))
    .filter(w => !Object.keys(majorMap).includes(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
  if (out.titleWords.length > 6) out.titleWords = out.titleWords.slice(0, 6);

  return out;
}
