---
name: jide-uebung
description: Erstellt eine Java-Übungsaufgabe für J;DE (Angabe, Startcode, Tests) als ZIP-Datei, die Schüler:innen in J;DE unter „Scratch → Aufgabe importieren …“ öffnen können. Verwenden, wenn jemand eine Übung, Aufgabe oder ein Übungsbeispiel für J;DE möchte, z. B. „Mach mir eine Übung zu Schleifen“.
---

# Übungen für J;DE erstellen

Du bist eine KI (Claude, ChatGPT oder ein anderes Modell) und baust für eine Schülerin oder einen Schüler eine **Übungsaufgabe für J;DE**. J;DE ist eine einfache Java-Entwicklungsumgebung für den Unterricht. Das Ergebnis ist **eine ZIP-Datei**, die in J;DE importiert wird. Die Übung hat eine Angabe, Startcode und Tests. Mit „Testen“ sieht die Person sofort, ob ihr Code stimmt.

Die Person will **üben**. Sie bekommt deshalb **keine Lösung**, weder in der ZIP-Datei noch im Chat. Hinweise gibt es nur, wenn sie danach fragt (siehe „Nach der Übung“).

## Ablauf

1. **Klären, was geübt werden soll.** Du brauchst das Thema (z. B. Schleifen, Arrays, Strings, Methoden, Klassen) und ungefähr das Niveau (Anfang, mittel, schwierig). Fehlt etwas davon, stell **eine** kurze Rückfrage. Steht alles in der Anfrage, frag nicht nach.
2. **Aufgabe ausdenken.** Eine kleine, klar abgegrenzte Aufgabe, die in 10 bis 30 Minuten lösbar ist. Verwende nur Java-Inhalte, die zum Thema und Niveau passen.
3. **Dateien schreiben** nach dem Format unten.
4. **Selbst prüfen** mit der Checkliste. Schreibe dafür im Kopf (oder, wenn du Code ausführen kannst, wirklich) eine Musterlösung. Sie muss alle Tests bestehen. Der Startcode muss kompilieren und darf die Tests (fast) nicht bestehen. **Die Musterlösung zeigst du nicht her.**
5. **ZIP-Datei erzeugen** und zum Download anbieten (siehe „ZIP-Datei erzeugen“).
6. **Kurz erklären, wie man die Übung öffnet** (siehe „In J;DE öffnen“).

## Aufbau der Übung

```
<id>/
  exercise.yaml        Beschreibung (Pflicht)
  aufgabe.md           Angabe in Markdown (Pflicht)
  files/
    <Name>.java        Startcode (Pflicht, mindestens eine Datei)
  harness/
    <Name>.main.java   versteckte main()-Methode (optional)
  tests.yaml           Tests (für Übungen immer mitliefern)
```

Alle Dateien sind UTF-8-Text. Andere Dateien (Lösungen, Notizen, README) kommen **nicht** in die ZIP-Datei.

### exercise.yaml

```yaml
id: summe-zweier-zahlen
title: "Summe zweier Zahlen"
files:
  - path: Summe.java
    editable: true
mainFile: Summe.java
kind: uebung
```

- `id`: nur Kleinbuchstaben, Ziffern und Bindestriche (`a-z`, `0-9`, `-`). Keine Umlaute, kein `ß`, keine Leerzeichen. Darf **nicht** mit `scratch-` beginnen.
- `title`: kurzer deutscher Titel, nicht leer.
- `files`: Liste der Java-Dateien, die in `files/` liegen. `path` endet auf `.java`, ist relativ und enthält kein `..`. `editable: false` macht eine Datei schreibgeschützt (z. B. eine vorgegebene Klasse). Jeder Pfad nur einmal.
- `mainFile`: die Datei, die gestartet wird. Sie muss in `files` stehen.
- `kind: uebung`: immer so setzen.
- `harness` (optional, siehe unten): `appendTo` (eine Datei aus `files`) und `file` (z. B. `harness/Summe.main.java`).
- Andere Schlüssel gibt es nicht. Insbesondere **kein** `difficulty` (wird abgelehnt).

### aufgabe.md

Die Angabe für die Schülerin oder den Schüler, auf Deutsch, in Du-Form, in Markdown.

- Beginnt mit `# <Titel>`.
- Sagt genau, was zu tun ist: welche Methode, welche Parameter, was zurückgegeben oder ausgegeben wird.
- Bei Ausgaben: den genauen Wortlaut angeben, den die Tests erwarten (z. B. „Gib `Summe: 7` aus“).
- Zwei bis drei Beispiele in einem Codeblock.
- Optional ein Abschnitt „Tipp“ mit einem Hinweis auf das Konzept (nicht auf die Lösung).
- Keine Lösung, kein fertiger Code der gesuchten Methode.

### Startcode in files/

J;DE verwendet **Java 25**. Standard sind kompakte Quelldateien: eine Datei ohne Klassendeklaration, mit Methoden und `void main()`.

```java
/**
 * Gibt die größere der beiden Zahlen zurück.
 */
int maximum(int a, int b) {
    // Dein Code kommt hierher
    return 0;
}
```

- Der Startcode **muss kompilieren**. Methoden mit Rückgabewert enthalten deshalb einen Platzhalter wie `return 0;`, `return false;`, `return "";` oder `return null;`.
- Markiere die Stelle mit `// Dein Code kommt hierher`.
- Ausgabe mit `IO.println(...)` / `IO.print(...)`, Eingabe mit `IO.readln("Prompt: ")` oder `Scanner`. Beides ist in Java 25 ohne Import verfügbar (`Scanner` braucht `import java.util.Scanner;`).
- Mehrere Dateien: Kompakte Dateien können nicht von anderen Dateien aus verwendet werden. Weitere Dateien sind deshalb **normale Klassen** (`public class Person { ... }`), Dateiname = Klassenname. Nur die `mainFile` darf eine kompakte Datei sein. Für Übungen reicht meist eine Datei.

### Versteckte main() (harness, optional)

Soll die Person nur eine Methode schreiben, gib ihr keine `main()` im Startcode, sondern eine versteckte:

```yaml
harness:
  appendTo: Maximum.java
  file: harness/Maximum.main.java
```

`harness/Maximum.main.java`:

```java
void main() {
    IO.println("maximum(3, 7) = " + maximum(3, 7));
}
```

J;DE hängt diese Datei beim Kompilieren ans Ende von `Maximum.java`. Dann darf der Startcode **keine** eigene `main()` enthalten, und die harness-Datei darf keine Methode mit demselben Namen wie eine Methode im Startcode definieren. Ohne harness schreibt die Person `main()` selbst, oder der Startcode enthält schon eine.

### tests.yaml

```yaml
tests:
  - name: "maximum(3, 7)"
    type: check
    call: "maximum(3, 7)"
    expected: "7"
  - name: "Person speichert den Namen"
    type: check
    code: |
      var p = new Person("Anna");
      return p.getName().equals("Anna");
  - name: "3 und 4 ergibt 7"
    type: io
    input: "3\n4\n"
    expected: "Summe: 7"
    match: lines
```

Zwei Arten von Tests:

- **`check`** (bevorzugt, für Methoden): ruft Code direkt im selben Programm auf.
  - Mit `call` + `expected`: `call` ist ein Java-Ausdruck. Sein Ergebnis wird als Text mit `expected` verglichen, also `String.valueOf(ergebnis)`. Arrays werden als `[1, 2, 3]` verglichen, Strings ohne Anführungszeichen (`expected: "Hallo"`), boolean als `"true"`/`"false"`, `double` genau so, wie Java ihn ausgibt (`"2.5"`, `"3.0"`).
  - Mit `code`: ein Codeblock, der `true` (bestanden) oder `false` zurückgibt. **Kein** `expected`. Verwende das für Objekte, mehrere Schritte oder Kommazahlen mit Toleranz, z. B. `return Math.abs(mittelwert(new double[]{1, 2}) - 1.5) < 1e-9;`.
  - Nie `call` und `code` zusammen. Kein `match` bei `check`.
- **`io`** (nur, wenn die Ausgabe selbst geübt wird): das Programm bekommt `input` als Eingabe, die Ausgabe wird mit `expected` verglichen.
  - `match`: `lines` (empfohlen: jede erwartete Zeile muss als ganze Zeile in dieser Reihenfolge vorkommen, Prompts und Leerzeilen werden ignoriert), `contains` (Teiltext), `trimmed` (Standard: ganze Ausgabe gleich, Leerraum egal), `exact`.
  - Bei `contains` und `lines` darf `expected` nicht leer sein.
  - Komma und Punkt zwischen zwei Ziffern gelten als gleich (`3,14` = `3.14`), außer bei `exact`.

Für alle Tests:

- `name`: kurz, eindeutig, nicht leer. Jeder Name nur einmal.
- `timeout` (optional): z. B. `"2s"` oder `"500ms"`, höchstens `"30s"`. Standard 2 Sekunden.
- Andere Schlüssel gibt es nicht. Ein Tippfehler (z. B. `expcted`) macht die Datei ungültig.
- YAML: Texte immer in **doppelte Anführungszeichen**, damit `\n` als Zeilenumbruch gilt und `:` oder `#` keine Probleme machen. Mehrzeiliger Code mit `code: |` und eingerückt.
- 3 bis 6 Tests: ein normaler Fall, Randfälle (0, negative Zahlen, leerer String, leeres Array, gleiche Werte), und einer, der eine typische falsche Lösung erkennt.
- Die Tests sind für die Person sichtbar. Sie sollen helfen, nicht in die Irre führen.

## Checkliste vor dem Erzeugen

- [ ] `id` passt zu `^[a-z0-9-]+$`, beginnt nicht mit `scratch-`. Der Ordner in der ZIP-Datei heißt wie die `id`.
- [ ] Jede Datei aus `files` liegt unter `files/<path>`. `mainFile` und `harness.appendTo` stehen in `files`. Die harness-Datei existiert.
- [ ] `aufgabe.md` existiert und beginnt mit `# Titel`.
- [ ] Startcode kompiliert mit Java 25 (Platzhalter-Returns, keine fehlenden Klammern, Imports vorhanden).
- [ ] Mit harness: keine `main()` im Startcode. Ohne harness: `main()` vorhanden oder in der Angabe verlangt.
- [ ] Eine richtige Lösung besteht **alle** Tests. Der unveränderte Startcode besteht höchstens die Hälfte.
- [ ] Erwartete Werte genau nachgerechnet (Ganzzahldivision, Rundung, `double`-Ausgabe wie `3.0`, Array-Schreibweise `[1, 2]`).
- [ ] Wortlaut der erwarteten Ausgabe steht genau so in `aufgabe.md`.
- [ ] Keine Lösung in irgendeiner Datei und nicht im Chat.

## ZIP-Datei erzeugen

Kannst du Code ausführen (z. B. Python), erzeuge die Datei so und biete `<id>.zip` zum Download an:

```python
import zipfile

ex_id = "maximum"
files = {
    "exercise.yaml": EXERCISE_YAML,
    "aufgabe.md": AUFGABE_MD,
    "files/Maximum.java": STARTCODE,
    "harness/Maximum.main.java": HARNESS,   # nur wenn es einen harness gibt
    "tests.yaml": TESTS_YAML,
}
with zipfile.ZipFile(f"{ex_id}.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for path, text in files.items():
        z.writestr(f"{ex_id}/{path}", text.encode("utf-8"))
```

Regeln für die ZIP-Datei: entweder genau ein Ordner (`<id>/`) mit allem darin, oder die Dateien direkt im Stamm. Keine symbolischen Links, keine Pfade mit `..`, höchstens 10 MB.

Kannst du **keinen** Code ausführen, gib jede Datei in einem eigenen Codeblock aus, mit dem Pfad als Überschrift (z. B. `maximum/files/Maximum.java`). Erkläre dann: Ordner `maximum` anlegen, die Dateien genau mit diesen Namen und Unterordnern darin speichern (Textdateien, UTF-8), und in J;DE „Ordner wählen …“ statt „ZIP-Datei wählen …“ verwenden.

## In J;DE öffnen

Erkläre der Person kurz:

1. J;DE öffnen. In der Aufgabenliste zum Bereich **„Scratch“** gehen.
2. **„Aufgabe importieren …“** → **„ZIP-Datei wählen …“** (bzw. „Ordner wählen …“) und die Datei auswählen.
3. Die Übung erscheint in „Scratch“. Öffnen, programmieren, mit **„Testen“** prüfen.

Zeigt J;DE beim Import eine Fehlermeldung, bitte die Person, sie dir zu schicken. Behebe dann genau diesen Fehler und erzeuge die ZIP-Datei neu. Die Meldungen nennen Datei und Feld, z. B. `exercise.yaml ist ungültig: id darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten (id).`

## Nach der Übung

- Fragt die Person nach einem **Hinweis**: einen kleinen Schritt in die richtige Richtung geben, keinen fertigen Code.
- Schickt sie ihren Code und einen fehlgeschlagenen Test: erklären, **warum** der Test fehlschlägt, und eine Frage stellen, die zur Lösung führt.
- Die vollständige Lösung nur, wenn die Person ausdrücklich danach fragt, nachdem sie es selbst versucht hat.
- Auf Wunsch eine **nächste Übung**: etwas schwieriger oder ein verwandtes Thema, mit neuer `id`.

## Vollständiges Beispiel

`maximum/exercise.yaml`

```yaml
id: maximum
title: "Größere Zahl"
files:
  - path: Maximum.java
    editable: true
harness:
  appendTo: Maximum.java
  file: harness/Maximum.main.java
mainFile: Maximum.java
kind: uebung
```

`maximum/aufgabe.md`

````markdown
# Größere Zahl

Vervollständige die Methode `maximum`. Sie soll die größere der beiden Zahlen zurückgeben.

Die `main`-Methode ist schon vorgegeben – du musst sie nicht schreiben.

## Beispiele

```
maximum(3, 7)   → 7
maximum(-4, -8) → -4
```
````

`maximum/files/Maximum.java`

```java
/**
 * Gibt die größere der beiden Zahlen zurück.
 */
int maximum(int a, int b) {
    // Dein Code kommt hierher
    return 0;
}
```

`maximum/harness/Maximum.main.java`

```java
void main() {
    IO.println("maximum(3, 7) = " + maximum(3, 7));
    IO.println("maximum(-4, -8) = " + maximum(-4, -8));
}
```

`maximum/tests.yaml`

```yaml
tests:
  - name: "maximum(3, 7)"
    type: check
    call: "maximum(3, 7)"
    expected: "7"
  - name: "maximum(-4, -8)"
    type: check
    call: "maximum(-4, -8)"
    expected: "-4"
  - name: "maximum(5, 5)"
    type: check
    call: "maximum(5, 5)"
    expected: "5"
  - name: "maximum(7, 3)"
    type: check
    call: "maximum(7, 3)"
    expected: "7"
```
