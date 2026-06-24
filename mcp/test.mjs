// Smoke test: real MCP client → stdio server → tools round-trip.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: 'node', args: ['src/server.js'] });
const client = new Client({ name: 'abi-rechner-test', version: '0.0.0' });
await client.connect(transport);

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok  -', msg); };

const tools = await client.listTools();
const names = tools.tools.map(t => t.name).sort();
assert(JSON.stringify(names) === JSON.stringify(['calculate_abitur', 'list_subjects', 'validate_combo']), `tools: ${names}`);

const subs = JSON.parse((await client.callTool({ name: 'list_subjects', arguments: {} })).content[0].text);
assert(subs.faecher.length === 26, `list_subjects → ${subs.faecher.length} Fächer`);

// Build full Block I from the helper so we exercise the real planning set.
const { DEFAULT_STATE, getBlock1Subjects } = await import('../abi-core.js');
const st = structuredClone(DEFAULT_STATE);
const kurse = [];
for (const sub of getBlock1Subjects(st)) {
  const start = sub.hjStart ?? 1;
  for (let j = 0; j < sub.hj; j++) kurse.push({ fach: sub.id, halbjahr: start + j, punkte: 12 });
}
const calc = JSON.parse((await client.callTool({
  name: 'calculate_abitur',
  arguments: {
    leistungsfaecher: ['deutsch', 'mathematik', 'englisch'],
    muendliche_pruefungsfaecher: ['geschichte', 'biologie'],
    kurse,
    abitur: { leistungsfaecher: [{ schriftlich: 13 }, { schriftlich: 13 }, { schriftlich: 13 }], muendliche: [13, 13] },
  },
})).content[0].text);
assert(calc.gesamtpunktzahl === 700, `calculate_abitur total = ${calc.gesamtpunktzahl} (700)`);
assert(calc.durchschnittsnote === '1.7', `Durchschnitt = ${calc.durchschnittsnote} (1.7)`);
assert(calc.block2.punkte === 260, `block2 = ${calc.block2.punkte} (260)`);

const bad = JSON.parse((await client.callTool({
  name: 'validate_combo',
  arguments: { leistungsfaecher: ['deutsch', 'geographie', 'kunst'], muendliche_pruefungsfaecher: ['mathematik', 'biologie'] },
})).content[0].text);
assert(bad.gueltig === false && bad.fehler.length > 0, `validate_combo flags bad LF combo (${bad.fehler.length} Fehler)`);

const warn = JSON.parse((await client.callTool({
  name: 'validate_combo',
  arguments: { leistungsfaecher: ['deutsch', 'mathematik', 'quatsch'], muendliche_pruefungsfaecher: ['geschichte', 'biologie'] },
})).content[0].text);
assert(warn.warnungen.some(w => w.includes('quatsch')), 'unknown subject → warning, not crash');

await client.close();
console.log(process.exitCode ? '\nSOME TESTS FAILED' : '\nALL TESTS PASSED');
