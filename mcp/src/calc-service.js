// ══════════════════════════════════════════════════════════════
//  calc-service.js — transport-agnostic glue between an LLM-friendly
//  input shape and the pure rules in abi-core.js.
//
//  The MCP server (stdio + HTTP) and the test harness both import
//  this. No MCP SDK, no DOM here — just input → state → result.
// ══════════════════════════════════════════════════════════════

import {
  SUBJECTS, subjectMap, DEFAULT_STATE,
  subjectName, getGrade, calcBlockI, calcBlockII, validateConfig,
} from '../../abi-core.js';

// List of subjects for the LLM to map scanned names → ids.
export function listSubjects() {
  return SUBJECTS.map(s => ({
    id: s.id,
    name: s.name,
    aufgabenfeld: s.af || null,
    leistungsfachFaehig: s.lfOk,
  }));
}

// Build an abi-core `state` object from the friendly input shape.
// Unknown subject ids are collected and reported, not thrown.
function buildState(input) {
  const warnings = [];
  const knowSub = (id, where) => {
    if (id && !subjectMap[id]) warnings.push(`Unbekanntes Fach "${id}" in ${where} (siehe list_subjects).`);
    return id;
  };

  const state = structuredClone(DEFAULT_STATE);

  const lf = Array.isArray(input.leistungsfaecher) ? input.leistungsfaecher.slice(0, 3) : [];
  const mpf = Array.isArray(input.muendliche_pruefungsfaecher) ? input.muendliche_pruefungsfaecher.slice(0, 2) : [];
  lf.forEach(id => knowSub(id, 'leistungsfaecher'));
  mpf.forEach(id => knowSub(id, 'muendliche_pruefungsfaecher'));
  state.lf = lf;
  state.mpf = mpf;

  // Optional Basisfach config overrides (sensible defaults otherwise).
  if (input.erste_fremdsprache)        state.fs1 = knowSub(input.erste_fremdsprache, 'erste_fremdsprache');
  if (input.naturwissenschaft)         state.nw1 = knowSub(input.naturwissenschaft, 'naturwissenschaft');
  if (input.kunst_oder_musik)          state.kunstMusik = knowSub(input.kunst_oder_musik, 'kunst_oder_musik');
  if (typeof input.geographie_halbjahre === 'number')        state.geoHj = input.geographie_halbjahre;
  if (typeof input.gemeinschaftskunde_halbjahre === 'number') state.gkHj  = input.gemeinschaftskunde_halbjahre;

  // Extra Wahlkurse added to reach 40/42.
  if (Array.isArray(input.zusatzkurse)) {
    state.extraCourses = input.zusatzkurse
      .filter(c => c && c.fach)
      .map(c => ({ id: knowSub(c.fach, 'zusatzkurse'), hj: Number(c.halbjahre) || 2 }));
  }

  // Block I course grades: [{ fach, halbjahr (1-4), punkte (0-15) }]
  if (Array.isArray(input.kurse)) {
    for (const k of input.kurse) {
      if (!k || !k.fach) continue;
      knowSub(k.fach, 'kurse');
      const hj = Number(k.halbjahr);
      if (!(hj >= 1 && hj <= 4)) { warnings.push(`Kurs "${k.fach}": halbjahr muss 1–4 sein.`); continue; }
      state.grades[`${k.fach}_${hj}`] = Math.max(0, Math.min(15, Number(k.punkte) || 0));
    }
  }

  // Block II — Abiturprüfungen.
  // input.abitur.leistungsfaecher: array (same order as state.lf) of { schriftlich, muendlich? }
  // input.abitur.muendliche: array of 2 numbers for the mündliche PF.
  const abi = input.abitur || {};
  if (Array.isArray(abi.leistungsfaecher)) {
    abi.leistungsfaecher.slice(0, 3).forEach((p, i) => {
      if (!p) return;
      state.b2[i] = {
        schriftlich: p.schriftlich == null ? null : Math.max(0, Math.min(15, Number(p.schriftlich))),
        hasMuendlich: p.muendlich != null,
        muendlich: p.muendlich == null ? null : Math.max(0, Math.min(15, Number(p.muendlich))),
      };
    });
  }
  if (Array.isArray(abi.muendliche)) {
    state.b2mpf = [0, 1].map(i => abi.muendliche[i] == null ? null : Math.max(0, Math.min(15, Number(abi.muendliche[i]))));
  }

  return { state, warnings };
}

// Full Abitur calculation from friendly input.
export function calculateAbitur(input) {
  const { state, warnings } = buildState(input);

  const b1 = calcBlockI(state);
  const b2 = calcBlockII(state);
  const configErrors = validateConfig(state).map(e => e.msg);

  const total = b1.block1 + b2.block2;
  const grade = total >= 300 ? getGrade(total) : null;

  // Bestehensbedingungen (BW Leitfaden): Block I ≥ 200, Block II ≥ 100,
  // Gesamt ≥ 300, und keine harten Fehler in den Blöcken / der Konfiguration.
  const blockIssues = [...b1.issues, ...b2.issues];
  const hardErrors = blockIssues.filter(i => i.level === 'error').map(i => i.msg);
  const bestanden =
    b1.block1 >= 200 && b2.block2 >= 100 && total >= 300 &&
    hardErrors.length === 0 && configErrors.length === 0;

  return {
    bestanden,
    gesamtpunktzahl: total,
    durchschnittsnote: grade,
    block1: { punkte: b1.block1, eingebrachteKurse: b1.totalCourses, doppeltGewerteteLF: b1.doubled },
    block2: { punkte: b2.block2, faecher: b2.detail },
    fehler: [...configErrors, ...hardErrors],
    hinweise: blockIssues.filter(i => i.level !== 'error').map(i => i.msg),
    warnungen: warnings,
  };
}

// Validate a subject combination (LF + mPF + Basisfach config) without grades.
export function validateCombo(input) {
  const { state, warnings } = buildState(input);
  const errors = validateConfig(state).map(e => e.msg);
  return { gueltig: errors.length === 0, fehler: errors, warnungen: warnings };
}
