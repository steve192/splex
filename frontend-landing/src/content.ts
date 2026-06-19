// All translatable landing copy, keyed by locale. English ("en") is served at
// "/", German ("de") at "/de/". Add a locale here + a page under src/pages and
// the components pick it up via getContent(lang).

export type Lang = "en" | "de";
export const defaultLang: Lang = "en";
export const languages: Record<Lang, string> = { en: "English", de: "Deutsch" };

export interface Feature {
  shot: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}
export interface Card {
  title: string;
  body: string;
}
export interface Content {
  meta: { title: string; description: string };
  header: { features: string; selfhost: string; login: string; githubAria: string };
  hero: {
    badge: string;
    titleA: string;
    titleB: string;
    paragraph: string;
    ctaApp: string;
    ctaPlay: string;
    subtext: string;
  };
  features: { heading: string; subheading: string; items: Feature[] };
  gallery: { heading: string; subheading: string; items: { shot: string; label: string }[] };
  selfhost: {
    eyebrow: string;
    heading: string;
    paragraph: string;
    ctaGithub: string;
    ctaTry: string;
    cards: Card[];
  };
  cta: { heading: string; paragraph: string; ctaApp: string; ctaPlay: string };
  footer: {
    product: string;
    legal: string;
    links: { features: string; selfhost: string; login: string; play: string };
    legalLinks: { tos: string; privacy: string; imprint: string };
    rights: string;
    github: string;
  };
}

const en: Content = {
  meta: {
    title: "Share expenses fairly with friends and groups.",
    description:
      "Splex is an open-source alternative to Splitwise that you can host yourself. Share expenses with friends, partners, and groups, settle up in any currency, and stay in control of your data."
  },
  header: { features: "Features", selfhost: "Self-host", login: "Log in", githubAria: "Splex on GitHub" },
  hero: {
    badge: "Open source · self-hostable",
    titleA: "Share expenses fairly",
    titleB: "with friends and groups.",
    paragraph:
      "Splex is an open-source alternative to Splitwise. Track shared costs with friends, partners, and groups, settle up in any currency, and keep your data where you want it: on your own server.",
    ctaApp: "Open the web app",
    ctaPlay: "Get it on Google Play",
    subtext: "Passwordless sign-in · installable · works offline"
  },
  features: {
    heading: "Everything that makes fair sharing simple",
    subheading: "The essentials for splitting everyday costs cleanly with the people in your life.",
    items: [
      {
        shot: "add-expense",
        eyebrow: "Expense tracking",
        title: "Split bills the way they actually happened",
        body: "Add expenses in groups or directly with a friend, then choose the split that fits the situation.",
        points: [
          "Equal, selected, exact, percentage, or custom-adjusted splits",
          "Multiple payers per expense (you cover €70, your partner €30)",
          "Multiple currencies with automatic conversion while you enter the expense",
          "Attach image or PDF receipts, optionally with a location",
          "Useful description suggestions from your history and nearby places"
        ]
      },
      {
        shot: "group-balances",
        eyebrow: "Balances & settlements",
        title: "Always know who owes whom",
        body: "Clear per-group balances and a full history show what is still open. Settling up takes just a few taps.",
        points: [
          "Current balances and history for every group",
          "Record settlements and keep balances up to date",
          "Simplified debts: fewer transfers, same final result"
        ]
      },
      {
        shot: "group-statistics",
        eyebrow: "Insights",
        title: "See where the money goes",
        body: "Statistics and a cross-group activity feed make shared spending easy to understand.",
        points: [
          "Spending breakdowns per group",
          "Ledger and balance history for each group",
          "Recent changes across all groups in one activity feed"
        ]
      },
      {
        shot: "overview",
        eyebrow: "Accounts & sharing",
        title: "Invite friends in seconds",
        body: "Passwordless sign-in and shareable invite links get people into the right group quickly.",
        points: [
          "Magic link or 6-digit code login, no password required",
          "Optional Google sign-in on web and Android",
          "Invite friends and group members with shareable links"
        ]
      }
    ]
  },
  gallery: {
    heading: "A closer look",
    subheading: "Swipe through the app: the same clean interface on web and Android.",
    items: [
      { shot: "overview", label: "Overview" },
      { shot: "group", label: "Group expenses" },
      { shot: "add-expense", label: "Add expense" },
      { shot: "group-balances", label: "Balances" },
      { shot: "group-statistics", label: "Statistics" },
      { shot: "activity", label: "Activity" }
    ]
  },
  selfhost: {
    eyebrow: "Open source",
    heading: "Self-hosted, with your data in your hands",
    paragraph:
      "Splex is open source and runs in a single container. Read the code, host it yourself, or contribute.",
    ctaGithub: "View on GitHub",
    ctaTry: "Try it now",
    cards: [
      {
        title: "Your server, your data",
        body: "Run Splex in a single container. Nothing is shared with third parties, and you decide where the database lives."
      },
      {
        title: "Privacy by design",
        body: "Configure automatic deletion for inactive accounts. The anonymous demo mode runs entirely in the browser."
      },
      {
        title: "Install anywhere",
        body: "Install Splex as a PWA on your devices, or get the native Android app from Google Play."
      },
      {
        title: "Works offline",
        body: "Add and review expenses even without a connection. Changes sync automatically once you're back online."
      },
      {
        title: "Stays in sync",
        body: "Web push and Expo push notifications keep everyone up to date when expenses change or it's time to settle."
      }
    ]
  },
  cta: {
    heading: "Start sharing expenses fairly",
    paragraph: "Open the web app or install Splex on your phone in a few seconds.",
    ctaApp: "Open the web app",
    ctaPlay: "Get it on Google Play"
  },
  footer: {
    product: "Product",
    legal: "Legal",
    links: { features: "Features", selfhost: "Self-host", login: "Log in", play: "Google Play" },
    legalLinks: { tos: "Terms of Service", privacy: "Privacy Policy", imprint: "Imprint" },
    rights: "Open source.",
    github: "GitHub"
  }
};

const de: Content = {
  meta: {
    title: "Ausgaben mit Freunden und Gruppen fair teilen.",
    description:
      "Splex ist eine Open-Source-Alternative zu Splitwise, die du selbst hosten kannst. Teile Ausgaben mit Freunden, Partnern und Gruppen, rechne in jeder Währung ab und behalte die Kontrolle über deine Daten."
  },
  header: {
    features: "Funktionen",
    selfhost: "Selbst hosten",
    login: "Anmelden",
    githubAria: "Splex auf GitHub"
  },
  hero: {
    badge: "Open Source · selbst hostbar",
    titleA: "Ausgaben fair teilen",
    titleB: "mit Freunden und Gruppen.",
    paragraph:
      "Splex ist eine Open-Source-Alternative zu Splitwise. Teile Kosten mit Freunden, Partnern und Gruppen, rechne in jeder Währung ab und behalte deine Daten dort, wo du sie haben willst: auf deinem eigenen Server.",
    ctaApp: "Web-App öffnen",
    ctaPlay: "Bei Google Play laden",
    subtext: "Ohne Passwort anmelden · installierbar · offline nutzbar"
  },
  features: {
    heading: "Alles, was faires Teilen einfach macht",
    subheading:
      "Alles, was du brauchst, um gemeinsame Kosten im Alltag sauber aufzuteilen.",
    items: [
      {
        shot: "add-expense",
        eyebrow: "Ausgaben erfassen",
        title: "Rechnungen so teilen, wie es wirklich passt",
        body: "Erfasse Ausgaben in Gruppen oder direkt mit Freunden und wähle die Aufteilung, die zur Situation passt.",
        points: [
          "Gleichmäßig, nur unter Ausgewählten, exakt, prozentual oder mit individuellen Anpassungen",
          "Mehrere Zahler pro Ausgabe (du zahlst 70 €, dein Partner 30 €)",
          "Mehrere Währungen mit automatischer Umrechnung beim Erfassen",
          "Belege als Bilder oder PDFs anhängen, optional mit Standort",
          "Passende Beschreibungsvorschläge aus deinem Verlauf und deiner Umgebung"
        ]
      },
      {
        shot: "group-balances",
        eyebrow: "Salden & Ausgleich",
        title: "Immer wissen, wer wem etwas schuldet",
        body: "Klare Salden pro Gruppe und ein vollständiger Verlauf zeigen jederzeit, was offen ist. Ausgleichen geht mit wenigen Taps.",
        points: [
          "Aktuelle Salden und Verlauf für jede Gruppe",
          "Ausgleichszahlungen erfassen und Salden aktuell halten",
          "Vereinfachte Schulden: weniger Überweisungen, gleiche Ergebnisse"
        ]
      },
      {
        shot: "group-statistics",
        eyebrow: "Einblicke",
        title: "Sehen, wohin das Geld fließt",
        body: "Statistiken und ein gruppenübergreifender Aktivitätsverlauf machen gemeinsame Ausgaben nachvollziehbar.",
        points: [
          "Aufschlüsselung der Ausgaben pro Gruppe",
          "Verlauf von Buchungen und Salden pro Gruppe",
          "Alle Änderungen gruppenübergreifend im Blick"
        ]
      },
      {
        shot: "overview",
        eyebrow: "Konten & Teilen",
        title: "Freunde in Sekunden einladen",
        body: "Passwortlose Anmeldung und teilbare Einladungslinks bringen deine Freunde schnell in die richtige Gruppe.",
        points: [
          "Magic Link oder 6-stelliger Code statt Passwort",
          "Optionale Google-Anmeldung im Web und auf Android",
          "Freunde und Gruppenmitglieder per Link einladen"
        ]
      }
    ]
  },
  gallery: {
    heading: "Ein genauerer Blick",
    subheading: "Wische durch die App: dieselbe klare Oberfläche im Web und auf Android.",
    items: [
      { shot: "overview", label: "Übersicht" },
      { shot: "group", label: "Gruppenausgaben" },
      { shot: "add-expense", label: "Ausgabe hinzufügen" },
      { shot: "group-balances", label: "Salden" },
      { shot: "group-statistics", label: "Statistiken" },
      { shot: "activity", label: "Aktivität" }
    ]
  },
  selfhost: {
    eyebrow: "Open Source",
    heading: "Selbst gehostet, deine Daten in deiner Hand",
    paragraph:
      "Splex ist Open Source und läuft in einem einzigen Container. Sieh dir den Code an, hoste Splex selbst oder trage zum Projekt bei.",
    ctaGithub: "Auf GitHub ansehen",
    ctaTry: "Jetzt ausprobieren",
    cards: [
      {
        title: "Dein Server, deine Daten",
        body: "Betreibe Splex in einem einzigen Container. Es wird nichts an Dritte weitergegeben, und du entscheidest, wo die Datenbank liegt."
      },
      {
        title: "Datenschutz von Grund auf",
        body: "Automatisches Löschen inaktiver Konten lässt sich konfigurieren. Der anonyme Demo-Modus läuft komplett im Browser."
      },
      {
        title: "Überall installieren",
        body: "Installiere Splex als PWA auf deinen Geräten oder lade die native Android-App bei Google Play."
      },
      {
        title: "Offline nutzbar",
        body: "Erfasse Ausgaben und sieh sie dir auch ohne Verbindung an. Änderungen werden automatisch synchronisiert, sobald du wieder online bist."
      },
      {
        title: "Immer synchron",
        body: "Web-Push und Expo-Push halten alle auf dem Laufenden, wenn sich Ausgaben ändern oder abgerechnet werden sollte."
      }
    ]
  },
  cta: {
    heading: "Starte jetzt mit fair geteilten Ausgaben",
    paragraph: "Öffne die Web-App oder installiere Splex in wenigen Sekunden auf deinem Handy.",
    ctaApp: "Web-App öffnen",
    ctaPlay: "Bei Google Play laden"
  },
  footer: {
    product: "Produkt",
    legal: "Rechtliches",
    links: { features: "Funktionen", selfhost: "Selbst hosten", login: "Anmelden", play: "Google Play" },
    legalLinks: { tos: "Nutzungsbedingungen", privacy: "Datenschutz", imprint: "Impressum" },
    rights: "Open Source.",
    github: "GitHub"
  }
};

export const content: Record<Lang, Content> = { en, de };

export function getContent(lang: Lang): Content {
  return content[lang] ?? content[defaultLang];
}

/** Root path a locale is served from: English at "/", German at "/de/". */
export function localePath(lang: Lang): string {
  return lang === "de" ? "/de/" : "/";
}
