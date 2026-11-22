# Übungs-Links von der Kursseite

Auf der Website Ihres Kurses können Sie Übungen anbieten, die sich mit **einem Klick** in J;DE öffnen. Das ist gedacht für freiwillige Übungen zum Selbststudium.

Ein Übungs-Link hat folgende Eigenschaften:

- Die Übung hat Tests.
- Es gibt **keine Abgabe**, keine Frist und keine Beurteilung.
- Es wird **nichts erfasst oder gesendet**. Sie sehen nicht, wer geübt hat.
- Die Übung landet im Bereich „Scratch“ der App, also nur auf dem Laptop der Schüler:innen. Sie trägt immer das Schild „Übung“, egal welches `kind` in der `exercise.yaml` steht.

## Der Link

Der Link hat dieses Format:

```
jide://practice?src=<Adresse der ZIP-Datei>
```

`src` ist die vollständige `https`-Adresse einer ZIP-Datei, zum Beispiel `https://kurs.example.org/practice/schleifen.zip`. Auf Ihrer Kursseite machen Sie daraus einen Knopf oder Link mit diesem Ziel.

Klickt jemand darauf, passiert Folgendes:

1. J;DE startet. Läuft J;DE schon, bekommt die laufende App den Link und kommt in den Vordergrund.
2. J;DE lädt die ZIP-Datei herunter und legt sie als Übung im Bereich „Scratch“ an.
3. Die Übung öffnet sich.

Klickt dieselbe Person später wieder auf denselben Link, öffnet sich ihre **vorhandene Kopie**. Es wird nichts neu geladen und keine zweite Kopie angelegt. Wollen Sie die Übung für die Schüler:innen aktualisieren, müssen diese die Kopie in „Scratch“ löschen und den Link noch einmal anklicken.

::: tip Hinweis für Ihre Seite
Wer J;DE noch nicht installiert hat, kann mit dem Link nichts anfangen. Schreiben Sie deshalb neben den Knopf einen Hinweis wie „J;DE noch nicht installiert? → Download“. Er verweist auf die [Seite der Programmversionen](https://github.com/mfreimueller/jide/releases).
:::

## Die ZIP-Datei

Die ZIP-Datei hat **dasselbe Format wie ein Scratch-Import** in der App. Das ist auch das Format einer hochgeladenen Aufgabe (siehe [Aufgaben](/aufgaben)):

- `exercise.yaml`, `aufgabe.md` und `files/`, dazu optional `tests.yaml`
- die Dateien liegen direkt im Stamm der ZIP-Datei oder in einem einzigen Ordner
- höchstens 10 MB
- ein altes Feld `difficulty` in der `exercise.yaml` schadet hier nicht, es wird ignoriert (anders als beim Hochladen und beim Import in Scratch)

Ist die Datei kein gültiges Aufgabenpaket, zeigt die App eine deutsche Fehlermeldung. Prüfen Sie ein Paket am einfachsten selbst: Importieren Sie es in der App unter „Scratch“ → „Aufgabe importieren …“ → „ZIP-Datei wählen …“.

## Erlaubte Server pro Kurs

J;DE lädt nur ZIP-Dateien von Servern, die Sie für den Kurs erlaubt haben. Das stellen Sie **pro Kurs** im Lehrer-Web ein.

1. Wählen Sie den Kurs und öffnen Sie links in der Navigation „Einstellungen“ (unter „Aufgaben“).
2. Im Abschnitt „Übungs-Links“ steht die Liste der erlaubten Hosts.
3. Geben Sie im Feld „Host hinzufügen“ den Host-Namen ein, zum Beispiel `die-spengergasse.github.io`, und klicken Sie auf „Hinzufügen“ (oder drücken Sie die Eingabetaste).
4. Mit „Entfernen“ nehmen Sie einen Host wieder aus der Liste.

Die Änderung wird sofort gespeichert.

![Einstellungen mit Host-Liste. Unten zeigt das Feld die Fehlermeldung für eine ungültige Eingabe.](/images/einstellungen.png)

Die Regeln:

- Tragen Sie nur den **Host-Namen** ein. Fügen Sie eine ganze https-Adresse ein, wird sie auf den Host-Namen gekürzt.
- Erlaubt ist **jede `https`-Adresse, die auf `.zip` endet**, auf einem eingetragenen Host. Ein bestimmter Pfad ist nicht nötig.
- Der Host muss **genau** übereinstimmen. Mit `die-spengergasse.github.io` sind Unterdomains wie `a.die-spengergasse.github.io` nicht erlaubt.
- Sie können mehrere Hosts eintragen, höchstens 20.
- Es gibt **keinen voreingestellten Host**. Solange kein Host eingetragen ist, funktioniert kein Übungs-Link.

## Voraussetzungen für Schüler:innen

- Die App muss im **Online-Modus** laufen, und die Person muss **angemeldet** sein. Ohne Anmeldung zeigt die App einen Hinweis und lädt nichts. Der Grund: Die App erfährt die erlaubten Hosts von ihrem Kurs.
- Sie brauchen eine Internetverbindung.
- Im [Prüfungsmodus](/pruefungsmodus) werden Übungs-Links ignoriert. Die App zeigt nur einen kurzen Hinweis.
