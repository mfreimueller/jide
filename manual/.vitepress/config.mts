import { defineConfig } from 'vitepress';

const repo = 'https://github.com/mfreimueller/jide';

export default defineConfig({
  lang: 'de-AT',
  title: 'J;DE Handbuch',
  description: 'Handbuch für Lehrkräfte: Kurse, Aufgaben, Abgaben und Prüfungsmodus mit J;DE.',
  base: '/jide/',
  cleanUrls: true,
  head: [['link', { rel: 'icon', href: '/jide/icon.svg' }]],
  themeConfig: {
    logo: '/icon.svg',
    nav: [
      { text: 'Überblick', link: '/ueberblick' },
      { text: 'GitHub', link: repo }
    ],
    sidebar: [
      {
        text: 'Erste Schritte',
        items: [
          { text: 'Überblick', link: '/ueberblick' },
          { text: 'Anmelden im Lehrer-Web', link: '/anmelden' }
        ]
      },
      {
        text: 'Unterrichten mit J;DE',
        items: [
          { text: 'Kurse anlegen und archivieren', link: '/kurse' },
          { text: 'Schüler:innen und Codezettel', link: '/schueler' },
          { text: 'Aufgaben', link: '/aufgaben' },
          { text: 'Abgaben und Bewertung', link: '/abgaben' },
          { text: 'Übungs-Links von der Kursseite', link: '/uebungs-links' },
          { text: 'Prüfungsmodus', link: '/pruefungsmodus' }
        ]
      },
      {
        text: 'Mehr',
        items: [
          { text: 'Die App für Schüler:innen', link: '/app' },
          { text: 'Selbst hosten', link: '/selbst-hosten' }
        ]
      }
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'Suchen', buttonAriaLabel: 'Suchen' },
          modal: {
            displayDetails: 'Details anzeigen',
            resetButtonTitle: 'Suche zurücksetzen',
            backButtonTitle: 'Suche schließen',
            noResultsText: 'Keine Ergebnisse für',
            footer: { selectText: 'auswählen', navigateText: 'navigieren', closeText: 'schließen' }
          }
        }
      }
    },
    outline: { label: 'Auf dieser Seite' },
    docFooter: { prev: 'Zurück', next: 'Weiter' },
    darkModeSwitchLabel: 'Design',
    sidebarMenuLabel: 'Menü',
    returnToTopLabel: 'Nach oben'
  }
});
