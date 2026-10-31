// Manual walk-through (EMAIL=<teacher> node ...) of every screen against a local backend (npm run dev -w backend, dev server on :5174),
// with screenshots in teacher/screenshots/. Usage: node scripts/walkthrough.mjs <backend.log> <dir with summe.zip, maximum.zip, kaputt.zip>
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [logFile, zipDir] = process.argv.slice(2);
const BASE = 'http://localhost:5174';
const EMAIL = process.env.EMAIL ?? 't14@school.example'; // a teacher created with npm run teacher:add -w backend
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--lang=de-AT'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'de-AT', timezoneId: 'Europe/Vienna' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });

// 1 sign-in
await page.goto(`${BASE}/login`);
await page.getByLabel('E-Mail-Adresse').waitFor();
await shot('01-anmelden');
await page.getByLabel('E-Mail-Adresse').fill(EMAIL);
await page.getByRole('button', { name: 'Anmelde-Link senden' }).click();
await page.waitForURL(/login\/sent/);
await shot('02-link-gesendet');
await page.waitForTimeout(800);
const links = [...readFileSync(logFile, 'utf8').matchAll(/http:\/\/localhost:5174\/auth\/verify\?token=\w+/g)];
await page.goto(links.at(-1)[0]);
await page.waitForURL(`${BASE}/kurse`);
await shot('03-kurse-leer');
// reused link must fail
const p2 = await ctx.newPage();
await p2.goto(links.at(-1)[0]);
await p2.getByText('Dieser Link funktioniert nicht').waitFor();
await p2.screenshot({ path: path.join(out, '04-link-ungueltig.png') });
await p2.close();

// 2 courses
const addCourse = async (subject, cls) => {
  await page.getByLabel('Fach').fill(subject);
  await page.getByLabel('Klasse').fill(cls);
  await page.getByRole('button', { name: 'Kurs anlegen' }).click();
  await page.getByRole('link', { name: `${subject} · ${cls}` }).waitFor();
};
await addCourse('INF', '2BHIF');
await addCourse('POS', '1AHIF');
await page.getByRole('row', { name: /INF · 2BHIF/ }).getByRole('button', { name: 'Archivieren' }).click();
await page.getByRole('button', { name: /Archivierte anzeigen/ }).click();
await shot('05-kurse-verwalten');
await page.getByRole('link', { name: 'POS · 1AHIF' }).click();
await page.waitForURL(/abgaben/);
await shot('06-abgaben-leer');

// 3 students
await page.getByRole('link', { name: /Schüler:innen/ }).first().click();
const names = ['Anna Huber', 'Ben Gruber', 'Clara Wagner', 'David Pichler', 'Emma Steiner', 'Felix Moser', 'Hannah Bauer'];
await page.getByLabel('Namen, einer pro Zeile').fill(names.join('\n'));
await shot('07-schueler-hinzufuegen');
await page.getByRole('button', { name: '7 Codes erzeugen' }).click();
await page.getByRole('cell', { name: 'Anna Huber' }).waitFor();

const token = await page.evaluate(() => JSON.parse(localStorage.getItem('jide.teacher.session')).token);
const api = async (p, init = {}, bearer = token) => {
  const r = await fetch(`${BASE}/api${p}`, { ...init, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...init.headers } });
  return r.status === 204 ? {} : { status: r.status, ...(await r.json().catch(() => ({}))) };
};
const courseId = Number(page.url().match(/kurse\/(\d+)/)[1]);
const { students } = await api(`/teacher/courses/${courseId}/students`);

// 4 exercises
await page.getByRole('link', { name: /Aufgaben/ }).first().click();
const file = page.locator('input[type=file]');
await file.setInputFiles(path.join(zipDir, 'kaputt.zip'));
await page.getByText('Hochladen nicht möglich').waitFor();
await shot('08-aufgaben-fehler');
await file.setInputFiles(path.join(zipDir, 'summe.zip'));
await page.getByText('„Summe zweier Zahlen“ hochgeladen').waitFor();
await file.setInputFiles(path.join(zipDir, 'maximum.zip'));
await page.getByText(/hochgeladen/).waitFor();
await shot('09-aufgaben-hochgeladen');
for (const t of [/Summe zweier Zahlen/, /Maximum/i]) {
  const row = page.getByRole('row', { name: t });
  await row.getByRole('switch').click();
  await page.waitForTimeout(300);
}
// deadlines: Summe in the future (default time), Maximum in the past so hand-ins count as late
const setDeadline = async (name, date, time) => {
  const row = page.getByRole('row', { name });
  await row.getByLabel('Frist: Datum').fill(date);
  if (time) await row.getByLabel('Frist: Uhrzeit').fill(time);
  await row.getByRole('button', { name: 'Speichern' }).click();
  await page.waitForTimeout(400);
};
await setDeadline(/Summe zweier Zahlen/, '2026-11-27');
await setDeadline(/Maximum/i, '2026-10-01', '12:30');
await shot('10-aufgaben-freigegeben');
const ex = (await api(`/teacher/courses/${courseId}/exercises`)).exercises;
console.log('deadlines', ex.map((e) => [e.id, e.unlocked, e.deadline]));

// 5 hand-ins as students (curl-equivalent)
const code = (s) => s.code.replace('-', '');
await api('/student/login', { method: 'POST' }, code(students[0]));
await api('/student/login', { method: 'POST' }, code(students[1]));
const hand = (s, id, body, tests) =>
  api(`/exercises/${id}/handins`, { method: 'POST', body: JSON.stringify({ files: [{ path: id === 'summe' ? 'Summe.java' : 'Maximum.java', content: body }], testSummary: tests }) }, code(s));
const summe = (v) => `void main() {\n    Scanner sc = new Scanner(System.in);\n    // Eingabe\n    int a = sc.nextInt();\n    int b = sc.nextInt();\n    IO.println("Summe: " + (a ${v} b));\n}\n`;
console.log((await hand(students[0], 'summe', summe('-'), { passed: 1, total: 4 })).status);
console.log((await hand(students[0], 'summe', summe('+'), { passed: 4, total: 4 })).status);
console.log((await hand(students[1], 'summe', summe('-'), { passed: 3, total: 4 })).status);
console.log((await hand(students[2], 'summe', summe('+'), { passed: 4, total: 4 })).status);
console.log((await hand(students[0], 'maximum', 'static int maximum(int a, int b) {\n    /* Bedingung */\n    if (a > b) { return a; }\n    return "b".length() > 0 ? b : 0;\n}\n', { passed: 2, total: 3 })).status);
console.log((await hand(students[3], 'maximum', 'static int maximum(int a, int b) { return Math.max(a, b); }\n', null)).status);

// 6 views
await page.getByRole('link', { name: /Schüler:innen/ }).first().click();
await page.getByRole('cell', { name: 'Anna Huber' }).waitFor();
await page.reload();
await page.getByRole('cell', { name: 'Anna Huber' }).waitFor();
await shot('11-schueler');
await page.getByRole('row', { name: /Anna Huber/ }).getByRole('button', { name: 'Code zurücksetzen' }).click();
await page.waitForTimeout(300);
await shot('12-code-zuruecksetzen');
await page.keyboard.press('Escape');

await page.getByRole('link', { name: /Codezettel drucken/ }).click();
await page.getByText('Anna Huber · 1AHIF').waitFor();
await shot('13-codezettel');
await page.pdf({ path: path.join(out, '13-codezettel-druck.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });

await page.goto(`${BASE}/kurse/${courseId}/abgaben`);
await page.getByText('Anna Huber').waitFor();
await shot('14-abgaben-matrix');
await page.getByRole('button', { name: 'Nur fehlende Abgaben' }).click();
await page.getByLabel('Schüler:in suchen').fill('ben');
await shot('15-abgaben-filter');
await page.getByRole('button', { name: 'Nur fehlende Abgaben' }).click();
await page.getByLabel('Schüler:in suchen').fill('');
await page.getByRole('button', { name: /Alle Abgaben einer Aufgabe/ }).click();
await shot('16-abgaben-zip-menue');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Summe zweier Zahlen' }).click()]);
console.log('zip download', dl.suggestedFilename());
await dl.saveAs(path.join(out, dl.suggestedFilename()));

await page.getByRole('row', { name: /Anna Huber/ }).getByRole('link').nth(1).click();
await page.getByText('Verlauf (').waitFor();
await shot('17-abgabe-detail-verspaetet');
await page.goto(`${BASE}/kurse/${courseId}/abgaben`);
await page.getByRole('row', { name: /Ben Gruber/ }).getByRole('link').first().click();
await page.getByText('Verlauf (').waitFor();
await shot('18-abgabe-detail');
await page.locator('.course').click();
await shot('19-kursauswahl');

// expired session: a 401 sends the teacher back to the sign-in
await page.keyboard.press('Escape');
await page.locator('.nav', { hasText: 'Abmelden' }).click();
await page.waitForURL(/login/);
await browser.close();
console.log('done');
