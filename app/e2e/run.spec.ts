import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { launch, openExercise, screenshotDir, setEditorText, useTempApp } from "./helpers";

useTempApp();

const SUMME = `void main() {
    Scanner sc = new Scanner(System.in);
    IO.print("Erste Zahl: ");
    int a = sc.nextInt();
    IO.print("Zweite Zahl: ");
    int b = sc.nextInt();
    IO.println("Summe: " + (a + b));
}
`;

function consoleText(page: Page) {
  return page.getByTestId("console").locator(".xterm-rows");
}

async function startRun(page: Page): Promise<void> {
  await page.getByTestId("run").click();
}

test("a Scanner program reads two numbers and prints the sum", async ({}, info) => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, SUMME);
  await startRun(page);
  await expect(page.getByTestId("btab-Konsole")).toHaveClass(/active/);
  await expect(consoleText(page)).toContainText("▶ Summe.java wird ausgeführt …");
  await expect(consoleText(page)).toContainText("Erste Zahl:");
  await expect(page.getByTestId("run")).toBeDisabled();
  await expect(page.getByTestId("stop")).toBeEnabled();

  await page.keyboard.type("3");
  await page.keyboard.press("Enter");
  await expect(consoleText(page)).toContainText("Zweite Zahl:");
  await page.keyboard.type("45");
  await page.keyboard.press("Backspace"); // fixes the typo: only "4" is sent
  await page.keyboard.press("Enter");

  await expect(consoleText(page)).toContainText("Summe: 7");
  await expect(consoleText(page)).toContainText("■ Programm beendet.");
  await expect(page.getByTestId("run")).toBeEnabled();
  await expect(page.getByTestId("stop")).toBeDisabled();
  await page.screenshot({ path: join(screenshotDir, "konsole.png") });
  info.annotations.push({ type: "screenshot", description: "konsole.png" });

  // "Leeren" empties the console
  await page.getByTestId("clear-console").click();
  await expect(consoleText(page)).not.toContainText("Summe: 7");
});

test("Stopp ends a program that never finishes", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, "void main() {\n    while (true) {}\n}\n");
  await startRun(page);
  await expect(consoleText(page)).toContainText("▶ Summe.java wird ausgeführt …");
  await page.getByTestId("stop").click();
  await expect(consoleText(page)).toContainText("■ Programm wurde gestoppt.");
  await expect(page.getByTestId("run")).toBeEnabled();
  await expect(page.getByTestId("stop")).toBeDisabled();
});

test("endless output is cut at the limit and the app stays responsive", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, 'void main() {\n    while (true) { IO.println("endlos"); }\n}\n');
  await startRun(page);
  await expect(consoleText(page)).toContainText(
    "Dein Programm hat sehr viel ausgegeben und wurde gestoppt (Endlosschleife?).",
    { timeout: 30_000 }
  );
  await expect(page.getByTestId("run")).toBeEnabled();
  // the UI still reacts
  await page.getByTestId("btab-Probleme").click();
  await expect(page.getByTestId("bottom-Probleme")).toContainText("Keine Probleme gefunden.");
});

test("with a compile error nothing runs and Probleme opens", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, 'void main() {\n    IO.println("hallo")\n}\n');
  await startRun(page);
  await expect(page.getByTestId("btab-Probleme")).toHaveClass(/active/);
  await expect(page.getByTestId("problem")).toContainText("';' erwartet");
  await page.getByTestId("btab-Konsole").click();
  await expect(consoleText(page)).toContainText("Dein Programm enthält noch Fehler – schau unter Probleme.");
  await expect(consoleText(page)).not.toContainText("wird ausgeführt");
  await expect(page.getByTestId("run")).toBeEnabled();
});

test("the hidden harness is run for 'Größere Zahl'", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Größere Zahl");
  await setEditorText(app, page, "int maximum(int a, int b) {\n    return a > b ? a : b;\n}\n");
  await startRun(page);
  await expect(consoleText(page)).toContainText("maximum(3, 7) = 7");
  await expect(consoleText(page)).toContainText("maximum(-4, -8) = -4");
  await expect(consoleText(page)).toContainText("■ Programm beendet.");
});

test("umlauts work in output and input", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(
    app,
    page,
    'void main() {\n    IO.println("Grüße");\n    String name = IO.readln("Name: ");\n    IO.println("Hallo " + name + "!");\n}\n'
  );
  await startRun(page);
  await expect(consoleText(page)).toContainText("Grüße");
  await expect(consoleText(page)).toContainText("Name:");
  await page.keyboard.type("Jörg");
  await page.keyboard.press("Enter");
  await expect(consoleText(page)).toContainText("Hallo Jörg!");
  await expect(consoleText(page)).toContainText("■ Programm beendet.");
});

test("an exception shows the exit code and its location jumps to the line", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, "void main() {\n    int[] a = new int[1];\n    a[2] = 1;\n}\n");
  await startRun(page);
  await expect(consoleText(page)).toContainText("ArrayIndexOutOfBoundsException");
  await expect(consoleText(page)).toContainText("■ Programm mit Fehler beendet (Code 1).");

  // click on "Summe.java:3" in the stack trace
  const row = consoleText(page).locator("> div", { hasText: "Summe.java:3" });
  const box = await row.boundingBox();
  const text = await row.innerText();
  const charWidth = await page.getByTestId("console").locator(".xterm-char-measure-element").first().evaluate((el) => {
    return el.getBoundingClientRect().width / (el.textContent ?? "W").length;
  });
  expect(box).not.toBeNull();
  const col = text.replace(/ /g, " ").indexOf("Summe.java:3") + 3;
  await page.mouse.move(box!.x + charWidth * col, box!.y + box!.height / 2);
  await page.mouse.move(box!.x + charWidth * (col + 0.5), box!.y + box!.height / 2);
  await page.mouse.click(box!.x + charWidth * (col + 0.5), box!.y + box!.height / 2);
  await page.keyboard.type("Q");
  // the cursor is at the start of line 3
  await expect(page.locator(".monaco-editor .view-line", { hasText: "a[2] = 1;" })).toContainText(/^\W*Q\W+a\[2\]/);
});

test("each run starts with an empty console", async () => {
  const { app, page } = await launch();
  await openExercise(page, "Summe zweier Zahlen");
  await setEditorText(app, page, 'void main() {\n    IO.println("ERSTER-LAUF");\n}\n');
  await startRun(page);
  await expect(consoleText(page)).toContainText("ERSTER-LAUF");
  await expect(consoleText(page)).toContainText("■ Programm beendet.");

  await setEditorText(app, page, 'void main() {\n    IO.println("ZWEITER-LAUF");\n}\n');
  await startRun(page);
  await expect(consoleText(page)).toContainText("ZWEITER-LAUF");
  await expect(consoleText(page)).toContainText("■ Programm beendet.");
  await expect(consoleText(page)).not.toContainText("ERSTER-LAUF");

  // a run that ends in the "noch Fehler" message clears the console as well
  await setEditorText(app, page, 'void main() {\n    IO.println("hallo")\n}\n');
  await startRun(page);
  await page.getByTestId("btab-Konsole").click();
  await expect(consoleText(page)).toContainText("Dein Programm enthält noch Fehler – schau unter Probleme.");
  await expect(consoleText(page)).not.toContainText("ZWEITER-LAUF");
});
