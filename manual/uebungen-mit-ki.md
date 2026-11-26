# Übungen mit KI erstellen

Schüler:innen können sich mit einer KI (Claude, ChatGPT oder ähnlich) **eigene Übungen** für J;DE bauen lassen. Dafür gibt es eine fertige Anleitung für die KI, einen sogenannten **Skill**. Die KI erstellt damit eine ZIP-Datei mit Angabe, Startcode und Tests, die sich in J;DE importieren lässt.

- Die Übung landet im Bereich „Scratch“, also nur auf dem Laptop der Schülerin oder des Schülers. Sie trägt das Schild „Übung“.
- Es gibt keine Abgabe, keine Frist und keine Beurteilung. Sie sehen diese Übungen nicht.
- Die KI liefert **keine Lösung** mit. Hinweise gibt sie nur auf Nachfrage.

::: warning KI kann sich irren
Die KI prüft ihre Übung selbst, trotzdem kann ein Test falsch sein. Sagen Sie Ihren Schüler:innen: Wenn ein Test trotz richtiger Lösung fehlschlägt, der KI den Code und den Test schicken und nachfragen.
:::

## Skill herunterladen

[jide-uebung.zip herunterladen](./jide-uebung.zip){target="_self" download}

Die ZIP-Datei enthält den Ordner `jide-uebung` mit der Datei `SKILL.md`. Der Inhalt ist deutscher Text und kann gelesen und angepasst werden. Die aktuelle Fassung liegt auch im Projekt unter [`skills/jide-uebung/SKILL.md`](https://github.com/mfreimueller/jide/blob/main/skills/jide-uebung/SKILL.md).

## Anleitung für Schüler:innen

Diesen Abschnitt können Sie so weitergeben.

### 1. Skill einrichten

- **Claude** (claude.ai): Unter „Einstellungen“ → „Fähigkeiten“ → „Skills“ die Datei `jide-uebung.zip` hochladen. Die Codeausführung muss eingeschaltet sein.
- **ChatGPT und andere**: `SKILL.md` aus der ZIP-Datei auspacken und zu Beginn des Chats als Datei anhängen. Oder ihren Inhalt in die Anweisungen eines Projekts kopieren.

### 2. Übung bestellen

Zum Beispiel:

> Mach mir eine J;DE-Übung zu for-Schleifen, eher leicht.

> Ich will Arrays üben: etwas mit Suchen in einem int-Array, mittelschwer.

Die KI fragt höchstens einmal nach und liefert dann `<name>.zip` zum Herunterladen. Kann sie keine ZIP-Datei erzeugen, zeigt sie die Dateien einzeln an. Dann einen Ordner mit genau diesen Dateien anlegen.

### 3. In J;DE öffnen

1. In J;DE in der Aufgabenliste zum Bereich **„Scratch“** gehen.
2. **„Aufgabe importieren …“** → **„ZIP-Datei wählen …“** (oder „Ordner wählen …“) und die Datei auswählen.
3. Die Übung öffnen, programmieren und mit **„Testen“** prüfen.

Zeigt J;DE beim Import einen Fehler, die Meldung an die KI schicken. Sie korrigiert die Übung.

### 4. Hilfe holen

Steckst du fest, frag die KI nach einem **Hinweis** und schick ihr deinen Code und den fehlgeschlagenen Test. Sie erklärt, was nicht stimmt, ohne gleich die Lösung zu verraten.
