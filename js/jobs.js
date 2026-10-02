/* ============================================================
   ChakriMatch BD — sample circular database
   (demo data; live version = crawler + AI parser output)
   ============================================================ */

const MAJORS = [
  "CSE","ICT","SWE","IT","EEE","ECE","Civil","Mechanical","Architecture",
  "BBA","Accounting","Finance","Economics","English","Law","Medical","Pharmacy",
  "Statistics","Mathematics","Physics","Chemistry","General"
];

const DEGREE_LABELS = {
  CSE:"Computer Science & Engineering", ICT:"Information & Communication Technology",
  SWE:"Software Engineering", IT:"Information Technology", EEE:"Electrical & Electronic Engineering",
  ECE:"Electronics & Communication", Civil:"Civil Engineering", Mechanical:"Mechanical Engineering",
  Architecture:"Architecture", BBA:"Business Administration", Accounting:"Accounting",
  Finance:"Finance", Economics:"Economics", English:"English", Law:"Law",
  Medical:"MBBS / Medical", Pharmacy:"Pharmacy", Statistics:"Statistics",
  Mathematics:"Mathematics", Physics:"Physics", Chemistry:"Chemistry",
  General:"Any 4-year Bachelor's degree"
};

const JOB_TYPES = [
  "BCS","Non-Cadre","Government Bank","Ministry","Directorate",
  "Autonomous Organization","Government University","Government College","ICT Jobs","Technical Jobs"
];

const GRADES = ["Grade 9","Grade 10","Grade 11","Grade 12","Grade 13","Grade 14","Grade 15","Grade 16","Other"];

/* ---------- core circulars (already in database) ---------- */
const JOBS = [
  {
    id:"j01", title:"BCS (ICT) Cadre — 37th Bangladesh Civil Service",
    org:"Public Service Commission (PSC)", type:"BCS", edu:"ICT Jobs", grade:"Grade 9",
    vacancies:45, requiredDegrees:["CSE","ICT","SWE","IT","EEE","ECE","Statistics","Mathematics"],
    degreeText:"Bachelor's degree in Computer Science & Engineering / ICT / EEE / ECE / Mathematics / Statistics or equivalent",
    minCGPA:2.50, cgpaScale:4, ageMin:21, ageMax:32, gender:"any", expYears:0,
    skills:["Programming","Computer Basics"],
    salary:"Grade 9 — ৳22,000–53,060", location:"All Bangladesh", allLocations:true,
    start:"2026-09-20", deadline:"2026-11-30", posted:"2026-09-21",
    applyUrl:"https://bcsc.teletalk.com.bd", pdfUrl:"https://www.psc.gov.bd",
    docs:["Online application form","Admit card","All academic certificates & transcripts","NID / Birth certificate","Citizenship certificate","Passport size photographs"],
    summary:"47th BCS equivalent special recruitment for ICT cadre posts across ministries, directorates and autonomous bodies."
  },
  {
    id:"j02", title:"Computer Programmer",
    org:"Directorate of Secondary & Higher Education (DSHE)", type:"Directorate", edu:"CSE", grade:"Grade 9",
    vacancies:18, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's degree in Computer Science and Engineering or equivalent degree",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Programming"],
    salary:"Grade 9 — ৳22,000–53,060", location:"Dhaka", allLocations:true,
    start:"2026-10-01", deadline:"2026-10-20", posted:"2026-09-30",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://dshe.gov.bd",
    docs:["Online application copy","Admit card","Certificates & transcripts","NID","Photographs"],
    summary:"Development and maintenance of DSHE management information systems and online education portals."
  },
  {
    id:"j03", title:"Assistant Programmer",
    org:"Access to Information (a2i) Programme, ICT Division", type:"Ministry", edu:"ICT Jobs", grade:"Grade 10",
    vacancies:12, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's degree in CSE / ICT / Software Engineering or equivalent",
    minCGPA:2.75, cgpaScale:4, ageMin:18, ageMax:30, gender:"any", expYears:0,
    skills:["Programming","Web Development"],
    salary:"Grade 10 — ৳16,000–38,640", location:"Dhaka", allLocations:true,
    start:"2026-10-05", deadline:"2026-10-25", posted:"2026-10-01",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://a2i.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Build digital public services and citizen portals under the a2i programme."
  },
  {
    id:"j04", title:"ICT Officer",
    org:"Bangladesh Election Commission (EC)", type:"Autonomous Organization", edu:"ICT Jobs", grade:"Grade 9",
    vacancies:9, requiredDegrees:["CSE","ICT","SWE","IT","EEE","ECE"],
    degreeText:"Bachelor's degree in CSE / ICT / EEE / ECE or equivalent",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Networking"],
    salary:"Grade 9 — ৳22,000–53,060", location:"Dhaka", allLocations:true,
    start:"2026-10-04", deadline:"2026-10-30", posted:"2026-10-02",
    applyUrl:"https://ec.teletalk.com.bd", pdfUrl:"https://election.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"EVM rollout support, voter database systems and internal network management."
  },
  {
    id:"j05", title:"System Analyst (IT)",
    org:"Bangladesh Bank — IT Division", type:"Government Bank", edu:"CSE", grade:"Grade 8",
    vacancies:6, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's / Master's in CSE, ICT or Software Engineering with strong academic results",
    minCGPA:3.25, cgpaScale:4, ageMin:20, ageMax:35, gender:"any", expYears:2,
    skills:["Programming","Database"],
    salary:"Grade 8 — ৳35,500–69,870", location:"Dhaka", allLocations:false,
    start:"2026-10-10", deadline:"2026-11-05", posted:"2026-10-03",
    applyUrl:"https://www.bb.org.bd/career", pdfUrl:"https://www.bb.org.bd",
    docs:["Online application","Certificates & transcripts","Experience certificates","NID","Photographs"],
    summary:"Core banking systems, risk analytics platforms and cybersecurity operations."
  },
  {
    id:"j06", title:"Network Engineer",
    org:"Bangladesh Telecommunication Regulatory Commission (BTRC)", type:"Autonomous Organization", edu:"ICT Jobs", grade:"Grade 8",
    vacancies:7, requiredDegrees:["CSE","ICT","EEE","ECE","IT"],
    degreeText:"Bachelor's degree in CSE / ICT / EEE / ECE or equivalent",
    minCGPA:3.00, cgpaScale:4, ageMin:20, ageMax:32, gender:"any", expYears:0,
    skills:["Networking","CCNA"],
    salary:"Grade 8 — ৳35,500–69,870", location:"Dhaka", allLocations:true,
    start:"2026-10-08", deadline:"2026-11-12", posted:"2026-10-04",
    applyUrl:"https://www.btrc.gov.bd/career", pdfUrl:"https://www.btrc.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"National telecom infrastructure monitoring, spectrum and ISP licensing systems."
  },
  {
    id:"j07", title:"Assistant Engineer (ICT)",
    org:"Local Government Engineering Department (LGED)", type:"Directorate", edu:"CSE", grade:"Grade 9",
    vacancies:22, requiredDegrees:["CSE","ICT","EEE","ECE"],
    degreeText:"Bachelor's degree in CSE / ICT / EEE / ECE — 4 years engineering program (or equivalent)",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["GIS","Programming"],
    salary:"Grade 9 — ৳22,000–53,060", location:"All Districts", allLocations:true,
    start:"2026-10-02", deadline:"2026-10-18", posted:"2026-09-28",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://lged.gov.bd",
    docs:["Online application","Admit card","Certificates & transcripts","NID","Photographs"],
    summary:"Rural infrastructure digitization, GIS mapping and e-governance systems at district level.",
    note:"Additional screening test / viva voce may apply — check the full circular."
  },
  {
    id:"j08", title:"Assistant Engineer (Civil)",
    org:"Local Government Engineering Department (LGED)", type:"Directorate", edu:"Civil", grade:"Grade 9",
    vacancies:60, requiredDegrees:["Civil"],
    degreeText:"Bachelor's degree in Civil Engineering from a recognized university",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:[], salary:"Grade 9 — ৳22,000–53,060", location:"All Districts", allLocations:true,
    start:"2026-10-02", deadline:"2026-10-18", posted:"2026-09-28",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://lged.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Road, bridge and drainage construction supervision."
  },
  {
    id:"j09", title:"Sub-Assistant Engineer (Electrical)",
    org:"Electricity Distribution Company (REB / DESCO)", type:"Autonomous Organization", edu:"EEE", grade:"Grade 12",
    vacancies:35, requiredDegrees:["EEE","Electrical"],
    degreeText:"Diploma / B.Sc. in Electrical & Electronic Engineering",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:30, gender:"any", expYears:0,
    skills:[], salary:"Grade 12 — ৳12,500–30,230", location:"All Regions", allLocations:true,
    start:"2026-10-06", deadline:"2026-10-27", posted:"2026-10-02",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://www.descobd.com",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Distribution network maintenance and consumer services."
  },
  {
    id:"j10", title:"Software Developer (FIMS)",
    org:"Controller General of Accounts (CGA) — Financial Information Management System", type:"Ministry", edu:"CSE", grade:"Grade 10",
    vacancies:8, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's degree in CSE / ICT / Software Engineering or equivalent",
    minCGPA:3.00, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Programming","Web Development"],
    salary:"Grade 10 — ৳16,000–38,640", location:"Dhaka", allLocations:true,
    start:"2026-10-03", deadline:"2026-10-28", posted:"2026-10-01",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://cga.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"National financial management and accounting system development."
  },
  {
    id:"j11", title:"Data Manager (MIS)",
    org:"Bangladesh Bureau of Statistics (BBS)", type:"Directorate", edu:"General", grade:"Grade 11",
    vacancies:14, requiredDegrees:["Statistics","Mathematics","CSE","ICT","Economics"],
    degreeText:"Bachelor's degree in Statistics / Mathematics / CSE / ICT / Economics",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Database"],
    salary:"Grade 11 — ৳13,500–32,600", location:"Dhaka", allLocations:true,
    start:"2026-10-07", deadline:"2026-11-01", posted:"2026-10-03",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://bbs.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"National census / survey data management and visualization."
  },
  {
    id:"j12", title:"Assistant Programmer",
    org:"Bangladesh Supreme Court — IT Wing", type:"Non-Cadre", edu:"ICT Jobs", grade:"Grade 10",
    vacancies:5, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's degree in CSE / ICT / Software Engineering or equivalent",
    minCGPA:2.75, cgpaScale:4, ageMin:18, ageMax:30, gender:"any", expYears:0,
    skills:["Programming"],
    salary:"Grade 10 — ৳16,000–38,640", location:"Dhaka", allLocations:true,
    start:"2026-10-09", deadline:"2026-11-08", posted:"2026-10-05",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://supremecourt.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Case management information system and e-judiciary applications."
  },
  {
    id:"j13", title:"Officer (IT) — Direct Recruitment",
    org:"Sonali Bank PLC", type:"Government Bank", edu:"All Graduates", grade:"Grade 13",
    vacancies:240, requiredDegrees:["CSE","ICT","IT","BBA","Accounting","Finance","General"],
    degreeText:"4-year Bachelor's degree in any discipline (ICT/BBA/CS background preferred for IT unit)",
    minCGPA:2.50, cgpaScale:4, ageMin:21, ageMax:30, gender:"any", expYears:0,
    skills:[],
    salary:"Grade 13 — ৳11,000–26,590 + bank benefits", location:"All Bangladesh", allLocations:true,
    start:"2026-10-05", deadline:"2026-11-15", posted:"2026-10-04",
    applyUrl:"https://www.sonalibank.com.bd/career", pdfUrl:"https://www.sonalibank.com.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Branch banking operations; IT unit handles core banking application support."
  },
  {
    id:"j14", title:"Instructor (Computer)",
    org:"Directorate of Technical Education — Govt. Polytechnic Institutes", type:"Technical Jobs", edu:"Technical Jobs", grade:"Grade 10",
    vacancies:28, requiredDegrees:["CSE","ICT","SWE","IT","EEE"],
    degreeText:"Bachelor's in CSE / ICT / EEE, plus 2 years industrial or teaching experience",
    minCGPA:2.50, cgpaScale:4, ageMin:20, ageMax:35, gender:"any", expYears:2,
    skills:["Programming"],
    salary:"Grade 10 — ৳16,000–38,640", location:"All Districts", allLocations:true,
    start:"2026-10-04", deadline:"2026-11-03", posted:"2026-10-02",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://dte.gov.bd",
    docs:["Online application","Experience certificates","Certificates & transcripts","NID","Photographs"],
    summary:"Teaching computer technology subjects in government polytechnic institutes."
  },
  {
    id:"j15", title:"Research Assistant (ICT Research)",
    org:"Bangladesh Institute of ICT in Development (BIID / CIRDAP-adjacent)", type:"Autonomous Organization", edu:"ICT Jobs", grade:"Grade 12",
    vacancies:6, requiredDegrees:["CSE","ICT","Economics","Statistics"],
    degreeText:"Bachelor's in CSE / ICT / Statistics / Economics",
    minCGPA:2.75, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Research","Data Analysis"],
    salary:"Grade 12 — ৳12,500–30,230", location:"Dhaka", allLocations:true,
    start:"2026-10-11", deadline:"2026-10-29", posted:"2026-10-06",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://www.biid.org.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Digital public service research, field data collection and analysis."
  },
  {
    id:"j16", title:"Junior Teacher (ICT) — Women only",
    org:"Government Girls' High School, Directorate of Secondary & Higher Education", type:"Government College", edu:"General", grade:"Grade 14",
    vacancies:40, requiredDegrees:["CSE","ICT","Mathematics","Statistics","General"],
    degreeText:"Bachelor's degree with ICT / CSE / Mathematics as a subject — female candidates only",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"female", expYears:0,
    skills:[], salary:"Grade 14 — ৳10,200–24,570", location:"All Districts", allLocations:true,
    start:"2026-10-06", deadline:"2026-10-26", posted:"2026-10-03",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://dshe.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Teaching ICT at secondary level; 5 years service age relaxation for female candidates."
  },
  {
    id:"j17", title:"Assistant Director (Management Audit)",
    org:"Office of the Comptroller & Auditor General (C&AG)", type:"Non-Cadre", edu:"General", grade:"Grade 9",
    vacancies:16, requiredDegrees:["Accounting","Finance","BBA","Economics","General"],
    degreeText:"Bachelor's degree in Accounting / Finance / BBA / Economics (Honours preferred)",
    minCGPA:3.00, cgpaScale:4, ageMin:21, ageMax:32, gender:"any", expYears:0,
    skills:[], salary:"Grade 9 — ৳22,000–53,060", location:"Dhaka", allLocations:true,
    start:"2026-10-01", deadline:"2026-11-10", posted:"2026-09-30",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://cagbd.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Government financial audit and compliance review."
  },
  {
    id:"j18", title:"Assistant Professor (Computer Science)",
    org:"Government College — Department of Computer Science & Engineering", type:"Government College", edu:"CSE", grade:"Grade 7",
    vacancies:11, requiredDegrees:["CSE","ICT"],
    degreeText:"Master's in CSE / ICT with minimum CGPA 3.50 in Bachelor's and 3.00 in Master's (or equivalent)",
    minCGPA:3.50, cgpaScale:4, ageMin:21, ageMax:35, gender:"any", expYears:0,
    skills:["Research"], salary:"Grade 7 — ৳40,000–97,000", location:"All Districts", allLocations:true,
    start:"2026-09-28", deadline:"2026-10-22", posted:"2026-09-27",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://moedu.gov.bd",
    docs:["Online application","Transcripts & testimonials","Publications list","NID","Photographs"],
    summary:"Teaching and research in CSE departments at government colleges."
  },
  {
    id:"j19", title:"Assistant Programmer",
    org:"Election Commission Secretariat — ICT Cell", type:"Autonomous Organization", edu:"ICT Jobs", grade:"Grade 10",
    vacancies:10, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's degree in CSE / ICT / Software Engineering or equivalent",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:30, gender:"any", expYears:0,
    skills:["Programming","Database"],
    salary:"Grade 10 — ৳16,000–38,640", location:"Dhaka", allLocations:true,
    start:"2026-10-12", deadline:"2026-11-06", posted:"2026-10-07",
    applyUrl:"https://ec.teletalk.com.bd", pdfUrl:"https://election.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Voter database applications and results portal development."
  },
  {
    id:"j20", title:"Lab Engineer / Computer Lab Incharge",
    org:"Government Polytechnic Institute, Chattogram", type:"Technical Jobs", edu:"Technical Jobs", grade:"Grade 11",
    vacancies:8, requiredDegrees:["CSE","ICT","IT","EEE"],
    degreeText:"Bachelor's in CSE / ICT / IT / EEE with 1 year practical experience preferred",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Networking","Hardware"],
    salary:"Grade 11 — ৳13,500–32,600", location:"Chattogram", allLocations:true,
    start:"2026-10-10", deadline:"2026-11-02", posted:"2026-10-06",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://dte.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Laboratory maintenance and practical class support."
  }
];

/* ---------- incoming circulars (simulates the crawler finding new notices) ---------- */
const INCOMING_JOBS = [
  {
    id:"n01", title:"ICT Officer (New Post)",
    org:"Bangladesh Railway — ICT Directorate", type:"Autonomous Organization", edu:"ICT Jobs", grade:"Grade 9",
    vacancies:15, requiredDegrees:["CSE","ICT","SWE","IT","EEE","ECE"],
    degreeText:"Bachelor's degree in CSE / ICT / EEE / ECE or equivalent",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Networking","Programming"],
    salary:"Grade 9 — ৳22,000–53,060", location:"All Bangladesh", allLocations:true,
    start:"2026-10-14", deadline:"2026-11-18", posted:"2026-10-14",
    applyUrl:"https://railway.teletalk.com.bd", pdfUrl:"https://railway.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Railway operations digitization, freight management system and station IT networks.",
    fresh:true
  },
  {
    id:"n02", title:"Database Administrator",
    org:"ICT Division — Data Center & Cloud (DCC)", type:"Ministry", edu:"CSE", grade:"Grade 8",
    vacancies:4, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's in CSE / ICT / Software Engineering with 3 years database administration experience",
    minCGPA:3.00, cgpaScale:4, ageMin:22, ageMax:35, gender:"any", expYears:3,
    skills:["Database","Programming"],
    salary:"Grade 8 — ৳35,500–69,870", location:"Dhaka", allLocations:true,
    start:"2026-10-16", deadline:"2026-11-20", posted:"2026-10-16",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://ict.gov.bd",
    docs:["Online application","Experience certificates","Certificates & transcripts","NID","Photographs"],
    summary:"National data center operations, PostgreSQL/Oracle administration and cloud migration.",
    fresh:true
  },
  {
    id:"n03", title:"Junior Assistant (ICT)",
    org:"Ministry of Education — ICT Cell", type:"Ministry", edu:"General", grade:"Grade 16",
    vacancies:30, requiredDegrees:["CSE","ICT","IT","BBA","General"],
    degreeText:"Bachelor's degree in any discipline; computer proficiency required",
    minCGPA:2.00, cgpaScale:4, ageMin:18, ageMax:30, gender:"any", expYears:0,
    skills:["Computer Basics"],
    salary:"Grade 16 — ৳9,300–22,490", location:"Dhaka", allLocations:true,
    start:"2026-10-18", deadline:"2026-11-25", posted:"2026-10-18",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://moedu.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"General administrative support in the education ministry's ICT cell.",
    fresh:true
  },
  {
    id:"n04", title:"Assistant Programmer",
    org:"University of Dhaka — ICT Centre", type:"Government University", edu:"ICT Jobs", grade:"Grade 10",
    vacancies:7, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's degree in CSE / ICT / Software Engineering or equivalent",
    minCGPA:2.75, cgpaScale:4, ageMin:18, ageMax:30, gender:"any", expYears:0,
    skills:["Programming","Web Development"],
    salary:"Grade 10 — ৳16,000–38,640", location:"Dhaka", allLocations:true,
    start:"2026-10-19", deadline:"2026-11-22", posted:"2026-10-19",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://www.du.ac.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"University admission, transcript and e-services platform development.",
    fresh:true
  },
  {
    id:"n05", title:"MIS Officer",
    org:"Ministry of Health & Family Welfare — DGHS", type:"Ministry", edu:"General", grade:"Grade 11",
    vacancies:19, requiredDegrees:["CSE","ICT","Statistics","Mathematics","General"],
    degreeText:"Bachelor's degree in CSE / ICT / Statistics / Mathematics or equivalent",
    minCGPA:2.50, cgpaScale:4, ageMin:18, ageMax:32, gender:"any", expYears:0,
    skills:["Database","Data Analysis"],
    salary:"Grade 11 — ৳13,500–32,600", location:"All Bangladesh", allLocations:true,
    start:"2026-10-20", deadline:"2026-11-24", posted:"2026-10-20",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://dghs.gov.bd",
    docs:["Online application","Certificates & transcripts","NID","Photographs"],
    summary:"Hospital management information system and health statistics reporting.",
    fresh:true
  },
  {
    id:"n06", title:"Cyber Security Analyst",
    org:"ICT Division — Bangladesh CERT / e-Gov Computer Incident Response", type:"Ministry", edu:"ICT Jobs", grade:"Grade 8",
    vacancies:3, requiredDegrees:["CSE","ICT","SWE","IT"],
    degreeText:"Bachelor's in CSE / ICT with 2 years experience in security operations or ethical hacking",
    minCGPA:3.00, cgpaScale:4, ageMin:20, ageMax:35, gender:"any", expYears:2,
    skills:["Networking","Security"],
    salary:"Grade 8 — ৳35,500–69,870", location:"Dhaka", allLocations:true,
    start:"2026-10-21", deadline:"2026-11-26", posted:"2026-10-21",
    applyUrl:"https://www.teletalk.com.bd", pdfUrl:"https://ict.gov.bd",
    docs:["Online application","Experience certificates","Certificates & transcripts","NID","Photographs"],
    summary:"National cyber incident monitoring, threat analysis and response coordination.",
    fresh:true
  }
];

const SOURCES_COUNT = 28;
