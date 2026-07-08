import type { Lang } from "./content";
import type { LocalizedContentPage } from "./contentPageTypes";

export type GuidePageKey =
  | "splitwiseAlternative"
  | "selfHosting"
  | "travelExpenses"
  | "sharedHouseholdExpenses";

export type GuidePageEntry = {
  key: GuidePageKey;
  featured?: boolean;
  related: GuidePageKey[];
  en: LocalizedContentPage;
  de: LocalizedContentPage;
};

export const guidePages: GuidePageEntry[] = [
  {
    key: "splitwiseAlternative",
    featured: true,
    related: ["selfHosting", "travelExpenses", "sharedHouseholdExpenses"],
    en: {
      path: "/splitwise-alternative/",
      title: "Open-source Splitwise alternative",
      description:
        "Splex as an open-source Splitwise alternative: what works well, what is missing, and what to check before you switch.",
      eyebrow: "Splitwise alternative",
      h1: "Splex instead of Splitwise? It depends what you want from the app",
      lead: [
        "If you are looking for the exact same app, just open source, Splex is not that. The basic workflow is similar, but the main difference is that Splex is open source, free, and can run on your own server."
      ],
      sections: [
        {
          heading: "Where Splex fits well",
          blocks: [
            {
              type: "list",
              items: [
                "You want the app to run on your own server and want full control over your data.",
                "You care that the app code is public and that your data is not tied to a single hosted product.",
                "Not everyone in your group wants to create an account? Add unregistered members without an account.",
                "You do not want another paid subscription that costs money every month."
              ]
            }
          ]
        },
        {
          heading: "Where Splitwise may still be the better fit",
          blocks: [
            {
              type: "list",
              items: [
                "You want a finished consumer service where nobody has to care about hosting, email settings, backups, or updates.",
                "You need a native iPhone app from the App Store. Splex works as an installable web app on iOS, but there is no iOS app yet.",
                "You want to send money or use banking features directly inside the app. Splex remembers who owes whom, and you can store PayPal or bank information, but it does not transfer money itself.",
                "You expect receipt OCR or automatic item extraction. Splex can attach receipts, but it does not read the receipt for you."
              ]
            }
          ]
        },
        {
          heading: "Switching from Splitwise",
          blocks: [
            {
              type: "paragraph",
              text:
                "Splex can import data from Splitwise. You create a Splitwise API key, paste it into Splex, and Splex pulls over groups, members, expenses, and payments where they can be mapped cleanly."
            }
          ]
        }
      ],
      table: {
        columns: ["Topic", "Splex", "Splitwise"],
        rows: [
          ["Source code", "Open source and hosted from the same public repository.", "Closed source product."],
          ["Hosting", "Can run in one container on your server. There is also a public instance.", "Hosted service."],
          ["Apps", "Installable web app and Android. No native iPhone app yet.", "Native apps and web app."],
          ["Splitting payments", "Supports the common ways to split payments.", "Supports the common ways to split payments."],
          ["Cost", "Free, without ads or feature limits.", "Paid, or ads and limits in the basic version, such as an expense limit."],
          ["Currencies", "Enter expenses in another currency. There is also a small offline currency converter because the rates are already available.", "Enter expenses in another currency."],
          ["Offline", "New expenses can be queued offline and synced later.", "Offline-capable."],
          ["Payments", "Records expenses and payments, but does not transfer money.", "Can integrate with payment options in some regions."]
        ]
      },
      faq: [
        {
          question: "Is Splex a drop-in replacement for Splitwise?",
          answer:
            "Not exactly. Splex covers the core workflow and can be self-hosted, but it does not copy every Splitwise feature. On the other hand, Splex also has features that do not exist in Splitwise."
        },
        {
          question: "Can I try Splex?",
          answer:
            "Yes. You can use the public instance. There is also a demo mode that runs in the browser with sample data."
        },
        {
          question: "Is Splex free?",
          answer:
            "The source code is open source and can be used for free. If you self-host Splex, you only pay your own server costs."
        }
      ]
    },
    de: {
      path: "/de/splitwise-alternative/",
      title: "Open-Source-Alternative zu Splitwise",
      description:
        "Splex als Open-Source-Alternative zu Splitwise: was gut funktioniert, was fehlt und worauf du beim Wechsel achten solltest.",
      eyebrow: "Splitwise-Alternative",
      h1: "Splex statt Splitwise? Kommt darauf an, was du suchst",
      lead: [
        "Wenn du exakt dieselbe App nur als Open Source suchst, ist Splex nicht genau das. Der Grundablauf ist ähnlich, aber der wichtigste Unterschied ist: Splex ist Open Source, kostenlos und kann auf deinem eigenen Server laufen.",
      ],
      sections: [
        {
          heading: "Wo Splex gut passt",
          blocks: [
            {
              type: "list",
              items: [
                "Du möchtest die App auf deinem eigenen Server laufen lassen und die volle Kontrolle über deine Daten haben.",
                "Dir ist wichtig, dass der Code der App einsehbar ist und deine Daten nicht an ein einzelnes Produkt gebunden sind.",
                "Nicht alle aus deiner Gruppe wollen einen Account erstellen? Füge einfach unregistrierte Mitglieder ohne Account hinzu.",
                "Du hast keine Lust auf ein weiteres kostenpflichtiges Abo, das dich jeden Monat Geld kostet."
              ]
            }
          ]
        },
        {
          heading: "Wo Splitwise wahrscheinlich besser passt",
          blocks: [
            {
              type: "list",
              items: [
                "Du willst einfach eine fertige App nutzen, ohne dich jemals um Hosting, E-Mail, Backups oder Updates zu kümmern.",
                "Du brauchst eine native iPhone-App aus dem App Store. Splex lässt sich auf iOS als installierbare Web App nutzen, aber eine iOS-App gibt es aktuell nicht.",
                "Du willst direkt in der App Geld senden oder Bankfunktionen nutzen. Splex merkt sich, wer wem etwas schuldet, und man kann sogar sein PayPal-Konto oder Bankinformationen hinterlegen, überweist aber selbst nichts.",
                "Du erwartest, dass Belege automatisch ausgelesen werden. Splex kann Belege anhängen, aber keine Kassenzettel für dich zerlegen."
              ]
            }
          ]
        },
        {
          heading: "Von Splitwise wechseln",
          blocks: [
            {
              type: "paragraph",
              text:
                "Splex kann Daten aus Splitwise importieren. Du erstellst dafür einen Splitwise-API-Key, fügst ihn in Splex ein, und Splex holt sich Gruppen, Mitglieder, Ausgaben und Zahlungen, soweit sie sich sauber abbilden lassen."
            }
          ]
        }
      ],
      table: {
        columns: ["Thema", "Splex", "Splitwise"],
        rows: [
          ["Quellcode", "Open Source, Apps aus dem öffentlichen Repository gebaut.", "Geschlossenes Produkt."],
          ["Hosting", "Kann in einem Container auf deinem Server laufen. Alternativ gibt es eine öffentliche Instanz.", "Gehosteter Dienst."],
          ["Apps", "Installierbare Web App und Android. Noch keine native iPhone-App.", "Native Apps und Web-App."],
          ["Zahlungen aufteilen", "Auswahl zwischen allen gängigen Möglichkeiten, Zahlungen aufzuteilen.", "Auswahl zwischen allen gängigen Möglichkeiten, Zahlungen aufzuteilen."],
          ["Kosten", "Kostenlos ohne Werbung oder Funktionseinschränkungen.", "Kostenpflichtig oder Werbung und Einschränkungen der Basisfunktionen, zum Beispiel ein Limit für Ausgaben."],
          ["Währungen", "Eingabe der Ausgaben in einer anderen Währung. Zusätzlich gibt es einen kleinen Offline-Währungsrechner, weil die Kurse sowieso schon da sind.", "Eingabe der Ausgaben in einer anderen Währung."],
          ["Offline", "Neue Ausgaben können offline vorgemerkt und später synchronisiert werden.", "Offlinefähig."],
          ["Zahlungen", "Erfasst Ausgaben und Zahlungen, überweist aber kein Geld.", "Kann je nach Region Zahlungsoptionen einbinden."]
        ]
      },
      faq: [
        {
          question: "Ist Splex ein kompletter Ersatz für Splitwise?",
          answer:
            "Nicht eins zu eins. Splex deckt den Kern ab und lässt sich selbst hosten, kopiert aber nicht jede Splitwise-Funktion. Auf der anderen Seite gibt es auch Funktionen, die nicht in Splitwise existieren."
        },
        {
          question: "Kann ich Splex ausprobieren?",
          answer:
            "Ja. Die öffentliche Instanz kann verwendet werden. Es gibt sogar einen Demo-Modus, der im Browser mit Beispieldaten läuft."
        },
        {
          question: "Ist Splex kostenlos?",
          answer:
            "Der Quellcode ist Open Source und darf kostenlos verwendet werden. Wenn du Splex selbst hostest, zahlst du nur deine eigenen Serverkosten."
        }
      ]
    }
  },
  {
    key: "selfHosting",
    featured: true,
    related: ["splitwiseAlternative", "travelExpenses", "sharedHouseholdExpenses"],
    en: {
      path: "/self-hosting/",
      title: "Self-hosted expense sharing with Splex",
      description:
        "How to self-host Splex: one container, SQLite or PostgreSQL, backups, email setup, and the parts you still have to maintain yourself.",
      eyebrow: "Self-hosting",
      h1: "Self-hosting Splex for a small private instance",
      lead: [
        "The default Splex setup is intentionally simple: one app container, one mounted data directory, and SQLite. For a small private instance, that is usually enough.",
        "It is light enough to run on a NAS or Raspberry Pi, as long as Docker and Docker Compose are available."
      ],
      sections: [
        {
          heading: "How do I set up Splex?",
          blocks: [
            {
              type: "paragraph",
              text:
                "Splex runs as a container and can be started in a few minutes if you already have a server, NAS, or Raspberry Pi that can run containers."
            },
            {
              type: "link",
              text: "Start with the",
              label: ".env.example template.",
              href: "https://raw.githubusercontent.com/steve192/splex/main/.env.example"
            },
            {
              type: "list",
              items: [
                "Create a directory for Splex on your server.",
                "Save the template as .env and fill in at least SECRET_KEY, FRONTEND_PUBLIC_URL, BACKEND_PUBLIC_URL, and the email settings.",
                "Create a docker-compose.yml file. SQLite is the shortest setup; PostgreSQL is also supported if you want a separate database service.",
                "Start it with docker compose pull and docker compose up -d."
              ]
            },
            {
              type: "paragraph",
              text: "A small SQLite setup looks like this:"
            },
            {
              type: "code",
              code: `services:
  app:
    image: ghcr.io/steve192/splex:latest
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped`
            },
            {
              type: "paragraph",
              text:
                "The ./data directory stores the SQLite database, uploaded media files, and generated legal document files. Back it up regularly. If you prefer PostgreSQL, keep the ./data mount anyway, because uploaded files still live there."
            },
            {
              type: "link",
              text: "The full setup guide, including the PostgreSQL compose example, is in the",
              label: "GitHub README.",
              href: "https://github.com/steve192/splex#first-time-setup"
            }
          ]
        }
      ],
    },
    de: {
      path: "/de/selbst-hosten/",
      title: "Splex selbst hosten",
      description:
        "Splex selbst hosten: Docker-Container, SQLite oder PostgreSQL, Backups, E-Mail und die Dinge, um die du dich selbst kümmern musst.",
      eyebrow: "Selbst hosten",
      h1: "Splex als kleine private Instanz selbst hosten",
      lead: [
        "Die Standardinstallation von Splex ist absichtlich unspektakulär: ein App-Container, ein eingebundenes Datenverzeichnis und SQLite. Für eine kleine private Instanz ist das absolut ausreichend und erstaunlich simpel.",
        "Das Ganze ist leichtgewichtig genug, dass es problemlos auf deinem NAS oder Raspberry Pi läuft."
      ],
      sections: [
        {
          heading: "Wie setze ich Splex auf?",
          blocks: [
            {
              type: "paragraph",
              text:
                "Splex läuft als Container und ist innerhalb weniger Minuten funktionsfähig. Voraussetzung ist ein Server, NAS oder Raspberry Pi, auf dem Docker und Docker Compose laufen."
            },
            {
              type: "link",
              text: "Lade zuerst die",
              label: ".env.example-Vorlage herunter.",
              href: "https://raw.githubusercontent.com/steve192/splex/main/.env.example"
            },
            {
              type: "list",
              items: [
                "Lege auf deinem Server ein Verzeichnis für Splex an.",
                "Speichere die Vorlage als .env und setze mindestens SECRET_KEY, FRONTEND_PUBLIC_URL, BACKEND_PUBLIC_URL und die E-Mail-Einstellungen.",
                "Erstelle eine docker-compose.yml. SQLite ist der kürzeste Weg; PostgreSQL wird unterstützt, wenn du eine eigene Datenbank als separaten Dienst möchtest.",
                "Starte Splex mit docker compose pull und docker compose up -d."
              ]
            },
            {
              type: "paragraph",
              text: "Ein kleines SQLite-Setup sieht so aus:"
            },
            {
              type: "code",
              code: `services:
  app:
    image: ghcr.io/steve192/splex:latest
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped`
            },
            {
              type: "paragraph",
              text:
                "Das Verzeichnis ./data enthält die SQLite-Datenbank, hochgeladene Dateien und erzeugte Rechtstexte. Sichere es regelmäßig. Wenn du PostgreSQL nutzt, bleibt ./data trotzdem nötig, weil hochgeladene Dateien weiterhin dort liegen."
            },
            {
              type: "link",
              text: "Die vollständige Anleitung inklusive PostgreSQL-Beispiel steht im",
              label: "GitHub README.",
              href: "https://github.com/steve192/splex#first-time-setup"
            }
          ]
        }
      ],
    }
  },
  {
    key: "travelExpenses",
    featured: true,
    related: ["splitwiseAlternative", "selfHosting", "sharedHouseholdExpenses"],
    en: {
      path: "/use-cases/travel-expenses/",
      title: "Group travel expense tracking",
      description:
        "How Splex helps groups track travel expenses with multiple currencies, offline entry, receipts, balances, and settlements.",
      eyebrow: "Use case",
      h1: "Track group travel expenses before the last-night money discussion",
      lead: [
        "Trips are where expense tracking either works or gets abandoned. Someone pays for the hotel, someone else pays groceries, the taxi was in a different currency, and half the group only remembers it two days later.",
        "Splex helps because the details that usually get lost in chat messages stay together: currencies, receipts, balances, settlements, expenses, and even the location, so you can later see where an expense happened."
      ],
      sections: [
        {
          heading: "Before the trip",
          blocks: [
            {
              type: "list",
              items: [
                "Create a group for the trip and invite people with a link.",
                "Add expenses for hotels, travel, booked tickets, and similar costs before the trip starts.",
                "Attach receipts for the bigger items: hotel, rental car, tickets, deposits.",
                "Either settle some of it early, or leave the amounts open until after the trip."
              ]
            }
          ]
        },
        {
          heading: "During the trip",
          blocks: [
            {
              type: "list",
              items: [
                "Enter amounts in the local currency instead of converting them in your head.",
                "Only include selected people when not everyone joined a meal or taxi ride.",
                "Paid cash at a restaurant and everyone contributed a bit? Add multiple payers to one expense.",
                "Save an expense offline when the connection is bad and sync it later.",
                "Spending more than expected? Use the statistics, such as spending trends or average spending per day, to keep an eye on the trip."
              ]
            }
          ]
        },
        {
          heading: "After the trip",
          blocks: [
            {
              type: "paragraph",
              text:
                "The useful part is not only knowing who owes whom. It is being able to explain why. Splex keeps the history and activity together, and you can record settlements once someone pays back what they owe. After the trip, the statistics can also give you a useful look back at what the group actually spent."
            }
          ]
        }
      ],
    },
    de: {
      path: "/de/anwendungsfaelle/reiseausgaben/",
      title: "Reiseausgaben in Gruppen verwalten",
      description:
        "Wie Splex bei Reiseausgaben hilft: mehrere Währungen, Offline-Erfassung, Belege, Standorte, offene Beträge und Ausgleichszahlungen.",
      eyebrow: "Anwendungsfall",
      h1: "Reiseausgaben teilen, bevor am letzten Abend das große Rechnen beginnt",
      lead: [
        "Auf Reisen zeigt sich schnell, ob eine Ausgaben-App wirklich hilft. Eine Person zahlt das Hotel, jemand anderes die Einkäufe, das Taxi war in einer anderen Währung, und zwei Leute erinnern sich erst Tage später daran.",
        "Splex hilft dabei, weil die Details zusammenbleiben, die sonst schnell in Chats untergehen: Währungen, Belege, offene Beträge, Ausgleichszahlungen, Ausgaben und sogar der Standort, damit du später nachvollziehen kannst, wo eine Ausgabe entstanden ist."
      ],
      sections: [
        {
          heading: "Vor der Reise",
          blocks: [
            {
              type: "list",
              items: [
                "Eine Gruppe für die Reise anlegen und alle per Link einladen.",
                "Schon mal Ausgaben für Hotels, Anreise, gebuchte Tickets und ähnliche Posten eintragen.",
                "Belege für die größeren Posten anhängen: Hotel, Mietwagen, Tickets, Kautionen.",
                "Entweder machst du jetzt schon eine kleine Zwischenabrechnung, oder du lässt die Beträge einfach bis nach der Reise offen."
              ]
            }
          ]
        },
        {
          heading: "Während der Reise",
          blocks: [
            {
              type: "list",
              items: [
                "Beträge in der lokalen Währung eintragen, statt im Kopf umzurechnen.",
                "Nur ausgewählte Personen einbeziehen, wenn nicht alle beim Essen oder im Taxi dabei waren.",
                "Bezahlt ihr im Restaurant bar und jeder gibt ein bisschen dazu? Kein Problem: einfach mehrere Zahler eintragen.",
                "Eine Ausgabe offline speichern, wenn die Verbindung schlecht ist, und später synchronisieren.",
                "Gebt ihr zu viel aus und der Trip wird zu teuer? Habt alles im Blick mit den vielen Auswertungen wie Ausgabentrend oder durchschnittliche Ausgaben pro Tag."
              ]
            }
          ]
        },
        {
          heading: "Nach der Reise",
          blocks: [
            {
              type: "paragraph",
              text:
                "Hilfreich ist nicht nur zu wissen, wer wem etwas schuldet. Wichtig ist, erklären zu können, warum das so ist. Splex behält Verlauf und Aktivitäten zusammen, und Ausgleichszahlungen kannst du eintragen, sobald jemand Schulden begleicht. Nach der Reise kannst du dir auch noch einmal die Statistiken ansehen, um interessante Einblicke in eure Ausgaben zu bekommen."
            }
          ]
        }
      ]
    }
  },
  {
    key: "sharedHouseholdExpenses",
    featured: true,
    related: ["splitwiseAlternative", "selfHosting", "travelExpenses"],
    en: {
      path: "/use-cases/shared-household-expenses/",
      title: "Shared household expense tracking",
      description:
        "How Splex helps shared households track groceries, rent, utilities, exact splits, balances, receipts, and settlements.",
      eyebrow: "Use case",
      h1: "Shared household expenses need a history, not just a number",
      lead: [
        "Groceries, rent, utilities, furniture, deposits, and small errands all end up in the same place. It should feel fair without turning every evening into a money discussion."
      ],
      sections: [
        {
          heading: "Everyday examples",
          blocks: [
            {
              type: "list",
              items: [
                "Rent can be split by percentage when rooms are different sizes.",
                "Groceries can be split equally, only between selected people, or by exact amount. If someone bought something special only for themselves, part of the receipt can be assigned separately.",
                "Furniture can have multiple payers if two people paid part of it.",
                "Utilities and subscriptions stay in the group history instead of disappearing into old chat messages.",
                "No more guessing who paid more or less. Put the shared expenses in one place, and the total balance shows who should probably pay next."
              ]
            }
          ]
        },
        {
          heading: "Why the ledger matters",
          blocks: [
            {
              type: "paragraph",
              text:
                "A household does not only need to know who owes money. It also needs a way to answer why. Splex keeps the expenses, balances, settlements, and activity history together, so the explanation is not hidden in someone's memory."
            }
          ]
        },
        {
          heading: "Settling without overthinking it",
          blocks: [
            {
              type: "paragraph",
              text:
                "Instead of settling every small purchase with a separate bank transfer, Splex can offset all expenses against each other. And if several people in a shared flat owe each other in a circle, Splex can simplify the debts so fewer settlement payments are needed."
            }
          ]
        }
      ],
    },
    de: {
      path: "/de/anwendungsfaelle/haushaltsausgaben/",
      title: "Gemeinsame Haushaltsausgaben verwalten",
      description:
        "Wie Splex zu Haushalten passt: Einkäufe, Miete, Nebenkosten, mehrere Zahler, exakte Aufteilungen, offene Beträge und Verlauf.",
      eyebrow: "Anwendungsfall",
      h1: "Haushaltsausgaben brauchen Verlauf, nicht nur eine Zahl",
      lead: [
        "Einkäufe, Miete, Nebenkosten, Möbel, Kautionen und kleine Erledigungen landen alle im selben Topf. Es soll fair bleiben, ohne jeden Abend über Geld zu sprechen."
      ],
      sections: [
        {
          heading: "Alltägliche Beispiele",
          blocks: [
            {
              type: "list",
              items: [
                "Miete kann prozentual aufgeteilt werden, wenn Zimmer unterschiedlich groß sind.",
                "Einkäufe können gleichmäßig, nur unter bestimmten Personen oder exakt nach Betrag aufgeteilt werden. Wenn jemand etwas Besonderes nur für sich kaufen wollte, kann ein Teil der Rechnung separat angerechnet werden.",
                "Möbel können mehrere Zahler haben, wenn zwei Personen einen Teil vorgestreckt haben.",
                "Nebenkosten und Abos stehen im Gruppenverlauf, statt in alten Chatnachrichten zu verschwinden.",
                "Keine Gedanken mehr machen, wer mehr oder weniger zahlt. Einfach alle Ausgaben in einen Topf, und ein Blick auf die Gesamtsumme reicht, um zu wissen, wer als Nächstes zahlt."
              ]
            }
          ]
        },
        {
          heading: "Warum der Verlauf wichtig ist",
          blocks: [
            {
              type: "paragraph",
              text:
                "Ein Haushalt muss nicht nur wissen, wer wem Geld schuldet. Genauso wichtig ist die Frage: Warum? Splex hält Ausgaben, offene Beträge, Ausgleichszahlungen und Aktivitäten zusammen, damit die Antwort nicht vom Gedächtnis einer Person abhängt."
            }
          ]
        },
        {
          heading: "Ausgleichen, ohne jede Kleinigkeit zu überweisen",
          blocks: [
            {
              type: "paragraph",
              text:
                "Einfach alle Ausgaben in Summe gegenrechnen, statt jeden kleinen Einkauf direkt mit einer Überweisung auszugleichen. Außerdem: Wenn ihr mehrere Leute in einer WG seid und euch im Kreis schuldet, kann Splex die Schulden unter euch vereinfachen, sodass am Ende weniger Ausgleichszahlungen nötig sind."
            }
          ]
        }
      ]
    }
  }
];

export const guidePageKeys = guidePages.map((page) => page.key);

export function getGuidePage(key: GuidePageKey): GuidePageEntry {
  const page = guidePages.find((candidate) => candidate.key === key);
  if (!page) throw new Error(`Unknown guide page: ${key}`);
  return page;
}

export function localizedGuidePage(key: GuidePageKey, lang: Lang): LocalizedContentPage {
  const page = getGuidePage(key);
  return page[lang];
}

export function guidePagePaths(key: GuidePageKey): Record<Lang, string> {
  const page = getGuidePage(key);
  return { en: page.en.path, de: page.de.path };
}

export function relatedGuidePages(key: GuidePageKey): GuidePageEntry[] {
  return getGuidePage(key).related.map(getGuidePage);
}

export function featuredGuidePages(): GuidePageEntry[] {
  return guidePages.filter((page) => page.featured);
}
