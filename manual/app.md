# Die App für Schüler:innen

Dieses Kapitel zeigt, was Ihre Schüler:innen in der App erleben. Sie können es als Anleitung für die erste Stunde verwenden.

![Die App mit Angabe, Editor und Tests](/images/screenshot-student-app.png)

## Installieren

Die App läuft unter **Windows und Linux**. Die Anleitung für Linux steht weiter unten.

### Windows

1. Öffnen Sie die [Seite der Programmversionen](https://github.com/mfreimueller/jide/releases) und laden Sie die neueste Datei `JDE-Setup-<Version>.exe` herunter.
2. Starten Sie die Datei. Die Installation gilt nur für die eigene Person. Es sind **keine Administratorrechte** nötig.
3. Windows warnt eventuell, weil die App nicht signiert ist (SmartScreen: „More info“ → „Run anyway“, in der deutschen Oberfläche die entsprechenden Einträge).
4. Danach gibt es Verknüpfungen mit dem Namen „J;DE“.

Java muss nicht installiert werden. Die App bringt es mit.

### Linux

Unterstützt sind Debian 12 und 13 sowie Ubuntu 22.04 und 24.04, jeweils mit einem 64-Bit-Prozessor (x64). Die App kommt als AppImage. Es gibt keine Installation mit Administratorrechten. Nur zwei Schritte brauchen einmalig `sudo` (siehe unten).

1. Öffnen Sie die [Seite der Programmversionen](https://github.com/mfreimueller/jide/releases) und laden Sie die neueste Datei `JDE-<Version>.AppImage` herunter. Das ist dieselbe Seite wie beim Windows-Installer.
2. Legen Sie den Ordner `~/Applications` an und speichern Sie die Datei dort unter dem festen Namen `JDE.AppImage`:

   ```bash
   mkdir -p ~/Applications
   mv ~/Downloads/JDE-<Version>.AppImage ~/Applications/JDE.AppImage
   ```

   Der Name ist fest und enthält keine Versionsnummer. So ersetzt ein Update die Datei an Ort und Stelle. Der Ordner bleibt derselbe, und die Registrierung für Übungs-Links (siehe unten) funktioniert weiter.
3. Machen Sie die Datei ausführbar:

   ```bash
   chmod +x ~/Applications/JDE.AppImage
   ```

4. Installieren Sie das Paket FUSE 2. Ein AppImage braucht es zum Starten. Der Paketname hängt von der Version ab:

   | System | Befehl |
   |---|---|
   | Ubuntu 22.04 | `sudo apt install libfuse2` |
   | Ubuntu 24.04 | `sudo apt install libfuse2t64` |
   | Debian 12 | `sudo apt install libfuse2` |
   | Debian 13 | `sudo apt install libfuse2t64` |

5. **Nur Ubuntu 24.04:** Richten Sie einmalig ein AppArmor-Profil ein. Ubuntu 24.04 schränkt sogenannte unprivilegierte User Namespaces ein. Die Schutzfunktion (Sandbox) der App braucht sie. Das Profil erlaubt sie für J;DE. Es muss unter dem festen Pfad liegen, den Schritt 2 festlegt. Die Datei `/etc/apparmor.d/jde` bekommt diesen Inhalt:

   <!-- verify on a real Ubuntu 24.04 (T68) -->
   ```
   abi <abi/4.0>,
   include <tunables/global>

   profile jde /home/*/Applications/JDE.AppImage flags=(unconfined) {
     userns,
   }
   ```

   Dazu öffnen Sie im Terminal einen Editor mit Administratorrechten, zum Beispiel `sudo nano /etc/apparmor.d/jde`, fügen den Text ein und speichern. Danach laden Sie das Profil:

   ```bash
   sudo apparmor_parser -r /etc/apparmor.d/jde
   ```

   Das ist nur einmal nötig. Auf Debian und auf Ubuntu 22.04 entfällt dieser Schritt.

6. Starten Sie die App im Terminal mit `~/Applications/JDE.AppImage` oder aus dem Dateimanager.

Beim ersten Start melden sich die Schüler:innen mit dem persönlichen Code an, genau wie unter Windows (siehe nächster Abschnitt). Die App trägt sich dabei selbst als Programm für `jide://`-Links ein. Ein Klick auf einen [Übungs-Link](/uebungs-links) im Browser öffnet dann J;DE. Updates installieren sich von selbst, wie unter Windows (siehe [Updates](#updates)).

**Wenn die App nicht startet:**

- Ist das FUSE-Paket aus Schritt 4 installiert?
- Auf Ubuntu 24.04: Wurde das AppArmor-Profil aus Schritt 5 geladen, und liegt die Datei genau unter `~/Applications/JDE.AppImage`?
- Starten Sie die App in einem Terminal mit `~/Applications/JDE.AppImage`. Dort erscheint die Fehlermeldung. Diese Meldung hilft bei der Suche nach der Ursache.

## Erster Start mit dem persönlichen Code

Beim ersten Start sieht die Person die Seite „Willkommen!“.

1. Unter „Dein Code“ den Code vom Zettel eintippen oder einfügen. Er hat acht Zeichen. Groß- und Kleinschreibung und der Bindestrich sind egal.
2. „Anmelden“ klicken.

Das muss man **nur einmal** machen. Der Code funktioniert auch auf mehreren Laptops. Wer den Zettel verliert, fragt die Lehrkraft nach einem neuen Code (siehe [Code zurücksetzen](/schueler#code-zurucksetzen)).

Auf der Anmeldeseite gibt es außerdem „Ohne Code: Scratch öffnen“. In Scratch schreiben Schüler:innen eigene Programme. Sie bleiben nur auf diesem Laptop und werden nicht abgegeben.

## Meine Aufgaben

Nach der Anmeldung zeigt die App „Meine Aufgaben“. Oben stehen der Kurs, zum Beispiel „POS · 1AHIF“, und der Name der Person. „Verbunden“ oder „Offline“ zeigt, ob der Server erreichbar ist. Offline sieht man die zuletzt geladenen Aufgaben.

Jede Aufgabe zeigt:

- den Titel, bei gesetzter Schwierigkeit „Pflicht“, „Advanced“ oder „Pro“
- die Frist, zum Beispiel „bis 15.01.2027“
- einen Status: „Neu“, „In Arbeit“, „Abgegeben“, „Abgegeben · verspätet“ oder „Frist vorbei · Abgabe noch möglich“
- bei einer Beurteilung das Symbol
- einen Knopf „Öffnen“, „Weiterarbeiten“ oder „Ansehen“

Aufgaben in Gruppen stehen unter dem Namen der Gruppe. Alle ohne Gruppe stehen unter „Weitere Übungen“.

## Arbeiten an einer Aufgabe

- Links steht die Liste „Dateien“, in der Mitte der Editor und rechts die **Angabe**. Unten gibt es die Reiter „Konsole“, „Probleme“ und „Tests“.
- Der Code wird **automatisch gespeichert** und nach kurzer Pause geprüft. Fehler erscheinen als rote und gelbe Wellenlinien und in der Liste „Probleme“.
- „▶ Ausführen“ startet das Programm in der Konsole. Eingaben mit `Scanner` tippt man direkt in die Konsole. „■ Stopp“ beendet das Programm. Die Taste F5 startet es ebenfalls.
- „✓ Testen“ führt Ihre Tests aus. Das gibt es nur bei Aufgaben mit Tests. Die Tastenkombination ist Umschalt+F5. Bestehen alle Tests, steht dort „Dein Code sieht richtig aus!“.
- Mit dem Symbol ⧉ in der Kopfzeile eines Bereichs öffnet man ihn in einem eigenen Fenster.

## Abgeben

1. Auf „Abgeben“ klicken.
2. Waren die Tests nicht erfolgreich oder noch nicht ausgeführt, fragt die App nach: „Wirklich abgeben?“ Mit „Weiterarbeiten“ geht man zurück, mit „Trotzdem abgeben“ gibt man ab.
3. Danach heißt der Knopf „Erneut abgeben“.

Man darf mehrmals abgeben. **Es zählt die letzte Abgabe.** Nach der Frist ist die Abgabe noch möglich, sie wird aber als „verspätet“ markiert. Nach der Beurteilung ist die Aufgabe gesperrt.

## Ausblenden

Erledigte Aufgaben lassen sich aus der Liste ausblenden. Im Menü „⋯“ der Aufgabe steht „Ausblenden“. Das geht erst nach der Abgabe oder nach der Frist. Beurteilte Aufgaben wandern sieben Tage nach der Beurteilung von selbst in den Bereich „Ausgeblendet“. Mit „Wieder anzeigen“ holt man sie zurück. Das Ausblenden betrifft nur diesen Laptop.

## Scratch und Übungen

Der Bereich „Scratch“ am Ende der Liste enthält eigene Programme („+ Neues Programm“). Über „Aufgabe importieren …“ lässt sich ein Aufgabenordner oder eine ZIP-Datei laden. Im Menü „⋯“ einer Aufgabe kopiert „In Scratch kopieren …“ sie zum Üben, ohne Abgabe. Auch [Übungs-Links](/uebungs-links) landen hier.

## Updates

Die installierte App aktualisiert sich **von selbst**, unter Windows und unter Linux. Sie prüft beim Start, ob es eine neue Version gibt, lädt sie im Hintergrund und installiert sie, wenn die Person die App beendet. Die Schüler:innen müssen nichts tun und sehen nichts davon. Im Prüfungsmodus gibt es keine Updates.
