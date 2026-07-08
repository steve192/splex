import type { Lang } from "./content";

export type GlossaryTerm = {
  term: string;
  synonyms: string[];
  description: string;
  link?: { href: string; label: string };
};

export type LocalizedGlossaryPage = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string[];
  terms: GlossaryTerm[];
};

export type GlossaryPageEntry = {
  en: LocalizedGlossaryPage;
  de: LocalizedGlossaryPage;
};

export const glossaryPage: GlossaryPageEntry = {
  en: {
    path: "/glossary/",
    title: "Splex glossary",
    description:
      "Plain-language explanations of Splex terms such as expenses, open amounts, settlements, groups, unregistered members, and pending sync.",
    eyebrow: "Glossary",
    h1: "Glossary for Splex terms",
    lead: [
      "Splex uses a few words that are easy to mix up when you first use the app. This page explains the product terms in plain language and lists common synonyms.",
      "The short version: an expense records what happened, open amounts show who still needs to pay or receive money, and a settlement records that money was paid back."
    ],
    terms: [
      {
        term: "Expense",
        synonyms: ["Bill", "cost", "entry", "Ausgabe"],
        description:
          "A saved cost in a group or directly with a friend. An expense stores the amount, currency, date, who paid, who owed which share, and optional details such as receipt or location.",
        link: { href: "/docs/adding-expenses/", label: "Adding expenses" }
      },
      {
        term: "Open amount",
        synonyms: ["Balance", "outstanding amount", "who still owes what", "offener Betrag"],
        description:
          "The amount that is still open after Splex combines expenses and settlements. It tells you who should still pay money or who should receive money.",
        link: { href: "/docs/balances-and-settlements/", label: "Balances and settlements" }
      },
      {
        term: "Settlement",
        synonyms: ["Payment", "payback", "Ausgleich", "Ausgleichszahlung"],
        description:
          "A payment recorded in Splex from one person to another. It reduces what is open in that direction. Splex records the settlement, but it does not move money automatically.",
        link: { href: "/docs/balances-and-settlements/", label: "Balances and settlements" }
      },
      {
        term: "Payer",
        synonyms: ["Person who paid", "Zahler"],
        description:
          "The person who paid money upfront. An expense can have one payer or multiple payers if several people paid parts of the same bill.",
        link: { href: "/docs/adding-expenses/#multiple-payers-6", label: "Multiple payers" }
      },
      {
        term: "Owed share",
        synonyms: ["Share", "split share", "Anteil", "geschuldeter Anteil"],
        description:
          "The part of an expense a person should cover. This can be equal, exact, percentage-based, or adjusted from an equal split.",
        link: { href: "/docs/adding-expenses/#split-methods-5", label: "Split methods" }
      },
      {
        term: "Group",
        synonyms: ["Shared group", "trip group", "household", "Gruppe"],
        description:
          "A separate place for shared expenses with several people. Group expenses and direct friend expenses stay separate.",
        link: { href: "/docs/friends-and-groups/", label: "Friends and groups" }
      },
      {
        term: "Friend",
        synonyms: ["Direct friend", "one-to-one expenses", "Freund"],
        description:
          "A direct connection between two registered users. Expenses between friends are separate from group expenses, even when the same people are involved.",
        link: { href: "/docs/friends-and-groups/", label: "Friends and groups" }
      },
      {
        term: "Unregistered member",
        synonyms: ["Placeholder", "person without account", "unregistriertes Mitglied", "Platzhalter"],
        description:
          "A person in a group who does not have an account yet. You can include them in expenses now and invite them later so they take over that exact placeholder.",
        link: { href: "/docs/friends-and-groups/#unregistered-members-can-still-be-invited-later-3", label: "Unregistered members" }
      },
      {
        term: "Activity",
        synonyms: ["Change history", "log", "Aktivitäten", "Verlauf"],
        description:
          "The history of important changes. When expenses or settlements are created, changed, or deleted, Splex records what happened and who did it."
      },
      {
        term: "Archive",
        synonyms: ["Hide from active list", "read-only group", "Archiv"],
        description:
          "Archiving keeps a group but moves it out of the normal overview. Archived groups are read-only until they are restored.",
        link: { href: "/docs/friends-and-groups/#archiving-a-group-4", label: "Archiving groups" }
      },
      {
        term: "Simplified debt",
        synonyms: ["Debt simplification", "fewer payments", "vereinfachte Schulden"],
        description:
          "A group view that keeps everyone’s final open amount the same, but suggests fewer payments to settle the group.",
        link: { href: "/docs/balances-and-settlements/#simplified-debt-4", label: "Simplified debt" }
      },
      {
        term: "Currency calculator",
        synonyms: ["Converter", "exchange-rate calculator", "Währungsrechner"],
        description:
          "A small calculator for getting a feel for prices in another currency. It uses cached exchange-rate snapshots and can work offline after rates were loaded once.",
        link: { href: "/docs/currency-calculator/", label: "Currency calculator" }
      },
      {
        term: "Pending sync",
        synonyms: ["Queued expense", "offline draft", "ausstehende Synchronisierung"],
        description:
          "A local change waiting to be sent to the server. Pending expenses are visible in the app, but they are not part of the server-side open amounts until sync succeeds.",
        link: { href: "/docs/adding-expenses/#offline-sync-8", label: "Offline sync" }
      },
      {
        term: "Preferred payment method",
        synonyms: ["Payment info", "PayPal details", "bevorzugte Zahlungsmethode"],
        description:
          "Payment information saved by a user so others know how to pay them. It is shown for convenience when recording a settlement; Splex still does not make the payment.",
        link: { href: "/docs/balances-and-settlements/#preferred-payment-methods-5", label: "Preferred payment methods" }
      }
    ]
  },
  de: {
    path: "/de/glossar/",
    title: "Splex Glossar",
    description:
      "Einfache Erklärungen zu Splex-Begriffen wie Ausgaben, offene Beträge, Ausgleich, Gruppen, unregistrierte Mitglieder und ausstehende Synchronisierung.",
    eyebrow: "Glossar",
    h1: "Glossar für Begriffe in Splex",
    lead: [
      "In Splex gibt es ein paar Wörter, die man am Anfang leicht durcheinanderbringt. Dieses Glossar erklärt die Begriffe so, wie sie in der App gemeint sind, und nennt typische Synonyme.",
      "Kurz gesagt: Eine Ausgabe speichert, was passiert ist, offene Beträge zeigen, wer noch zahlen oder Geld bekommen soll, und ein Ausgleich speichert, dass Geld zurückgezahlt wurde."
    ],
    terms: [
      {
        term: "Ausgabe",
        synonyms: ["Rechnung", "Kosten", "Eintrag", "expense"],
        description:
          "Ein gespeicherter Kostenpunkt in einer Gruppe oder direkt mit einem Freund. Eine Ausgabe enthält Betrag, Währung, Datum, Zahler, geschuldete Anteile und optional weitere Details wie Beleg oder Standort.",
        link: { href: "/de/dokumentation/ausgaben-erfassen/", label: "Ausgaben erfassen" }
      },
      {
        term: "Offener Betrag",
        synonyms: ["Saldo", "Balance", "wer wem noch etwas schuldet", "offen"],
        description:
          "Der Betrag, der nach Ausgaben und Ausgleichszahlungen noch offen ist. Er zeigt, wer noch etwas zahlen oder bekommen soll.",
        link: { href: "/de/dokumentation/offene-betraege-und-ausgleich/", label: "Offene Beträge und Ausgleich" }
      },
      {
        term: "Ausgleich",
        synonyms: ["Ausgleichszahlung", "Rückzahlung", "Zahlung", "settlement"],
        description:
          "Eine in Splex gespeicherte Zahlung von einer Person an eine andere. Sie reduziert, was in dieser Richtung noch offen ist. Splex speichert den Ausgleich, überweist aber kein Geld.",
        link: { href: "/de/dokumentation/offene-betraege-und-ausgleich/", label: "Offene Beträge und Ausgleich" }
      },
      {
        term: "Zahler",
        synonyms: ["Person, die bezahlt hat", "payer"],
        description:
          "Die Person, die Geld vorgestreckt hat. Eine Ausgabe kann einen Zahler oder mehrere Zahler haben, wenn mehrere Personen Teile derselben Rechnung bezahlt haben.",
        link: { href: "/de/dokumentation/ausgaben-erfassen/#mehrere-zahler-6", label: "Mehrere Zahler" }
      },
      {
        term: "Geschuldeter Anteil",
        synonyms: ["Anteil", "Aufteilungsanteil", "share", "owed share"],
        description:
          "Der Teil einer Ausgabe, den eine Person übernehmen soll. Dieser Anteil kann gleichmäßig, exakt, prozentual oder mit einer Anpassung berechnet werden.",
        link: { href: "/de/dokumentation/ausgaben-erfassen/#aufteilungsarten-5", label: "Aufteilungsarten" }
      },
      {
        term: "Gruppe",
        synonyms: ["Reisegruppe", "Haushalt", "WG", "group"],
        description:
          "Ein eigener Ort für gemeinsame Ausgaben mit mehreren Personen. Gruppenausgaben und direkte Ausgaben zwischen Freunden bleiben getrennt.",
        link: { href: "/de/dokumentation/freunde-und-gruppen/", label: "Freunde und Gruppen" }
      },
      {
        term: "Freund",
        synonyms: ["Direkter Freund", "Ausgaben zu zweit", "friend"],
        description:
          "Eine direkte Verbindung zwischen zwei registrierten Benutzern. Ausgaben zwischen Freunden sind von Gruppenausgaben getrennt, auch wenn dieselben Personen beteiligt sind.",
        link: { href: "/de/dokumentation/freunde-und-gruppen/", label: "Freunde und Gruppen" }
      },
      {
        term: "Unregistriertes Mitglied",
        synonyms: ["Platzhalter", "Person ohne Konto", "unregistered member"],
        description:
          "Eine Person in einer Gruppe, die noch kein Konto hat. Du kannst sie trotzdem in Ausgaben einbeziehen und später genau diesen Platzhalter per Einladung übernehmen lassen.",
        link: { href: "/de/dokumentation/freunde-und-gruppen/#unregistrierte-mitglieder-konnen-spater-noch-eingeladen-werden-3", label: "Unregistrierte Mitglieder" }
      },
      {
        term: "Aktivität",
        synonyms: ["Verlauf", "Änderungshistorie", "Log", "activity"],
        description:
          "Die Historie wichtiger Änderungen. Wenn Ausgaben oder Ausgleiche erstellt, geändert oder gelöscht werden, speichert Splex, was passiert ist und wer die Änderung gemacht hat."
      },
      {
        term: "Archivieren",
        synonyms: ["Ausblenden", "schreibgeschützt behalten", "archive"],
        description:
          "Archivieren behält eine Gruppe, verschiebt sie aber aus der normalen Übersicht. Archivierte Gruppen sind schreibgeschützt, bis sie wiederhergestellt werden.",
        link: { href: "/de/dokumentation/freunde-und-gruppen/#eine-gruppe-archivieren-4", label: "Gruppen archivieren" }
      },
      {
        term: "Vereinfachte Schulden",
        synonyms: ["Schulden vereinfachen", "weniger Zahlungen", "simplified debt"],
        description:
          "Eine Gruppenansicht, bei der gleich bleibt, wer am Ende wie viel zahlen oder bekommen soll. Splex schlägt nur weniger Zahlungen vor, um die Gruppe auszugleichen.",
        link: { href: "/de/dokumentation/offene-betraege-und-ausgleich/#vereinfachte-schulden-4", label: "Vereinfachte Schulden" }
      },
      {
        term: "Währungsrechner",
        synonyms: ["Umrechner", "Wechselkursrechner", "currency calculator"],
        description:
          "Ein kleiner Rechner, um unterwegs ein Gefühl für Preise in einer anderen Währung zu bekommen. Er nutzt gespeicherte Wechselkurse und funktioniert offline, nachdem Kurse einmal geladen wurden.",
        link: { href: "/de/dokumentation/waehrungsrechner/", label: "Währungsrechner" }
      },
      {
        term: "Ausstehende Synchronisierung",
        synonyms: ["Offline-Entwurf", "vorgemerkte Ausgabe", "pending sync"],
        description:
          "Eine lokale Änderung, die noch an den Server gesendet werden muss. Ausstehende Ausgaben sind in der App sichtbar, zählen aber erst nach erfolgreicher Synchronisierung zu den offenen Beträgen.",
        link: { href: "/de/dokumentation/ausgaben-erfassen/#offline-sync-8", label: "Offline-Sync" }
      },
      {
        term: "Bevorzugte Zahlungsmethode",
        synonyms: ["Zahlungsinfo", "PayPal-Daten", "preferred payment method"],
        description:
          "Zahlungsinformationen, die eine Person speichert, damit andere wissen, wie sie sie bezahlen können. Splex zeigt sie beim Erfassen eines Ausgleichs an, überweist aber weiterhin kein Geld.",
        link: { href: "/de/dokumentation/offene-betraege-und-ausgleich/#bevorzugte-zahlungsmethoden-5", label: "Bevorzugte Zahlungsmethoden" }
      }
    ]
  }
};

export function localizedGlossaryPage(lang: Lang): LocalizedGlossaryPage {
  return glossaryPage[lang];
}

export function glossaryPagePaths(): Record<Lang, string> {
  return { en: glossaryPage.en.path, de: glossaryPage.de.path };
}
