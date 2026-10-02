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

  /* ---------- 7. SKILLS (soft) ---------- */
  const userSkills = (profile.skills || []).map(s => s.toLowerCase());
  const wanted = job.skills || [];
  const missingSkills = wanted.filter(s => !userSkills.includes(s.toLowerCase()));
  const skillsOk = missingSkills.length === 0;
  checks.push({
    key: "skills",
    severity: "soft",
    ok: skillsOk,
    label: "Required skills",
    required: wanted.length ? wanted.join(", ") : "No specific skill listed",
    yours: (profile.skills || []).length ? profile.skills.join(", ") : "No skills added",
    warnText: missingSkills.length ? `Missing: ${missingSkills.join(", ")}` : ""
  });

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
    yours: prefGrades.length ? prefGrades.join(", ") : "No preference set"
  });

  /* ---------- 9. JOB TYPE PREFERENCE (soft) ---------- */
  const prefTypes = profile.jobTypes || [];
  const typeOk = prefTypes.length === 0 || prefTypes.includes(job.type) || prefTypes.includes(job.edu);
  checks.push({
    key: "type",
    severity: "soft",
    ok: typeOk,
    label: "Your job-type preference",
    required: `${job.type} · ${job.edu}`,
    yours: prefTypes.length ? prefTypes.join(", ") : "No preference set"
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

  let verdict;
  const inferredNote = inferred
    ? " The qualification shown is inferred from the post title — always confirm it in the official circular PDF."
    : "";
  if (status === "eligible") {
    verdict = `You are eligible for this post — required degree, age, CGPA and experience all match your profile.${inferredNote}`;
  } else if (status === "check") {
    verdict = `Core requirements are met, but ${softWarns.length} item${softWarns.length > 1 ? "s need" : " needs"} a closer look: ${softWarns.map(s => s.label.toLowerCase()).join(", ")}. Read the full circular before applying.${inferredNote}`;
  } else {
    verdict = `Not eligible: ${hardFail.failText || hardFail.label + " does not match your profile."}`;
  }

  return { status, score, checks, verdict, hardFail, softWarns };
}

/** Human readable status label */
function statusLabel(status) {
  return status === "eligible" ? "✅ Eligible"
    : status === "check" ? "⚠️ Check Requirements"
    : "❌ Not Eligible";
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
    relocate: null, keywords: [], deadlineDays: null, titleWords: []
  };

  /* majors */
  const majorMap = {
    cse:"CSE", "computer science":"CSE", "কম্পিউটার":"CSE",
    ict:"ICT", "it":"IT", "information technology":"IT", "software":"SWE",
    eee:"EEE", "electrical":"EEE", ece:"ECE", "civil":"Civil", "মেকানিক্যাল":"Mechanical",
    bba:"BBA", accounting:"Accounting", finance:"Finance", economics:"Economics",
    "english":"English", law:"Law", medical:"Medical", pharmacy:"Pharmacy",
    statistics:"Statistics", mathematics:"Mathematics", "math":"Mathematics",
    "গণিত":"Mathematics", "স্ট্যাটিস্টিক্স":"Statistics"
  };
  Object.keys(majorMap).forEach(k => {
    const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (re.test(q) && !out.majors.includes(majorMap[k])) out.majors.push(majorMap[k]);
  });
  if (out.majors.length === 0 && /graduate|毕业生|সরকারি চাকরি|govt|government/.test(q)) {
    // no specific major mentioned — leave open
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
    // English
    "the","a","an","of","for","in","my","me","i","to","and","or","with","job","jobs",
    "want","wants","find","please","degree","graduate","govt","government","any","some",
    "age","years","year","old","grade","grades","deadline","next","month","am","is","are",
    "per","related","post","posts","apply","new","all","out","only","who","which",
    "female","male","women","men","girl","boy","anywhere","dhaka","chattogram"
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
