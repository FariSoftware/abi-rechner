// ══════════════════════════════════════════════════════════════
//  abi-core.js — pure Abitur calculation logic (Baden-Württemberg)
//
//  Framework-free ES module. NO DOM, NO global state. Every function
//  is pure: it takes a `state` object explicitly where needed and
//  returns a result. Shared by index.html (browser) and the MCP
//  server (Node). This is the single source of truth for the rules.
//
//  Rules per BW Leitfaden zur Kursstufe (APO-GOSt-equivalent).
// ══════════════════════════════════════════════════════════════

// ── DATA ──────────────────────────────────────────────────────

export const AF = { I: 1, II: 2, III: 3, NONE: 0 };

const SUBJECTS_RAW = [
  // AF I
  { id: 'deutsch',          name: 'Deutsch',           af: AF.I,   lfOk: true,  isFS: false, isNW: false },
  { id: 'englisch',         name: 'Englisch',           af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'franzoesisch',     name: 'Französisch',        af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'latein',           name: 'Latein',             af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'spanisch',         name: 'Spanisch',           af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'russisch',         name: 'Russisch',           af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'griechisch',       name: 'Griechisch',         af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'italienisch',      name: 'Italienisch',        af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'chinesisch',       name: 'Chinesisch',         af: AF.I,   lfOk: true,  isFS: true,  isNW: false },
  { id: 'musik',            name: 'Musik',              af: AF.I,   lfOk: true,  isFS: false, isNW: false },
  { id: 'kunst',            name: 'Bildende Kunst',     af: AF.I,   lfOk: true,  isFS: false, isNW: false },
  // AF II
  { id: 'geschichte',       name: 'Geschichte',         af: AF.II,  lfOk: true,  isFS: false, isNW: false },
  { id: 'geographie',       name: 'Geographie',         af: AF.II,  lfOk: true,  isFS: false, isNW: false },
  { id: 'gemeinschaftskunde', name: 'Gemeinschaftskunde', af: AF.II, lfOk: true, isFS: false, isNW: false },
  { id: 'wirtschaft',       name: 'Wirtschaft',         af: AF.II,  lfOk: true,  isFS: false, isNW: false },
  { id: 'religion',         name: 'Rel./Ethik',         af: AF.II,  lfOk: true,  isFS: false, isNW: false },
  // AF III
  { id: 'mathematik',       name: 'Mathematik',         af: AF.III, lfOk: true,  isFS: false, isNW: false },
  { id: 'biologie',         name: 'Biologie',           af: AF.III, lfOk: true,  isFS: false, isNW: true  },
  { id: 'chemie',           name: 'Chemie',             af: AF.III, lfOk: true,  isFS: false, isNW: true  },
  { id: 'physik',           name: 'Physik',             af: AF.III, lfOk: true,  isFS: false, isNW: true  },
  { id: 'nwt',              name: 'NwT',                af: AF.III, lfOk: false, isFS: false, isNW: false },
  { id: 'informatik',       name: 'Informatik',         af: AF.III, lfOk: false, isFS: false, isNW: false },
  // NONE
  { id: 'sport',            name: 'Sport',              af: AF.NONE, lfOk: true,  isFS: false, isNW: false, isSeminar: false },
  // Seminare — 2 HJ, zählen als 2 Kurse in Block I (Leitfaden §1.2)
  { id: 'seminar_1',        name: 'Seminar 1',          af: AF.NONE, lfOk: false, isFS: false, isNW: false, isSeminar: true  },
  { id: 'seminar_2',        name: 'Seminar 2',          af: AF.NONE, lfOk: false, isFS: false, isNW: false, isSeminar: true  },
  { id: 'seminar_3',        name: 'Seminar 3',          af: AF.NONE, lfOk: false, isFS: false, isNW: false, isSeminar: true  },
];

export const SUBJECTS = [...SUBJECTS_RAW].sort((a, b) => a.name.localeCompare(b.name, 'de'));
export const subjectMap = Object.fromEntries(SUBJECTS.map(s => [s.id, s]));

export const GRADE_TABLE = [
  [900,823,'1.0'],[822,805,'1.1'],[804,787,'1.2'],[786,769,'1.3'],[768,751,'1.4'],
  [750,733,'1.5'],[732,715,'1.6'],[714,697,'1.7'],[696,679,'1.8'],[678,661,'1.9'],
  [660,643,'2.0'],[642,625,'2.1'],[624,607,'2.2'],[606,589,'2.3'],[588,571,'2.4'],
  [570,553,'2.5'],[552,535,'2.6'],[534,517,'2.7'],[516,499,'2.8'],[498,481,'2.9'],
  [480,463,'3.0'],[462,445,'3.1'],[444,427,'3.2'],[426,409,'3.3'],[408,391,'3.4'],
  [390,373,'3.5'],[372,355,'3.6'],[354,337,'3.7'],[336,319,'3.8'],[318,301,'3.9'],
  [300,300,'4.0'],
];

export const POINTS_TO_NOTE = ['6','5−','5','5+','4−','4','4+','3−','3','3+','2−','2','2+','1−','1','1+'];

// Default planning state. The browser clones this for the live UI; the
// MCP server can clone it as a baseline and overlay caller-supplied data.
export const DEFAULT_STATE = {
  lf: ['deutsch', 'mathematik', 'englisch'],
  mpf: ['geschichte', 'biologie'],
  // Basisfach choices
  fs1: 'englisch',       // 1. Fremdsprache (if not LF)
  nw1: 'biologie',       // Naturwissenschaft (if not LF)
  kunstMusik: 'kunst',   // Kunst oder Musik
  geoHj: 2,             // Geographie: 2 or 4
  gkHj: 2,              // Gemeinschaftskunde: 2 or 4
  geoStartHj: 1,        // Geographie: 1 = J1 (HJ1+2), 3 = J2 (HJ3+4)
  gkStartHj: 1,         // Gemeinschaftskunde: 1 = J1, 3 = J2
  // Extra courses added manually in Step 3 to reach 40
  extraCourses: [],      // [{ id: string, hj: number }]
  // Grades: { key: number } where key = subjectId_hj (1–4)
  grades: {},
  // Block II
  b2: [
    { schriftlich: null, hasMuendlich: false, muendlich: null },
    { schriftlich: null, hasMuendlich: false, muendlich: null },
    { schriftlich: null, hasMuendlich: false, muendlich: null },
  ],
  b2mpf: [null, null],
};

// ── PURE HELPERS ──────────────────────────────────────────────

export function subjectName(id) { return subjectMap[id] ? subjectMap[id].name : id; }
export function subjectAF(id) { return subjectMap[id] ? subjectMap[id].af : AF.NONE; }
export function isLFEligible(id) { return subjectMap[id]?.lfOk ?? false; }
export function wochenstundenForSub(sub) {
  if (sub.isLF) return 5;
  const s = subjectMap[sub.id];
  if (s?.isSeminar) return 3;
  if (sub.id === 'deutsch' || s?.isFS || sub.id === 'mathematik' || s?.isNW) return 3;
  return 2;
}
export function isCoreEligible(id) {
  const s = subjectMap[id];
  if (!s) return false;
  return id === 'deutsch' || id === 'mathematik' || s.isFS || s.isNW;
}

// ── LF VALIDATION MATRIX (Leitfaden Seite 10/11) ──────────────
//
//  Kategorien gemäß Flussdiagramm:
//    D    = Deutsch
//    M    = Mathematik
//    FS   = Fremdsprache
//    NW   = Naturwissenschaft (Bio, Chemie, Physik)
//    GW   = Gesellschaftswissenschaft (Geschichte, Geo, GK, Wirtschaft, Religion)
//    KMS  = Kunst / Musik / Sport
//    FREE = frei (Informatik, NwT, Seminare, ...)

const FLOWCHART_LF_RULES = {
//  LF1 Kategorie  →  erlaubte Kategorien für LF2
  D:    new Set(['M', 'FS', 'NW']),
  M:    new Set(['D', 'FS', 'NW']),
  FS:   new Set(['D', 'M' ,'NW']),
  NW:   new Set(['D','M','FS']),         // PDF S.11: LF1=NW → LF2 nur D/M/FS
};

export const LF_CATEGORY_NAME = {
  D: 'Deutsch', M: 'Mathematik', FS: 'Fremdsprache',
  NW: 'Naturwissenschaft', GW: 'Gesellschaftswissenschaft',
  KMS: 'Kunst/Musik/Sport', FREE: 'freies Fach',
};

export function lfCategory(id) {
  if (!id) return 'FREE';
  if (id === 'deutsch')    return 'D';
  if (id === 'mathematik') return 'M';
  const s = subjectMap[id];
  if (!s) return 'FREE';
  if (s.isFS) return 'FS';
  if (s.isNW) return 'NW';
  if (['geschichte','geographie','gemeinschaftskunde','wirtschaft','religion'].includes(id)) return 'GW';
  if (['kunst','musik','sport'].includes(id)) return 'KMS';
  return 'FREE';
}

export function validateLfFlowchart(lfs) {
  const errors = [];
  if (lfs.length < 2) return errors;

  // The matrix defines rules for LF1+LF2 (the two "Kernfächer").
  // The dropdown order doesn't matter — we check all pairs from the 3 LFs
  // and accept if at least one valid LF1+LF2 assignment exists.
  const candidates = lfs.slice(0, lfs.length >= 3 ? 3 : lfs.length);
  let validPairFound = false;

  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      const c1 = lfCategory(candidates[i]);
      const c2 = lfCategory(candidates[j]);
      if (!(c1 in FLOWCHART_LF_RULES)) continue;
      const allowed = FLOWCHART_LF_RULES[c1];
      if (allowed === null || allowed.has(c2)) {
        validPairFound = true;
        break;
      }
    }
    if (validPairFound) break;
  }

  if (!validPairFound) {
    errors.push(
      'Ungültige Leistungsfach-Kombination: ' +
      'Unter den gewählten LFs muss eine gültige Kombination für LF1 und LF2 möglich sein ' +
      '(je ein Fach aus Deutsch, Mathematik, Fremdsprache oder Naturwissenschaft).'
    );
  }

  return errors;
}

// ── CALCULATION ───────────────────────────────────────────────

// Clamped point value for a grade key ("subjectId_hj") from state.grades.
export function ptVal(state, key) {
  const v = state.grades[key];
  if (v === undefined || v === null || v === '') return null;
  return Math.max(0, Math.min(15, parseInt(v)));
}

// Returns all subjects the student plans, with metadata.
// isLF / isPflicht / mandatory determine mandatory logic.
export function getBlock1Subjects(state) {
  const lfIds = state.lf.filter(Boolean);
  const subjects = [];
  const seen = new Set();

  const add = (id, hj, props) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    subjects.push({ id, hj, isLF: false, ...props });
  };

  // 3 LFs — always mandatory, all 4 HJ
  for (const id of lfIds) {
    if (id && !seen.has(id)) {
      seen.add(id);
      subjects.push({ id, hj: 4, isLF: true, mandatory: true });
    }
  }

  // Pflicht-Basisfächer (all 4 HJ mandatory unless already LF)
  add('deutsch',    4, { mandatory: true });
  add('mathematik', 4, { mandatory: true });

  const fs1 = lfIds.find(id => subjectMap[id]?.isFS) || (!lfIds.includes(state.fs1) ? state.fs1 : null);
  if (fs1 && !lfIds.includes(fs1)) add(fs1, 4, { mandatory: true });

  const nw1 = lfIds.find(id => subjectMap[id]?.isNW) || (!lfIds.includes(state.nw1) ? state.nw1 : null);
  if (nw1 && !lfIds.includes(nw1)) add(nw1, 4, { mandatory: true });

  add('geschichte', 4, { mandatory: true });

  const geo_hj = state.mpf.includes('geographie')         ? 4 : state.geoHj;
  const gk_hj  = state.mpf.includes('gemeinschaftskunde') ? 4 : state.gkHj;
  // hjStart: which real HJ index the first course occupies (1 or 3)
  // For 4-HJ subjects hjStart is always 1; for 2-HJ subjects it may be 1 or 3.
  const geoStart = (geo_hj === 4) ? 1 : state.geoStartHj;
  const gkStart  = (gk_hj  === 4) ? 1 : state.gkStartHj;
  add('geographie',         geo_hj, { mandatory: true, hjStart: geoStart });
  add('gemeinschaftskunde', gk_hj,  { mandatory: true, hjStart: gkStart  });

  // Kunst/Musik: 4 HJ Belegungspflicht, aber nur 2 HJ Anrechnungspflicht in Block I
  add(state.kunstMusik || 'kunst', 4, { mandatory: true, mandatoryHj: 2 });

  // mündliche PFs — mandatory (4 HJ)
  for (const id of state.mpf) {
    add(id, 4, { mandatory: true });
  }

  // Religion & Sport — Pflichtbelegung, aber optionale Einzel-HJ für Block I
  if (!lfIds.includes('religion')) add('religion', 4, { mandatory: false, isPflicht: true });
  if (!lfIds.includes('sport'))    add('sport',    4, { mandatory: false, isPflicht: true });

  // Wahlfächer (vom User hinzugefügt)
  for (const extra of state.extraCourses) {
    add(extra.id, extra.hj, { mandatory: false });
  }

  return subjects;
}

// Returns Set of "id_hjIndex" keys selected for Block I.
// Mandatory subjects contribute ALL their HJ.
// Free slots filled with best individual HJ from optional subjects.
export function selectBlock1Slots(state, allSubjects) {
  const mandatorySlots = [];
  const optionalSlots = [];

  for (const sub of allSubjects) {
    const requiredCount = sub.mandatory ? (sub.mandatoryHj ?? sub.hj) : 0;
    const start = sub.hjStart ?? 1; // real HJ index of first course (1 or 3)
    for (let j = 0; j < sub.hj; j++) {
      const hjIndex = start + j; // real HJ position (1–4)
      const slot = { id: sub.id, hjIndex, pts: ptVal(state, `${sub.id}_${hjIndex}`) ?? 0 };
      if (j < requiredCount) {
        mandatorySlots.push(slot);
      } else {
        optionalSlots.push(slot);
      }
    }
  }

  const mandatoryCount = mandatorySlots.length;
  const slotsLeft = 40 - mandatoryCount;

  optionalSlots.sort((a, b) => b.pts - a.pts);
  const filledSlots = optionalSlots.slice(0, Math.max(0, slotsLeft));

  const allSelected = [...mandatorySlots, ...filledSlots];

  return new Set(allSelected.map(s => `${s.id}_${s.hjIndex}`));
}

// For rendering: which subjects have at least one HJ in Block I?
export function subjectsInBlock1(allSubjects, selectedSlots) {
  return new Set(allSubjects.filter(sub => {
    const start = sub.hjStart ?? 1;
    return Array.from({length: sub.hj}, (_, j) => `${sub.id}_${start + j}`).some(k => selectedSlots.has(k));
  }).map(s => s.id));
}

// Auto-compute which 2 of 3 LFs yield the highest Block I score.
export function computeBestDoubled(state, allSubs, selectedSlots) {
  const lfs = state.lf.filter(Boolean);
  if (lfs.length < 2) return lfs.slice(0, 2);

  const combos = [];
  for (let i = 0; i < lfs.length - 1; i++)
    for (let j = i + 1; j < lfs.length; j++)
      combos.push([lfs[i], lfs[j]]);

  let bestCombo = combos[0];
  let bestScore = -Infinity;

  for (const combo of combos) {
    let sumAll = 0, sumDoubled = 0, count = 0;
    for (const key of selectedSlots) {
      const [id] = key.split('_');
      const pts = ptVal(state, key) ?? 0;
      sumAll += pts;
      count++;
      if (combo.includes(id)) sumDoubled += pts;
    }
    const denom = 40 + combo.length * 4;
    const score = denom > 0 ? (sumAll + sumDoubled) / denom : 0;
    if (score > bestScore) { bestScore = score; bestCombo = combo; }
  }

  return bestCombo;
}

export function calcBlockI(state) {
  const allSubs = getBlock1Subjects(state);
  const totalPlanned = allSubs.reduce((sum, s) => sum + s.hj, 0);

  // Select individual HJ slots: mandatory all, optional best-scoring until 40
  const selectedSlots = selectBlock1Slots(state, allSubs);       // Set of "id_hjIndex" keys
  const inBlock1 = subjectsInBlock1(allSubs, selectedSlots);     // Set of subject IDs (for rendering)

  // Auto-select the 2 LFs that yield the best Block I score
  const doubled = computeBestDoubled(state, allSubs, selectedSlots);

  let sumAll = 0, sumDoubled = 0;
  let unterpunktet = 0, unterpunktetLF = 0, hasZero = false;
  const issues = [];

  for (const key of selectedSlots) {
    const [id] = key.split('_');
    const sub = allSubs.find(s => s.id === id);
    const pts = ptVal(state, key) ?? 0;
    sumAll += pts;
    if (doubled.includes(id)) sumDoubled += pts;
    if (pts < 5) { unterpunktet++; if (sub?.isLF) unterpunktetLF++; }
    if (pts === 0) hasZero = true;
  }

  const denominator = 40 + doubled.length * 4;
  const block1 = denominator > 0 ? Math.round((sumAll + sumDoubled) * 40 / denominator) : 0;
  const totalCourses = selectedSlots.size;

  if (totalPlanned < 40) issues.push({ msg: `Füge noch ${40 - totalPlanned} Kurs${40 - totalPlanned !== 1 ? 'e' : ''} in Block I hinzu (aktuell ${totalPlanned} von 40).`, level: 'info' });
  if (unterpunktet > 8) issues.push({ msg: `${unterpunktet} Kurse liegen unter 5 Punkten – maximal 8 sind erlaubt. Verbessere ${unterpunktet - 8} Kurs${unterpunktet - 8 !== 1 ? 'e' : ''}.`, level: 'error' });
  if (unterpunktetLF > 3) issues.push({ msg: `${unterpunktetLF} LF-Kurse liegen unter 5 Punkten – maximal 3 sind erlaubt.`, level: 'error' });
  if (hasZero) issues.push({ msg: 'Mindestens ein Kurs hat 0 Punkte – kein eingebrachter Kurs darf 0 Punkte haben.', level: 'error' });
  if (block1 < 200) issues.push({ msg: `Block I: ${block1} von mindestens 200 Punkten erreicht.`, level: sumAll > 0 ? 'error' : 'info' });

  return { block1, totalPlanned, totalCourses, selectedSlots, inBlock1, doubled, issues };
}

export function calcBlockII(state) {
  const lfs = state.lf.filter(Boolean);
  const issues = [];
  const detail = [];
  let total = 0;
  let subScores = [];

  // LF schriftlich (+ optional mündlich)
  for (let i = 0; i < 3; i++) {
    const b = state.b2[i];
    const s = b.schriftlich !== null ? Math.max(0, Math.min(15, parseInt(b.schriftlich) || 0)) : null;
    const m = (b.hasMuendlich && b.muendlich !== null) ? Math.max(0, Math.min(15, parseInt(b.muendlich) || 0)) : null;

    let pts4;
    if (s === null && m === null) {
      pts4 = 0;
      detail.push({ name: subjectName(lfs[i]), pts: 0, raw: '(leer)', ok: false });
    } else if (m !== null && s !== null) {
      const pf = (2 * s + m) / 3;
      pts4 = Math.round(pf * 4);
      detail.push({ name: subjectName(lfs[i]), pts: pts4, raw: `(2×${s} + ${m}) / 3 × 4 = ${pts4}`, ok: pts4 >= 4 });
    } else {
      const base = s !== null ? s : m;
      pts4 = base * 4;
      detail.push({ name: subjectName(lfs[i]), pts: pts4, raw: `${base} × 4 = ${pts4}`, ok: pts4 >= 4 });
    }

    total += pts4;
    subScores.push(pts4);
  }

  // mündliche PFs
  for (let i = 0; i < 2; i++) {
    const v = state.b2mpf[i];
    const pts = v !== null ? Math.max(0, Math.min(15, parseInt(v) || 0)) : null;
    const pts4 = pts !== null ? pts * 4 : 0;
    total += pts4;
    subScores.push(pts4);
    detail.push({
      name: subjectName(state.mpf[i] || '?'),
      pts: pts4,
      raw: pts !== null ? `${pts} × 4 = ${pts4}` : '(leer)',
      ok: pts !== null && pts4 >= 4,
    });
  }

  // Validations
  const anyB2Entered = subScores.some(s => s > 0);
  if (total < 100) issues.push({ msg: `Block II: ${total} von mindestens 100 Punkten erreicht.`, level: anyB2Entered ? 'error' : 'info' });

  const above20 = subScores.filter(s => s >= 20).length;
  if (above20 < 3) issues.push({ msg: `Block II: ${above20} von mind. 3 Fächern erreichen ≥ 20 Punkte.`, level: anyB2Entered ? 'error' : 'info' });

  // 2 of the ≥20 must be LF
  const lfAbove20 = subScores.slice(0, 3).filter(s => s >= 20).length;
  if (above20 >= 3 && lfAbove20 < 2) issues.push({ msg: 'Block II: Mindestens 2 der 3 LFs müssen ≥ 20 Punkte erreichen.', level: 'error' });

  const below4 = subScores.filter(s => s < 4).length;
  if (below4 > 0) issues.push({ msg: `Block II: ${below4} Prüfungsfach${below4 !== 1 ? 'fächer erreichen' : ' erreicht'} nicht die Mindestpunktzahl (≥ 4 vierfach).`, level: 'error' });

  return { block2: total, detail, issues };
}

export function getGrade(total) {
  for (const [hi, lo, note] of GRADE_TABLE) {
    if (total >= lo && total <= hi) return note;
  }
  return total > 900 ? '1.0' : null;
}

export function validateConfig(state) {
  const errors = [];
  const lfs = state.lf.filter(Boolean);

  if (lfs.length < 3) {
    errors.push({ el: 'lf', msg: 'Bitte 3 Leistungsfächer wählen.' });
  } else if (new Set(lfs).size < 3) {
    errors.push({ el: 'lf', msg: 'Alle 3 Leistungsfächer müssen verschieden sein.' });
  }

  // 2 of 3 must be core-eligible
  const coreCount = lfs.filter(isCoreEligible).length;
  if (lfs.length === 3 && coreCount < 2) {
    errors.push({ el: 'lf', msg: 'Mind. 2 LFs müssen aus Deutsch, Mathematik, Fremdsprache oder Naturwissenschaft stammen.' });
  }

  // PDF flowchart matrix (Seite 10/11) — rules encoded in FLOWCHART_LF_RULES above
  for (const msg of validateLfFlowchart(lfs)) {
    errors.push({ el: 'lf', msg });
  }

  // All 3 AF covered in Abi
  const abiSubjects = [...lfs, ...state.mpf.filter(Boolean)];
  const afs = new Set(abiSubjects.map(subjectAF).filter(a => a > 0));
  if (afs.size < 3 && lfs.length === 3) {
    errors.push({ el: 'mpf', msg: 'Die Abiturprüfung muss alle 3 Aufgabenfelder abdecken.' });
  }

  // Deutsch + Mathe must be in Abi
  if (lfs.length === 3 && !abiSubjects.includes('deutsch')) {
    errors.push({ el: 'mpf', msg: 'Deutsch muss Prüfungsfach sein (schriftlich als LF oder mündlich).' });
  }
  if (lfs.length === 3 && !abiSubjects.includes('mathematik')) {
    errors.push({ el: 'mpf', msg: 'Mathematik muss Prüfungsfach sein (schriftlich als LF oder mündlich).' });
  }

  // Geo/GK als mPF nur möglich wenn 4 HJ belegt werden (Leitfaden S. 9)
  if (state.mpf.includes('geographie') && state.geoHj < 4) {
    errors.push({ el: 'mpf', msg: `Geographie kann nur als mündl. PF gewählt werden, wenn 4 Halbjahre belegt werden (aktuell: ${state.geoHj} HJ).` });
  }
  if (state.mpf.includes('gemeinschaftskunde') && state.gkHj < 4) {
    errors.push({ el: 'mpf', msg: `Gemeinschaftskunde kann nur als mündl. PF gewählt werden, wenn 4 Halbjahre belegt werden (aktuell: ${state.gkHj} HJ).` });
  }

  // Block I: entweder 2 FS mit je 4 Kursen ODER 2 NW (inkl. Informatik/NwT) mit je 4 Kursen
  if (lfs.length === 3) {
    const subs = getBlock1Subjects(state);
    const subIds = subs.filter(s => s.hj >= 4).map(s => s.id);
    const fsCount = subIds.filter(id => subjectMap[id]?.isFS).length;
    const realNwIds = ['biologie','chemie','physik'];
    const extNwIds  = ['informatik','nwt'];
    const realNwCount = subIds.filter(id => realNwIds.includes(id)).length;
    const extNwCount  = subIds.filter(id => extNwIds.includes(id)).length;
    // 2 echte NW, oder 1 echte NW + Informatik/NwT
    const nwOk = realNwCount >= 2 || (realNwCount >= 1 && extNwCount >= 1);
    if (fsCount < 2 && !nwOk) {
      errors.push({ el: 'overview', msg: 'Block I muss entweder mind. 2 Fremdsprachen oder mind. 1 Naturwissenschaft + 1 weitere NW/Informatik/NwT (je 4 Kurse) enthalten.' });
    }

    // Belegungspflicht: mind. 42 Kurse (12 LF + mind. 30 weitere, Leitfaden §1.2.4)
    const totalBelegt = subs.reduce((s, sub) => s + sub.hj, 0);
    if (totalBelegt < 42) {
      errors.push({ el: 'overview', msg: `Belegungspflicht: ${totalBelegt} von mindestens 42 Kursen belegt. Füge noch ${42 - totalBelegt} Kurs${42 - totalBelegt !== 1 ? 'e' : ''} hinzu.` });
    }
  }

  return errors;
}
