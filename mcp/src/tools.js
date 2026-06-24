// ══════════════════════════════════════════════════════════════
//  tools.js — register the Abitur tools on an McpServer instance.
//  Shared by both transports (stdio + Streamable HTTP).
// ══════════════════════════════════════════════════════════════

import { z } from 'zod';
import { listSubjects, calculateAbitur, validateCombo } from './calc-service.js';

const punkte = z.number().int().min(0).max(15);

// Shared input shape for calculate_abitur / validate_combo.
const baseConfig = {
  leistungsfaecher: z.array(z.string()).length(3)
    .describe('Genau 3 Leistungsfach-IDs (siehe list_subjects), z.B. ["deutsch","mathematik","englisch"].'),
  muendliche_pruefungsfaecher: z.array(z.string()).length(2)
    .describe('Genau 2 IDs der mündlichen Prüfungsfächer.'),
  erste_fremdsprache: z.string().optional()
    .describe('Basisfach 1. Fremdsprache (falls nicht schon LF).'),
  naturwissenschaft: z.string().optional()
    .describe('Basisfach Naturwissenschaft (falls nicht schon LF).'),
  kunst_oder_musik: z.string().optional().describe('"kunst" oder "musik".'),
  geographie_halbjahre: z.number().int().min(0).max(4).optional(),
  gemeinschaftskunde_halbjahre: z.number().int().min(0).max(4).optional(),
  zusatzkurse: z.array(z.object({
    fach: z.string(),
    halbjahre: z.number().int().min(1).max(4).default(2),
  })).optional().describe('Zusätzliche Wahlkurse, um auf 40/42 Kurse zu kommen.'),
};

const calcInput = {
  ...baseConfig,
  kurse: z.array(z.object({
    fach: z.string().describe('Fach-ID'),
    halbjahr: z.number().int().min(1).max(4).describe('Halbjahr 1–4'),
    punkte: punkte,
  })).default([]).describe('Block-I-Kursnoten: ein Eintrag pro Fach und Halbjahr.'),
  abitur: z.object({
    leistungsfaecher: z.array(z.object({
      schriftlich: punkte.nullable().optional(),
      muendlich: punkte.nullable().optional(),
    })).max(3).describe('Abiturergebnisse der 3 LF, gleiche Reihenfolge wie leistungsfaecher.'),
    muendliche: z.array(punkte.nullable()).max(2).describe('Punkte der 2 mündlichen Prüfungsfächer.'),
  }).optional().describe('Abiturprüfungsergebnisse (Block II).'),
};

const asText = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

export function registerTools(server) {
  server.registerTool(
    'list_subjects',
    {
      title: 'Fächer auflisten',
      description: 'Liste aller wählbaren Fächer (BW) mit ID, Name, Aufgabenfeld und LF-Fähigkeit. ' +
        'Zuerst aufrufen, um gescannte Fachnamen auf IDs zu mappen.',
      inputSchema: {},
    },
    async () => asText({ faecher: listSubjects() }),
  );

  server.registerTool(
    'calculate_abitur',
    {
      title: 'Abitur berechnen (BW)',
      description: 'Berechnet Block I, Block II, Gesamtpunktzahl, Durchschnittsnote und Bestehen ' +
        'nach dem baden-württembergischen Leitfaden. Gibt Fehler (harte Verstöße) und Hinweise zurück.',
      inputSchema: calcInput,
    },
    async (args) => asText(calculateAbitur(args)),
  );

  server.registerTool(
    'validate_combo',
    {
      title: 'Fächerkombination prüfen',
      description: 'Prüft eine Fächerwahl (LF + mündliche PF + Basisfächer) gegen die BW-Belegungs- ' +
        'und Kombinationsregeln, ohne Noten. Nützlich vor der Festlegung.',
      inputSchema: baseConfig,
    },
    async (args) => asText(validateCombo(args)),
  );
}
