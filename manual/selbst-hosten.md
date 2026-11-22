# Selbst hosten

Dieses Kapitel ist für die Person, die J;DE für die Schule betreibt. Es gibt nur einen Überblick. Die Einzelheiten stehen im Projekt auf GitHub und werden hier nicht wiederholt.

## Was Sie brauchen

| Teil | Technik | Hinweis |
|---|---|---|
| Server (`backend/`) | Node.js 22 mit Hono | Bietet die Schnittstelle unter `/api` |
| Datenbank | MariaDB | Speichert Kurse, Aufgaben und Abgaben |
| Lehrer-Web (`teacher/`) | statische Webseite | Wird auf derselben Domain wie der Server bereitgestellt |
| E-Mail (SMTP) | beliebiger Mailserver | Verschickt die Anmelde-Links an Lehrkräfte |
| App (`app/`) | Electron | Wird mit der Adresse Ihres Servers gebaut |

Das Projekt ist für einen Uberspace-Account beschrieben. Domain, Absenderadresse und Server sind Einstellungen und nirgends fest eingetragen.

## Schritte im Überblick

1. **Server und Lehrer-Web einrichten.** Datenbank anlegen, Server und Lehrer-Web auf den Server bringen und die E-Mail-Einstellungen eintragen. Ohne SMTP-Einstellungen schreibt der Server die Anmelde-Links nur in sein Protokoll. Das ist nur zum Entwickeln gedacht. Die Schritte stehen in [docs/deployment.md](https://github.com/mfreimueller/jide/blob/main/docs/deployment.md).
2. **Lehrkräfte-Konto anlegen.** Ein Konto legen Sie auf dem Server mit einem Befehl an. Er steht in der [Dokumentation des Servers](https://github.com/mfreimueller/jide/blob/main/backend/README.md).
3. **App für Ihren Server bauen.** Die Adresse des Servers wird beim Bauen fest in die App eingebaut. Sie setzen dazu die Repository-Variable `JIDE_API_URL`. Die Schritte zum Bauen und Veröffentlichen der Windows-App stehen in [docs/release.md](https://github.com/mfreimueller/jide/blob/main/docs/release.md).
4. **Prüfungsordner bereitstellen.** Der Prüfungsordner entsteht in einem eigenen Arbeitsablauf. Siehe [docs/exam-mode.md](https://github.com/mfreimueller/jide/blob/main/docs/exam-mode.md).

## Lokal ausprobieren

Zum Ausprobieren auf dem eigenen Rechner gibt es einen Entwicklungsmodus mit Docker. Siehe den Abschnitt „Local development“ in der [README](https://github.com/mfreimueller/jide#local-development).

## Dieses Handbuch veröffentlichen

Das Handbuch liegt im Ordner `manual/` und ist mit VitePress gebaut. Ein Arbeitsablauf (`.github/workflows/manual.yml`) veröffentlicht es bei jeder Änderung auf GitHub Pages. Einmalig müssen Sie in den Einstellungen des Repositorys unter „Pages“ als Quelle „GitHub Actions“ wählen. Lokal sehen Sie es mit `npm run dev -w @jide/manual`.

Das Repository ist öffentlich. Tragen Sie darum nie echte Serveradressen, Zugangsdaten oder Schülerdaten in Dateien, Issues oder Pull Requests ein.
