// Takes the teacher-web screenshots of the manual against a LOCAL stack with invented sample data.
// Setup (see README "Local development"): docker compose up -d; npm run dev -w @jide/backend; npm run dev -w @jide/teacher;
// npm run teacher:add -w @jide/backend -- lehrkraft@schule.example "Maria Beispiel"
// Usage: node manual/scripts/screenshots.mjs <backend.log> <dir with summe.zip and maximum.zip>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [logFile, zipDir] = process.argv.slice(2);
const BASE = 'http://localhost:5174';
const EMAIL = process.env.EMAIL ?? 'lehrkraft@schule.example';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--lang=de-AT'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 780 },
  deviceScaleFactor: 1,
  locale: 'de-AT',
  timezoneId: 'Europe/Vienna',
  colorScheme: 'light'
});
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });

// sign-in
await page.goto(`${BASE}/login`);
await page.getByLabel('E-Mail-Adresse').waitFor();
await page.getByLabel('E-Mail-Adresse').fill(EMAIL);
await shot('anmelden');
await page.getByRole('button', { name: 'Anmelde-Link senden' }).click();
await page.waitForURL(/login\/sent/);
await page.waitForTimeout(800);
await shot('link-gesendet');
const links = [...readFileSync(logFile, 'utf8').matchAll(/http:\/\/localhost:5174\/auth\/verify\?token=\w+/g)];
await page.goto(links.at(-1)[0]);
await page.waitForURL(`${BASE}/kurse`);

// course
await page.getByLabel('Fach').fill('POS');
await page.getByLabel('Klasse').fill('1AHIF');
await shot('kurse-anlegen');
await page.getByRole('button', { name: 'Kurs anlegen' }).click();
await page.getByRole('link', { name: 'POS · 1AHIF' }).waitFor();
await page.getByLabel('Fach').fill('INF');
await page.getByLabel('Klasse').fill('2BHIF');
await page.getByRole('button', { name: 'Kurs anlegen' }).click();
await page.getByRole('link', { name: 'INF · 2BHIF' }).waitFor();
await page.getByRole('row', { name: /INF · 2BHIF/ }).getByRole('button', { name: 'Archivieren' }).click();
await page.getByRole('button', { name: /Archivierte anzeigen/ }).click();
await page.getByText('archiviert', { exact: true }).waitFor();
await shot('kurse-verwalten');
await page.getByRole('link', { name: 'POS · 1AHIF' }).click();
await page.waitForURL(/abgaben/);

// students
await page.getByRole('link', { name: /Schüler:innen/ }).first().click();
const names = ['Anna Beispiel', 'Ben Muster', 'Clara Probe', 'David Test', 'Emma Sample', 'Felix Beispiel'];
await page.getByLabel('Namen, einer pro Zeile').fill(names.join('\n'));
await shot('schueler-hinzufuegen');
await page.getByRole('button', { name: '6 Codes erzeugen' }).click();
await page.getByRole('cell', { name: 'Anna Beispiel' }).waitFor();

const token = await page.evaluate(() => JSON.parse(localStorage.getItem('jide.teacher.session')).token);
const api = async (p, init = {}, bearer = token) => {
  const r = await fetch(`${BASE}/api${p}`, { ...init, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...init.headers } });
  return r.status === 204 ? {} : { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const courseId = Number(page.url().match(/kurse\/(\d+)/)[1]);
const { students } = await api(`/teacher/courses/${courseId}/students`);
const code = (s) => s.code.replace('-', '');
await api('/student/login', { method: 'POST' }, code(students[0]));
await api('/student/login', { method: 'POST' }, code(students[1]));
await page.reload();
await page.getByRole('cell', { name: 'Anna Beispiel' }).waitFor();
await shot('schueler');
await page.getByRole('link', { name: /Codezettel drucken/ }).click();
await page.getByText('Anna Beispiel · 1AHIF').waitFor();
await shot('codezettel');

// exercises
await page.goto(`${BASE}/kurse/${courseId}/aufgaben`);
const file = page.locator('input[type=file]');
await file.setInputFiles(path.join(zipDir, 'summe.zip'));
await page.getByText('„Summe zweier Zahlen“ hochgeladen').waitFor();
await shot('aufgaben-hochgeladen');
await file.setInputFiles(path.join(zipDir, 'maximum.zip'));
await page.getByText(/„.*“ hochgeladen/).waitFor();
await page.getByRole('button', { name: '+ Neue Gruppe' }).click();
await page.getByLabel('Name').fill('Verzweigungen');
await page.getByRole('button', { name: 'Anlegen' }).click();
await page.getByText('Verzweigungen').first().waitFor();
for (const t of [/Summe zweier Zahlen/, /Maximum/i]) {
  await page.getByRole('row', { name: t }).getByRole('switch').click();
  await page.waitForTimeout(400);
}
const setDeadline = async (name, date, time) => {
  const row = page.getByRole('row', { name });
  await row.getByLabel('Frist: Datum').fill(date);
  if (time) await row.getByLabel('Frist: Uhrzeit').fill(time);
  await row.getByRole('button', { name: 'Speichern' }).click();
  await page.waitForTimeout(500);
};
await setDeadline(/Summe zweier Zahlen/, '2027-01-15');
await setDeadline(/Maximum/i, '2027-01-22', '12:30');
await page.getByRole('row', { name: /Maximum/i }).getByRole('combobox').selectOption({ label: 'Verzweigungen' });
await page.waitForTimeout(500);
await page.reload();
await page.getByText('Verzweigungen').first().waitFor();
await shot('aufgaben');

// hand-ins and one grade (through the grading API)
const hand = (s, id, body, tests) =>
  api(`/exercises/${id}/handins`, { method: 'POST', body: JSON.stringify({ files: [{ path: id === 'summe' ? 'Summe.java' : 'Maximum.java', content: body }], testSummary: tests }) }, code(s));
const summe = `void main() {\n    Scanner sc = new Scanner(System.in);\n    IO.print("Erste Zahl: ");\n    int a = sc.nextInt();\n    IO.print("Zweite Zahl: ");\n    int b = sc.nextInt();\n    IO.println("Summe: " + (a + b));\n}\n`;
await hand(students[0], 'summe', summe, { passed: 3, total: 3 });
await hand(students[1], 'summe', summe.replace('a + b', 'a - b'), { passed: 1, total: 3 });
await hand(students[2], 'summe', summe, { passed: 3, total: 3 });
await hand(students[0], 'maximum', 'static int maximum(int a, int b) {\n    if (a > b) {\n        return a;\n    }\n    return b;\n}\n', { passed: 3, total: 3 });
await page.goto(`${BASE}/konto/api-schluessel`);
await page.getByLabel('Name').fill('Grader am Schul-Laptop');
await page.getByRole('button', { name: 'Schlüssel erzeugen' }).click();
const key = (await page.getByTestId('new-key').textContent()).trim();
await shot('api-schluessel');
const auth = { Authorization: `Bearer ${key}` };
const exList = await (await fetch(`${BASE}/api/v1/courses/${courseId}/exercises`, { headers: auth })).json();
const summeId = exList.find((e) => e.slug === 'summe').id;
const hl = await (await fetch(`${BASE}/api/v1/courses/${courseId}/exercises/${summeId}/handins`, { headers: auth })).json();
const annaHandin = hl.find((h) => h.studentId === students[0].id);
const gradeRes = await fetch(`${BASE}/api/v1/handins/${annaHandin.handinId}/grade`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ symbol: 'PLUS', comment: 'Sauber gelöst, die Ausgabe passt.', lineComments: [{ path: 'Summe.java', line: 6, text: 'Gut: beide Zahlen werden mit einer Eingabeaufforderung gelesen.' }] })
});
console.log('grade', gradeRes.status);

// matrix: show graded exercises too, for the screenshot
await page.goto(`${BASE}/kurse/${courseId}/abgaben`);
await page.getByText('Anna Beispiel').waitFor();
await page.getByRole('button', { name: /Beurteilte ausblenden/ }).click();
await page.waitForTimeout(500);
await shot('abgaben-matrix');
await page.getByRole('row', { name: /Ben Muster/ }).getByRole('link').first().click();
await page.getByText('Verlauf (').waitFor();
await shot('abgabe-detail');
await page.goBack();
await page.getByRole('row', { name: /Anna Beispiel/ }).getByRole('link').nth(1).click();
await page.getByText('Verlauf (').waitFor();
await shot('abgabe-beurteilt');

await browser.close();
console.log('done');
