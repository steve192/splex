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
  header: { features: string; guides: string; documentation: string; selfhost: string; login: string; githubAria: string };
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
    ctaGuide: string;
    ctaTry: string;
    cards: Card[];
  };
  cta: { heading: string; paragraph: string; ctaApp: string; ctaPlay: string };
  footer: {
    product: string;
    legal: string;
    guides: string;
    documentation: string;
    links: { features: string; guides: string; documentation: string; selfhost: string; glossary: string; login: string; play: string };
    legalLinks: { tos: string; privacy: string; imprint: string };
    rights: string;
    github: string;
  };
}

const en: Content = {
  meta: {
    title: "Share expenses fairly with friends and groups.",
    description:
      "Splex is an open-source Splitwise alternative for shared expenses, multiple currencies, settlements, and self-hosted installs."
  },
  header: {
    features: "Features",
    guides: "Guides",
    documentation: "Documentation",
    selfhost: "Self-host",
    login: "Log in",
    githubAria: "Splex on GitHub"
  },
  hero: {
    badge: "Open source · self-hostable",
    titleA: "Share expenses fairly",
    titleB: "with friends and groups.",
    paragraph:
      "Splex is an open-source alternative to Splitwise. Track shared costs with friends, partners, and groups, use multiple currencies, and run it on your own server if you want to self-host.",
    ctaApp: "Open the web app",
    ctaPlay: "Get it on Google Play",
    subtext: "Passwordless sign-in · installable · offline expense entry"
  },
  features: {
    heading: "The expense details people usually argue about later",
    subheading:
      "Splex focuses on the parts that make balances understandable: who paid, who was included, which currency was used, and what changed.",
    items: [
      {
        shot: "add-expense",
        eyebrow: "Expense tracking",
        title: "Record the split, not just the total",
        body: "Add expenses in a group or directly with a friend, then choose the split that matches the bill.",
        points: [
          "Equal, selected, exact, percentage, or custom-adjusted splits",
          "Multiple payers per expense (you cover €70, your partner €30)",
          "Multiple currencies with conversion for the balance",
          "Attach image or PDF receipts, optionally with a location",
          "Description suggestions from your own nearby expense history"
        ]
      },
      {
        shot: "calculator",
        eyebrow: "Quick calculations",
        title: "Do the math where you enter the amount",
        body: "Most money fields include a small calculator, so you can add things up without leaving Splex.",
        points: [
          "Calculate totals before saving an expense or settlement",
          "Useful for receipts, partial payments, and quick ad-hoc sums",
          "No switching to another app just to check a number"
        ]
      },
      {
        shot: "currency-converter",
        eyebrow: "Currency converter",
        title: "Keep the receipt currency visible",
        body: "Enter the expense in the currency on the receipt. Splex converts it for the balance and keeps the original amount visible.",
        points: [
          "Convert between supported currencies in the app",
          "Cached rates stay available when you are offline",
          "Useful when you want to get a better feel for local prices"
        ]
      },
      {
        shot: "group-balances",
        eyebrow: "Balances & settlements",
        title: "See the balance and the history behind it",
        body: "Balances show what is open. The ledger and activity history explain how you got there.",
        points: [
          "Current balances and history for every group",
          "Record settlements and keep balances up to date",
          "Simplified debts: fewer transfers, same final result"
        ]
      },
      {
        shot: "group-statistics",
        eyebrow: "Insights",
        title: "Use statistics when they answer a real question",
        body: "Group statistics are for looking back at what actually happened in a group, not for replacing the expense history.",
        points: [
          "Find the largest expenses in a group",
          "See which currencies and locations appeared",
          "Spot spending patterns without reading every expense again"
        ]
      },
      {
        shot: "overview",
        eyebrow: "Accounts & sharing",
        title: "Invite people without making account setup a project",
        body: "Magic links, login codes, and shareable invites keep setup short for friends and group members.",
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
      { shot: "calculator", label: "Calculator" },
      { shot: "currency-converter", label: "Currency converter" },
      { shot: "group-balances", label: "Balances" },
      { shot: "group-statistics", label: "Statistics" },
      { shot: "activity", label: "Activity" }
    ]
  },
  selfhost: {
    eyebrow: "Open source",
    heading: "Self-hosted if you want to run it yourself",
    paragraph:
      "Splex is open source. Use the public instance, run your own, or read the code first.",
    ctaGithub: "View on GitHub",
    ctaGuide: "Self-hosting guide",
    ctaTry: "Try it now",
    cards: [
      {
        title: "One container",
        body: "The app, PWA, and API are served from one container. SQLite is the default for small installs."
      },
      {
        title: "Data stays where you host it",
        body: "Self-hosting means your database and uploaded receipts live on your server."
      },
      {
        title: "Browser demo",
        body: "Demo mode uses sample data in the browser, so people can try the interface without creating an account."
      },
      {
        title: "Offline expense entry",
        body: "New expenses can be queued offline and synced when the connection comes back."
      },
      {
        title: "Notifications, when configured",
        body: "Web and Android push can notify users about changed expenses and settlement reminders."
      }
    ]
  },
  cta: {
    heading: "Try Splex",
    paragraph: "Open the web app, use the browser demo, or install Splex on Android.",
    ctaApp: "Open the web app",
    ctaPlay: "Get it on Google Play"
  },
  footer: {
    product: "Product",
    guides: "Guides",
    documentation: "Documentation",
    legal: "Legal",
    links: {
      features: "Features",
      guides: "Guides",
      documentation: "Documentation",
      selfhost: "Self-host",
      glossary: "Glossary",
      login: "Log in",
      play: "Google Play"
    },
    legalLinks: { tos: "Terms of Service", privacy: "Privacy Policy", imprint: "Imprint" },
    rights: "Open source.",
    github: "GitHub"
  }
};

const de: Content = {
  meta: {
    title: "Ausgaben mit Freunden und Gruppen fair teilen.",
    description:
      "Splex ist eine Open-Source-Alternative zu Splitwise für gemeinsame Ausgaben, mehrere Währungen, Ausgleichszahlungen und eigene Installationen."
  },
  header: {
    features: "Funktionen",
    guides: "Themen",
    documentation: "Dokumentation",
    selfhost: "Selbst hosten",
    login: "Anmelden",
    githubAria: "Splex auf GitHub"
  },
  hero: {
    badge: "Open Source · selbst hostbar",
    titleA: "Ausgaben fair teilen",
    titleB: "mit Freunden und Gruppen.",
    paragraph:
      "Splex ist eine Open-Source-Alternative zu Splitwise. Teile Kosten mit Freunden, Partnern und Gruppen, nutze mehrere Währungen und betreibe die App auf deinem eigenen Server, wenn du selbst hosten möchtest.",
    ctaApp: "Web-App öffnen",
    ctaPlay: "Bei Google Play laden",
    subtext: "Ohne Passwort anmelden · installierbar · Ausgaben offline vormerken"
  },
  features: {
    heading: "Die Details, über die man sonst später diskutiert",
    subheading:
      "Splex konzentriert sich auf die Dinge, die nachvollziehbar machen, wer wem noch etwas schuldet: wer gezahlt hat, wer beteiligt war, welche Währung genutzt wurde und was sich geändert hat.",
    items: [
      {
        shot: "add-expense",
        eyebrow: "Ausgaben erfassen",
        title: "Nicht nur den Betrag speichern",
        body: "Erfasse Ausgaben in Gruppen oder direkt mit Freunden und wähle die Aufteilung, die zur Rechnung passt.",
        points: [
          "Aufteilen: Gleichmäßig, nur unter Ausgewählten, exakt, prozentual oder mit individuellen Anpassungen",
          "Mehrere Zahler pro Ausgabe (du zahlst 70 €, dein Partner 30 €)",
          "Mehrere Währungen mit Umrechnung für offene Beträge",
          "Belege als Bilder oder PDFs anhängen, optional mit Standort",
          "Beschreibungsvorschläge aus deinen eigenen Ausgaben in der Nähe"
        ]
      },
      {
        shot: "calculator",
        eyebrow: "Schnelle Zwischenrechnungen",
        title: "Rechne direkt dort, wo du Geldbeträge eingibst",
        body: "Die meisten Zahlenfelder haben einen kleinen Rechner. So kannst du etwas ausrechnen, ohne Splex zu verlassen.",
        points: [
          "Summen vor dem Speichern einer Ausgabe oder Ausgleichszahlung berechnen",
          "Praktisch für Belege, Teilbeträge und kurze Rechnungen zwischendurch",
          "Kein Wechsel in eine andere App, nur um eine Zahl zu prüfen"
        ]
      },
      {
        shot: "currency-converter",
        eyebrow: "Währungsrechner",
        title: "Die Währung vom Beleg bleibt sichtbar",
        body: "Trage die Ausgabe in der Währung vom Beleg ein. Splex rechnet sie für offene Beträge um und behält den Originalbetrag.",
        points: [
          "Zwischen den unterstützten Währungen in der App umrechnen",
          "Zwischengespeicherte Kurse bleiben auch offline verfügbar",
          "Praktisch, wenn du ein besseres Gefühl für lokale Preise bekommen willst"
        ]
      },
      {
        shot: "group-balances",
        eyebrow: "Offene Beträge & Ausgleich",
        title: "Sehen, was offen ist, und warum",
        body: "Offene Beträge zeigen, wer noch etwas zahlen oder bekommen soll. Verlauf und Aktivitäten zeigen, wie es dazu kam.",
        points: [
          "Offene Beträge und Verlauf für jede Gruppe",
          "Ausgleichszahlungen erfassen und offene Beträge aktuell halten",
          "Vereinfachte Schulden: weniger Überweisungen, gleiche Ergebnisse"
        ]
      },
      {
        shot: "group-statistics",
        eyebrow: "Einblicke",
        title: "Statistiken für echte Fragen",
        body: "Gruppenstatistiken sind für den Blick zurück gedacht, nicht als Ersatz für den Ausgabenverlauf.",
        points: [
          "Die größten Ausgaben einer Gruppe finden",
          "Sehen, welche Währungen und Orte vorkamen",
          "Muster erkennen, ohne jede Ausgabe einzeln zu lesen"
        ]
      },
      {
        shot: "overview",
        eyebrow: "Konten & Teilen",
        title: "Einladen ohne Konto-Hürde",
        body: "Magic Links, Login-Codes und Einladungslinks halten die Einrichtung für Freunde und Gruppenmitglieder kurz.",
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
      { shot: "calculator", label: "Rechner" },
      { shot: "currency-converter", label: "Währungsrechner" },
      { shot: "group-balances", label: "Offene Beträge" },
      { shot: "group-statistics", label: "Statistiken" },
      { shot: "activity", label: "Aktivität" }
    ]
  },
  selfhost: {
    eyebrow: "Open Source",
    heading: "Selbst hosten, wenn du es selbst betreiben willst",
    paragraph:
      "Splex ist Open Source. Nutze die öffentliche Instanz, betreibe deine eigene oder lies zuerst den Code.",
    ctaGithub: "Auf GitHub ansehen",
    ctaGuide: "Anleitung ansehen",
    ctaTry: "Jetzt ausprobieren",
    cards: [
      {
        title: "Ein Container",
        body: "App, PWA und API kommen aus einem Container. SQLite ist der Standard für kleine Installationen."
      },
      {
        title: "Daten dort, wo du hostest",
        body: "Beim Selbsthosten liegen Datenbank und hochgeladene Belege auf deinem Server."
      },
      {
        title: "Demo im Browser",
        body: "Der Demo-Modus nutzt Beispieldaten im Browser, damit man die Oberfläche ohne Konto ausprobieren kann."
      },
      {
        title: "Ausgaben offline erfassen",
        body: "Neue Ausgaben können offline vorgemerkt und später synchronisiert werden."
      },
      {
        title: "Benachrichtigungen, wenn konfiguriert",
        body: "Web- und Android-Push können über geänderte Ausgaben und Erinnerungen zum Ausgleichen informieren."
      }
    ]
  },
  cta: {
    heading: "Splex ausprobieren",
    paragraph: "Öffne die Web-App, nutze die Demo im Browser oder installiere Splex auf Android.",
    ctaApp: "Web-App öffnen",
    ctaPlay: "Bei Google Play laden"
  },
  footer: {
    product: "Produkt",
    guides: "Themen",
    documentation: "Dokumentation",
    legal: "Rechtliches",
    links: {
      features: "Funktionen",
      guides: "Themen",
      documentation: "Dokumentation",
      selfhost: "Selbst hosten",
      glossary: "Glossar",
      login: "Anmelden",
      play: "Google Play"
    },
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
