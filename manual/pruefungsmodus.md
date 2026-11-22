# Prüfungsmodus

Der Prüfungsmodus ist für Schularbeiten und Tests. Er ist **dieselbe App** wie im Unterricht, nur anders gestartet:

- Sie startet vom schreibgeschützten Angabelaufwerk. Es ist keine Installation nötig.
- Sie verbindet sich nie mit dem Netzwerk und aktualisiert sich nie.
- Die Aufgaben liegen als Ordner neben der App.
- Die Abgabe wird auf das Laufwerk der Schüler:innen kopiert.

Der Prüfungsmodus ist aktiv, wenn neben `JDE.exe` eine Datei `exam.json` liegt.

## Den Prüfungsordner besorgen

Zu jeder Programmversion gehört eine ZIP-Datei `JDE-Exam-<Version>.zip`. Sie finden sie auf der [Seite der Programmversionen](https://github.com/mfreimueller/jide/releases) neben dem Installer. Sie enthält den Ordner `JDE-Exam` mit:

- `JDE.exe` und den Dateien der App (ohne Installer, ohne mitgeliefertes Java)
- `exam.json` als Beispiel
- `exercises\` mit zwei Beispielaufgaben

Kopieren Sie den Ordner `JDE-Exam` auf das Angabelaufwerk. Ersetzen Sie dann `exam.json` und die Aufgaben.

## exam.json

```json
{
  "mode": "exam",
  "title": "1. Test POS – Jänner",
  "handInPath": "P:\\",
  "jdkPath": null,
  "allowTests": true
}
```

| Feld | Bedeutung |
|---|---|
| `mode` | immer `"exam"` |
| `title` | Titel der Prüfung, wird beim Start angezeigt |
| `handInPath` | Laufwerk, auf das abgegeben wird, üblicherweise `P:\` (pro Schüler:in ein eigenes Laufwerk) |
| `jdkPath` | Ordner mit dem Java-JDK. `null` heißt: automatisch suchen |
| `allowTests` | `true` zeigt „Testen“, `false` blendet es aus |

Ein fehlerhaftes `exam.json` zeigt beim Start eine Fehlerseite.

## Aufgaben für die Prüfung

Legen Sie die Aufgaben-Ordner in den Ordner `exercises\`. Das Format ist **dasselbe wie beim Hochladen** (siehe [Aufgaben](/aufgaben)). Eine ZIP-Datei brauchen Sie nicht, Sie kopieren die Ordner von Hand.

Die Reihenfolge der Aufgaben richtet sich nach der `id`. Wollen Sie die Reihenfolge festlegen, setzen Sie Zahlen davor: `1-summe`, `2-maximum`.

## Java auf den Prüfungs-PCs

Der Prüfungsordner bringt kein Java mit. Auf den PCs muss **JDK 25 oder neuer** (mit `javac`) installiert sein. J;DE sucht in dieser Reihenfolge: `jdkPath` aus `exam.json`, die Variable `JAVA_HOME`, dann `java` im `PATH`. Wird nichts gefunden, zeigt die App eine Fehlerseite mit den durchsuchten Orten.

## Ablauf für Schüler:innen

1. `JDE.exe` im Ordner `JDE-Exam` starten.
2. Auf der Startseite stehen der Titel der Prüfung und das Abgabelaufwerk. Die Person gibt „Vor- und Nachname“ ein. Der Name wird bei jedem Start neu abgefragt und nicht gespeichert.
3. „Prüfung starten“ (erst aktiv, wenn ein Name eingetragen ist).
4. In der oberen Leiste gibt es für jede Aufgabe einen Reiter: „Aufgabe 1“, „Aufgabe 2“ und so weiter. Der Editor, der Code und das letzte Testergebnis bleiben je Aufgabe erhalten.
5. Mit „Abgeben“ wird die Lösung auf das Abgabelaufwerk kopiert.

Ein Ordner pro Aufgabe (`<Aufgabe>` ist die `id`) mit den Dateien und einer `abgabe.json` (Name, Zeit, Testergebnis) liegt danach auf dem Laufwerk.

### Automatisches Speichern

Die App speichert etwa jede Minute und bei jedem Start und Test in den Unterordner `_autosave` auf dem Abgabelaufwerk. Stürzt der PC ab oder wechselt jemand den PC, stellt die App beim Öffnen der Aufgabe den neueren Stand wieder her.

### Keine Sperre

Der Prüfungsmodus sperrt den PC **nicht**. Beim Schließen der App wird nur gefragt, wenn sich der Code seit der letzten Abgabe geändert hat.

## Vorher ausprobieren

Probieren Sie den Ordner vor der ersten Prüfung auf einem Prüfungs-PC aus. Die technischen Details stehen in [docs/exam-mode.md](https://github.com/mfreimueller/jide/blob/main/docs/exam-mode.md). Dort steht auch ein bekanntes Problem beim Start von einem Netzlaufwerk, dessen Verhalten auf dem echten Angabelaufwerk noch zu prüfen ist.

Prüfen Sie diese Punkte:

- Startet die App, und wie lange dauert es?
- Gibt es Windows-Warnungen (SmartScreen, Virenschutz)?
- Lässt sich eine Aufgabe öffnen? Geht „Ausführen“? Geht „Testen“?
- Wurde auf dem Netzlaufwerk nichts geändert?

## Was das Lehrer-Web sieht

Nichts. Im Prüfungsmodus gibt es keinen Server. Die Abgaben liegen nur auf dem Abgabelaufwerk. Übungs-Links werden ignoriert.
