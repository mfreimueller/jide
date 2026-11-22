# Aufgaben

Eine **Aufgabe** ist ein Ordner mit Angabe, Startcode und Tests. Sie laden ihn als ZIP-Datei hoch und schalten ihn dann für einen Kurs frei. Aufgaben gehören Ihnen und sind für alle Ihre Kurse verfügbar.

## Aufbau einer Aufgabe

Das Beispiel `summe`:

```
summe/
  exercise.yaml     Beschreibung der Aufgabe
  aufgabe.md        Angabe, wird in der App schön dargestellt
  files/
    Summe.java      Startcode, den die Schüler:innen sehen
  tests.yaml        Tests (optional)
```

Weitere Beispiele finden Sie im Ordner [`examples/`](https://github.com/mfreimueller/jide/tree/main/examples) des Projekts.

### exercise.yaml

```yaml
id: summe
title: "Summe zweier Zahlen"
files:
  - path: Summe.java
    editable: true
mainFile: Summe.java
difficulty: newbie
```

- `id`: eindeutiger Kurzname. Er ist auch der Ordnername bei der Abgabe. Die ID darf nicht mit `scratch-` beginnen.
- `title`: Titel in der Aufgabenliste.
- `files`: Dateien der Aufgabe. `editable: false` macht eine Datei schreibgeschützt, zum Beispiel eine vorgegebene Klasse.
- `mainFile`: Datei, die gestartet wird.
- `difficulty` (optional): `newbie`, `advanced` oder `pro`. Die Aufgabenkarte zeigt dann „Pflicht“, „Advanced“ oder „Pro“. Jeder andere Wert wird beim Hochladen abgelehnt.

Optional gibt es außerdem:

- **`harness`**: ein versteckter `main()`, der ans Ende der Datei gehängt wird. So müssen Schüler:innen nur eine Methode schreiben.
- **`images`**: SVG-Bilder in `files/`, zum Beispiel ein Klassendiagramm.
- **`resources/`**: Eingabedateien, etwa für Dateioperationen.

Alle Felder genau beschrieben stehen in der [Spezifikation, Abschnitt 4](https://github.com/mfreimueller/jide/blob/main/SPEC.md#4-exercise-format).

### tests.yaml

Es gibt zwei Arten von Tests.

```yaml
tests:
  - name: "3 + 4"
    type: io              # gibt Eingaben vor, vergleicht die Ausgabe
    input: "3\n4\n"
    expected: "Summe: 7"
    match: contains
  - name: "summe(-2, 5)"
    type: check           # Java-Ausdruck, verglichen mit einem erwarteten Wert
    call: "summe(-2, 5)"
    expected: "3"
```

- **`io`**: Das Programm bekommt die `input`-Zeilen und die Ausgabe wird mit `expected` verglichen. `match` legt fest, wie genau: `exact`, `trimmed` (Standard), `contains` oder `lines`.
- **`check`**: Ruft eine Methode auf oder führt einen Codeblock aus. Verwenden Sie `check` für Methoden und `io` nur, wenn die Ausgabe selbst getestet wird.
- Jeder Test hat ein Zeitlimit, standardmäßig 2 Sekunden.

Die Schüler:innen sehen „Dein Code sieht richtig aus!“, wenn alle Tests bestehen. Sonst sehen sie „Da sind noch Fehler in deinem Programm.“ Die Details stehen in der [Spezifikation, Abschnitt 3.4](https://github.com/mfreimueller/jide/blob/main/SPEC.md#34-tests-testen).

::: warning Tests sind nicht geheim
Schüler:innen können die Tests lesen. Sie sind eine Rückmeldung und keine Beurteilung.
:::

## Aufgabe hochladen

1. Packen Sie den Aufgabenordner als ZIP-Datei. Entweder liegt der Ordner (`summe/`) in der ZIP-Datei, oder die Dateien liegen direkt im Stamm.
2. Öffnen Sie im Kurs „Aufgaben“.
3. Ziehen Sie die ZIP-Datei auf „Aufgabe hochladen“. Oder klicken Sie auf „Datei auswählen“.

Das Lehrer-Web prüft das Format. Bei einem Fehler steht „Hochladen nicht möglich“ mit einer deutschen Erklärung. Bei Erfolg steht der Titel der Aufgabe mit „hochgeladen“, zum Beispiel „Summe zweier Zahlen“ hochgeladen, mit dem Hinweis „noch nicht freigeschaltet“.

![Aufgabe hochgeladen](/images/aufgaben-hochgeladen.png)

Die ZIP-Datei darf höchstens 10 MB groß sein.

### Aufgabe aktualisieren

Laden Sie eine ZIP-Datei mit **derselben `id`** hoch. Die Aufgabe wird ersetzt. Dann steht „aktualisiert“ da, und „Freischaltung und Frist bleiben erhalten“.

## Freischalten

Neue Aufgaben sind zuerst **nicht freigeschaltet**. Schüler:innen sehen sie nicht.

In der Spalte „Freigeschaltet“ steht pro Aufgabe ein Schalter. Er gilt **nur für diesen Kurs**. Sobald der Schalter an ist, taucht die Aufgabe in der App der Schüler:innen auf. In der Spalte „Abgaben“ steht dann zum Beispiel „2 / 6“. Bei nicht freigeschalteten Aufgaben steht dort „nicht sichtbar“.

## Abgabefrist

Jede Aufgabe kann pro Kurs eine Frist haben.

1. Wählen Sie in der Spalte „Frist (Wiener Zeit)“ das Datum.
2. Passen Sie bei Bedarf die Uhrzeit an. Ohne Angabe gilt 23:59.
3. Klicken Sie auf „Speichern“.

„Frist entfernen“ löscht die Frist wieder.

Die Frist ist **weich**: Abgaben danach werden angenommen und als „verspätet“ markiert. Verlängern Sie die Frist, verschwindet die Markierung bei bisherigen Abgaben.

## Gruppen

Gruppen ordnen die Aufgaben in der Liste der Schüler:innen, zum Beispiel nach Themen.

- „+ Neue Gruppe“ legt eine Gruppe an („Neue Gruppe“, Feld „Name“, Knopf „Anlegen“).
- In der Spalte „Gruppe“ weisen Sie jeder Aufgabe eine Gruppe zu. „–“ bedeutet keine Gruppe.
- Gruppen können Sie „Umbenennen“ und „Löschen“. Beim Löschen bleiben die Aufgaben erhalten. Sie stehen dann unter „Ohne Gruppe“.
- Schüler:innen sehen Aufgaben ohne Gruppe unter „Weitere Übungen“.

Die Reihenfolge in der App richtet sich nach der Freischaltung. Die neueste Aufgabe steht oben.

![Aufgaben mit Freischaltung, Frist und Gruppe](/images/aufgaben.png)

## Aufgabe löschen

„Löschen“ in der Zeile entfernt die Aufgabe aus **allen** Kursen. Vorher zeigt ein Fenster, welche Kurse betroffen sind und wie viele Abgaben **endgültig gelöscht** werden.
