# Abgaben und Bewertung

Der Bereich „Abgaben“ eines Kurses ist die Startseite im Lehrer-Web. Er zeigt, wer was abgegeben hat.

## Die Abgaben-Matrix

Jede Zeile ist eine Person, jede Spalte eine freigeschaltete Aufgabe.

![Matrix der Abgaben](/images/abgaben-matrix.png)

Jede Zelle zeigt:

- die **Testergebnisse** der Abgabe, zum Beispiel „✓ 3/3“ (alle Tests bestanden) oder „1/3“. Gibt es keine Tests, steht „abgegeben“.
- „· verspätet“, wenn die Abgabe nach der Frist kam
- den Zeitpunkt der Abgabe
- „–“ und „keine Abgabe“, wenn nichts abgegeben wurde

Die Farben erklärt die Legende oben rechts: grün für „alle Tests bestanden“, gelb für „Tests teilweise“, rot für „verspätet“ und grau für „keine Abgabe“. Das Schloss „🔒“ heißt „beurteilt – Abgabe gesperrt“.

Der Spaltenkopf zeigt die Frist und die Zahl der Abgaben, zum Beispiel „Frist 15.01. · 3/6“. Hat jemand die Aufgabe mehrmals abgegeben, zählt die **letzte** Abgabe.

::: warning Tests sind nur ein Hinweis
Das Testergebnis kommt vom Laptop der Schüler:innen. Es ist keine Beurteilung.
:::

### Filtern

- Das Feld „Schüler:in suchen“ sucht nach Namen.
- „Nur fehlende Abgaben“ zeigt nur Personen, bei denen mindestens eine sichtbare Aufgabe fehlt.

### Beurteilte Aufgaben ausblenden

Mit der Zeit wird die Matrix breit. Deshalb gibt es „Beurteilte ausblenden“. Der Schalter ist **standardmäßig an**.

- Eine Aufgabe zählt als beurteilt, sobald **irgendeine** Abgabe dazu beurteilt ist. Sie verschwindet dann aus der Matrix.
- Unter der Spaltenüberschrift gibt es „ausblenden“, um eine Aufgabe von Hand auszublenden.
- Eine Leiste „N ausgeblendet:“ zeigt die ausgeblendeten Aufgaben mit Grund („beurteilt“ oder „von Hand“). „Einblenden“ holt eine Aufgabe zurück. „Alle einblenden“ holt alle zurück. Bei vielen Aufgaben öffnet „+N weitere“ eine Liste mit Suche.

Die Einstellung gilt pro Kurs und gilt auch für den ZIP-Download.

## Eine Abgabe ansehen

Ein Klick auf eine Zelle öffnet die Abgabe.

![Eine Abgabe mit Code und Testergebnis](/images/abgabe-detail.png)

- Links steht der **Code** mit Syntaxfarben. Bei mehreren Dateien gibt es für jede einen Reiter. Sie können den Code nicht ändern.
- Rechts stehen die Karten „Abgabe“ (Zeitpunkt, Frist, „Tests (lokal)“), „Testergebnisse“ und „Verlauf“.
- „Verlauf“ listet alle Abgaben dieser Person zur Aufgabe. „zählt“ markiert die letzte. Ein Klick öffnet eine ältere Abgabe.
- Oben rechts springen Sie mit den Knöpfen „← Name“ und „Name →“ zur vorigen oder nächsten Person, die diese Aufgabe abgegeben hat.
- Eine verspätete Abgabe trägt oben das Kennzeichen „verspätet“.

## Alle Abgaben herunterladen

Oben rechts steht „Alle Abgaben einer Aufgabe (ZIP)“. Wählen Sie die Aufgabe aus. Sie bekommen eine ZIP-Datei mit der letzten Abgabe jeder Person, **ein Ordner pro Schüler:in**.

## Beurteilen

Das Lehrer-Web zeigt Beurteilungen an. Sie tragen sie nicht dort ein, sondern mit dem Programm **Grader** (Gradeflow). Grader liest die Abgaben von J;DE und schreibt die Beurteilung zurück.

Eine Beurteilung besteht aus:

- einem **Symbol**: Plus (+), Plus-Welle (+~), Welle (~), Minus-Welle (−~) oder Minus (−)
- einem **Gesamtkommentar**
- optionalen **Zeilenkommentaren** im Code

![Beurteilte Abgabe mit Zeilenkommentar](/images/abgabe-beurteilt.png)

Eine beurteilte Abgabe ist **gesperrt**:

- In der Matrix steht „🔒“ und das Symbol in der Zelle.
- Auf der Abgabeseite zeigt die Karte „Beurteilung“ Note, Zeitpunkt und Kommentar. Die Zeilenkommentare stehen direkt im Code.
- Die Schüler:in kann die Aufgabe **nicht mehr abgeben**. Eine Beurteilung ändern Sie, indem Sie in Grader neu beurteilen.
- Schüler:innen sehen ihre eigene Beurteilung in der App.

### API-Schlüssel für Grader

Grader braucht einen API-Schlüssel von Ihnen.

1. Öffnen Sie links unten „API-Schlüssel“.
2. Geben Sie einen „Namen“ ein, zum Beispiel „Grader am Schul-Laptop“.
3. Klicken Sie auf „Schlüssel erzeugen“.
4. Der Schlüssel wird **nur jetzt** vollständig angezeigt. Klicken Sie auf „Kopieren“. Fügen Sie ihn in Grader ein (Einstellungen → J;DE).

![API-Schlüssel erzeugen](/images/api-schluessel.png)

Der Schlüssel gibt Zugriff auf alle Ihre Kurse, Aufgaben und Abgaben. Geben Sie ihn nicht weiter. Mit „Widerrufen …“ wird er sofort ungültig. Bereits eingetragene Beurteilungen bleiben erhalten.

Die Schnittstelle ist in der [Spezifikation](https://github.com/mfreimueller/jide/blob/main/SPEC.md#grading-api-graders-gradeflow-m8) beschrieben.
