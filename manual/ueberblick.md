# Überblick

J;DE besteht aus drei Teilen. Sie arbeiten mit dem Lehrer-Web. Die Schüler:innen arbeiten mit der App.

| Teil | Wer benutzt es? | Wofür? |
|---|---|---|
| **App** | Schüler:innen | Aufgaben öffnen, Java schreiben, starten, testen, abgeben |
| **Lehrer-Web** | Lehrkräfte | Kurse, Schüler:innen, Aufgaben, Abgaben, Beurteilungen |
| **Server** | niemand direkt | Speichert Kurse, Aufgaben und Abgaben. App und Lehrer-Web sprechen mit ihm |

Den Server betreibt in der Regel eine Person für die ganze Schule. Wenn das bei Ihnen schon erledigt ist, brauchen Sie nur die Adresse des Lehrer-Webs. Sonst lesen Sie [Selbst hosten](/selbst-hosten).

## Online-Modus

Der Online-Modus ist der Normalfall im Unterricht.

- Die Schüler:innen installieren die App auf ihrem Laptop. Siehe [Die App für Schüler:innen](/app).
- Jede Person meldet sich einmal mit einem **persönlichen Code** an. Den bekommt sie auf einem Zettel von Ihnen. Siehe [Schüler:innen und Codezettel](/schueler).
- Die App zeigt nur die Aufgaben, die Sie für den Kurs freigeschaltet haben.
- Mit „Abgeben“ lädt die App den Code zum Server. Der Server speichert die Uhrzeit. Sie sehen die Abgabe sofort im Lehrer-Web.

## Prüfungsmodus

Der Prüfungsmodus ist für Schularbeiten und Tests.

- Es ist dieselbe App. Sie startet vom Angabelaufwerk, ohne Installation.
- Sie braucht kein Internet und verbindet sich nie mit dem Server.
- Die Schüler:innen geben ihren Namen ein. Die Aufgaben liegen als Ordner neben der App.
- Die Abgabe wird auf das Laufwerk der Schüler:innen kopiert (üblicherweise `P:`).

|  | Online-Modus | Prüfungsmodus |
|---|---|---|
| Läuft auf | Laptops der Schüler:innen | Prüfungs-PCs der Schule |
| Anmeldung | Persönlicher Code | Name wird beim Start eingegeben |
| Aufgaben von | Server (von Ihnen freigeschaltet) | Ordner `exercises` neben der App |
| „Testen“ | ja | ja, wenn Sie es erlauben |
| „Abgeben“ | Upload zum Server | Kopie auf das Abgabelaufwerk |
| Updates | automatisch | nie |

Mehr dazu im Kapitel [Prüfungsmodus](/pruefungsmodus).

## Was J;DE nicht ist

- Die Tests sind **keine Beurteilung**. Schüler:innen führen sie selbst aus und könnten sie auch lesen. Sie sind Rückmeldung für die Schüler:innen.
- Auf dem Server wird nie Schülercode ausgeführt.
- J;DE ist eine Entwicklungsumgebung für Java-Einsteiger:innen, vor allem für den 1. Jahrgang Informatik an HTLs. Es ist bewusst klein gehalten.
