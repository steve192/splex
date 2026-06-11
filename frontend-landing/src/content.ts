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
    title: "Split shared expenses with friends and groups.",
    description:
      "Splex is an open-source, self-hostable alternative to Splitwise. Split expenses with friends, partners and groups, settle up in any currency, and keep full control of your data."
  },
  header: { features: "Features", selfhost: "Self-host", login: "Log in", githubAria: "Splex on GitHub" },
  hero: {
    badge: "Open source · self-hostable",
    titleA: "Split shared expenses",
    titleB: "with friends and groups.",
    paragraph:
      "Splex is an open-source alternative to Splitwise. Split costs with friends, partners and groups, settle up in any currency, and keep full ownership of your data - on your own server.",
    ctaApp: "Open the web app",
    ctaPlay: "Get it on Google Play",
    subtext: "Passwordless sign-in · installable · works offline"
  },
  features: {
    heading: "Everything you need to split fairly",
    subheading: "The features that matter most for splitting costs with the people in your life.",
    items: [
      {
        shot: "add-expense",
        eyebrow: "Expense tracking",
        title: "Every way to split a bill",
        body: "Add expenses in groups or one-to-one with a friend, with the split method that actually matches reality.",
        points: [
          "Equal, selected-equal, exact, percentage and adjusted-equal splits",
          "Multiple payers per expense (you cover €70, your partner €30)",
          "Multi-currency with automatic conversion at entry time",
          "Attach receipts (images or PDFs) and an optional location",
          "Description suggestions from your nearby expense history"
        ]
      },
      {
        shot: "group-balances",
        eyebrow: "Balances & settlements",
        title: "Always know who owes whom",
        body: "Per-group balances and a full ledger keep everyone honest, and settling up clears debts in a couple of taps.",
        points: [
          "Live per-group balance and ledger views",
          "Manual and automatic write-off settlements",
          "Simplified debts so fewer payments clear more balances"
        ]
      },
      {
        shot: "group-statistics",
        eyebrow: "Insights",
        title: "See where the money goes",
        body: "Group statistics and a cross-group activity feed turn a pile of expenses into something you can actually read.",
        points: [
          "Spending breakdowns per group",
          "Per-group ledger and balance history",
          "Activity feed of recent changes across all your groups"
        ]
      },
      {
        shot: "overview",
        eyebrow: "Accounts & sharing",
        title: "Invite anyone in seconds",
        body: "Passwordless sign-in and shareable invite links mean your friends are in the group before the round is over.",
        points: [
          "Magic-link / 6-digit code login - no passwords",
          "Optional Google sign-in on web and Android",
          "Invite friends and group members with shareable links"
        ]
      }
    ]
  },
  gallery: {
    heading: "A closer look",
    subheading: "Swipe through the app - same clean interface on web and Android.",
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
    heading: "Self-hosted, and yours to own",
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
        body: "Configurable auto-deletion of inactive accounts, and an anonymous demo mode that runs entirely in the browser."
      },
      {
        title: "Install anywhere",
        body: "Use it as an installable PWA on any device, or grab the native Android app from Google Play."
      },
      {
        title: "Works offline",
        body: "Keep adding and viewing expenses with no connection - changes sync automatically once you're back online."
      },
      {
        title: "Stays in sync",
        body: "Web push and Expo push notifications keep everyone up to date when expenses change or it's time to settle."
      }
    ]
  },
  cta: {
    heading: "Start splitting fairly today",
    paragraph: "Open the web app right now, or install it on your phone in seconds.",
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
    title: "Geteilte Ausgaben mit Freunden und Gruppen abrechnen.",
    description:
      "Splex ist eine opensource, selbst hostbare Alternative zu Splitwise. Teile Ausgaben mit Freunden, Partnern und Gruppen, rechne in jeder Währung ab und behalte die volle Kontrolle über deine Daten."
  },
  header: {
    features: "Funktionen",
    selfhost: "Selbst hosten",
    login: "Anmelden",
    githubAria: "Splex auf GitHub"
  },
  hero: {
    badge: "Opensource · selbst hostbar",
    titleA: "Geteilte Ausgaben abrechnen",
    titleB: "mit Freunden und Gruppen.",
    paragraph:
      "Splex ist eine opensource Alternative zu Splitwise. Teile Kosten mit Freunden, Partnern und Gruppen, rechne in jeder Währung ab und behalte die volle Hoheit über deine Daten - auf deinem eigenen Server.",
    ctaApp: "Web-App öffnen",
    ctaPlay: "Bei Google Play laden",
    subtext: "Anmeldung ohne Passwort · installierbar · offline nutzbar"
  },
  features: {
    heading: "Alles, um fair zu teilen",
    subheading:
      "Die Funktionen, die beim Teilen von Kosten mit den Menschen in deinem Leben wirklich zählen.",
    items: [
      {
        shot: "add-expense",
        eyebrow: "Ausgaben erfassen",
        title: "Jede Art, eine Rechnung zu teilen",
        body: "Erfasse Ausgaben in Gruppen oder eins-zu-eins mit Freunden - mit der Aufteilung, die zur Realität passt.",
        points: [
          "Gleich, gleich unter Ausgewählten, exakt, prozentual und angepasst-gleich",
          "Mehrere Zahler pro Ausgabe (du zahlst 70 €, dein Partner 30 €)",
          "Mehrere Währungen mit automatischer Umrechnung bei der Eingabe",
          "Belege anhängen (Bilder oder PDFs) und optional einen Ort",
          "Beschreibungsvorschläge aus deinem Verlauf in der Nähe"
        ]
      },
      {
        shot: "group-balances",
        eyebrow: "Salden & Ausgleich",
        title: "Immer wissen, wer wem etwas schuldet",
        body: "Salden pro Gruppe und ein vollständiger Buchungsverlauf behalten den Überblick, und der Ausgleich begleicht Schulden mit wenigen Taps.",
        points: [
          "Live-Salden und Buchungsverlauf pro Gruppe",
          "Manueller und automatischer Schuldenausgleich",
          "Vereinfachte Schulden: weniger Zahlungen begleichen mehr Salden"
        ]
      },
      {
        shot: "group-statistics",
        eyebrow: "Einblicke",
        title: "Sehen, wohin das Geld fließt",
        body: "Gruppenstatistiken und ein gruppenübergreifender Aktivitätsverlauf machen aus einem Berg von Ausgaben etwas Lesbares.",
        points: [
          "Ausgaben-Aufschlüsselung pro Gruppe",
          "Buchungs- und Saldenverlauf pro Gruppe",
          "Aktivitätsverlauf aller Änderungen über alle Gruppen"
        ]
      },
      {
        shot: "overview",
        eyebrow: "Konten & Teilen",
        title: "Lade jeden in Sekunden ein",
        body: "Anmeldung ohne Passwort und teilbare Einladungslinks - deine Freunde sind in der Gruppe, bevor die Runde vorbei ist.",
        points: [
          "Magic-Link / 6-stelliger Code - keine Passwörter",
          "Optionale Google-Anmeldung im Web und auf Android",
          "Lade Freunde und Mitglieder mit teilbaren Links ein"
        ]
      }
    ]
  },
  gallery: {
    heading: "Ein genauerer Blick",
    subheading: "Wische durch die App - dieselbe klare Oberfläche im Web und auf Android.",
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
    eyebrow: "Opensource",
    heading: "Selbst gehostet, ganz in deiner Hand",
    paragraph:
      "Splex ist opensource und läuft in einem einzigen Container. Sieh dir den Code an, hoste Splex selbst oder trage zum Projekt bei.",
    ctaGithub: "Auf GitHub ansehen",
    ctaTry: "Jetzt ausprobieren",
    cards: [
      {
        title: "Dein Server, deine Daten",
        body: "Betreibe Splex in einem einzigen Container. Nichts wird mit Dritten geteilt, und du entscheidest, wo die Datenbank liegt."
      },
      {
        title: "Datenschutz von Grund auf",
        body: "Konfigurierbares automatisches Löschen inaktiver Konten und ein anonymer Demo-Modus, der komplett im Browser läuft."
      },
      {
        title: "Überall installieren",
        body: "Installiere Splex als PWA auf jedem Gerät oder lade die native Android-App bei Google Play."
      },
      {
        title: "Offline nutzbar",
        body: "Erfasse und sieh Ausgaben auch ohne Verbindung - Änderungen synchronisieren automatisch, sobald du wieder online bist."
      },
      {
        title: "Immer synchron",
        body: "Web-Push und Expo-Push halten alle auf dem Laufenden, wenn sich Ausgaben ändern oder es Zeit zum Abrechnen ist."
      }
    ]
  },
  cta: {
    heading: "Fang heute an, fair zu teilen",
    paragraph: "Öffne jetzt die Web-App oder installiere sie in Sekunden auf deinem Handy.",
    ctaApp: "Web-App öffnen",
    ctaPlay: "Bei Google Play laden"
  },
  footer: {
    product: "Produkt",
    legal: "Rechtliches",
    links: { features: "Funktionen", selfhost: "Selbst hosten", login: "Anmelden", play: "Google Play" },
    legalLinks: { tos: "Nutzungsbedingungen", privacy: "Datenschutz", imprint: "Impressum" },
    rights: "Opensource.",
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
