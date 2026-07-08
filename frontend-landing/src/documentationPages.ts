import type { Lang } from "./content";
import type { LocalizedContentPage } from "./contentPageTypes";

export type DocumentationPageKey =
  | "friendsGroups"
  | "currencyCalculator"
  | "balancesSettlements"
  | "addingExpense";

export type DocumentationPageEntry = {
  key: DocumentationPageKey;
  featured?: boolean;
  related: DocumentationPageKey[];
  en: LocalizedContentPage;
  de: LocalizedContentPage;
};

export const documentationPages: DocumentationPageEntry[] = [
  {
    key: "friendsGroups",
    featured: true,
    related: ["balancesSettlements", "addingExpense"],
    en: {
      path: "/docs/friends-and-groups/",
      title: "Friends and groups in Splex",
      description:
        "How friends, groups, invites, unregistered members, archives, deletion, leaving, and member removal work in Splex.",
      eyebrow: "Documentation",
      h1: "Friends and groups as places for expenses",
      lead: [
        "The first decision in Splex is where an expense belongs. An expense can live directly between two friends, or inside a group.",
        "Those two places stay separate. A group balance never changes a direct balance between two friends, and a direct expense between friends never changes a group balance."
      ],
      sections: [
        {
          heading: "Creating friends and groups",
          blocks: [
            {
              type: "paragraph",
              text:
                "You can create a group on your own. You can add existing friends to the group, send invite links, or add people as unregistered users."
            },
            {
              type: "paragraph",
              text:
                "You add a friend through an invite link. Once the other person opens the link and accepts the invite, you are connected as friends."
            },
            {
              type: "paragraph",
              text:
                "A group invite also creates friendships in the background. When someone joins a group, Splex makes sure the registered group members are friends with each other, because the same people may later want to settle something directly."
            }
          ]
        },
        {
          heading: "Everyone in a group can edit things in the group",
          blocks: [
            {
              type: "paragraph",
              text:
                "There are no separate permissions inside a group that decide who may do what. If someone is a member, they can add expenses, edit expenses, record settlements, and correct mistakes. Group members are equal for the shared history."
            },
            {
              type: "paragraph",
              text:
                "Changes are still traceable. New, changed, or deleted expenses and settlements appear in the activities, including the person who made the change."
            }
          ]
        },
        {
          heading: "Unregistered members can still be invited later",
          blocks: [
            {
              type: "paragraph",
              text:
                "Groups can contain people who do not have an account yet. Add them as unregistered members when you still want to include them in expenses, balances, and settlements."
            },
            {
              type: "paragraph",
              text:
                "Later you can send an invite link for that exact placeholder. When the person accepts it, the placeholder becomes their account in that group. Existing expenses, payments, settlements, and balances stay attached to the same identity."
            }
          ]
        },
        {
          heading: "Archiving a group",
          blocks: [
            {
              type: "paragraph",
              text:
                "Archiving is for groups you are done with but still want to keep. It applies to the whole group, so every member sees the group as archived."
            },
            {
              type: "list",
              items: [
                "A group can be archived even when balances are still open.",
                "Archived groups disappear from the normal overview and move into the archived section.",
                "Archived groups are read-only in the app: no new expenses, no settlement changes, no editing old expenses, and no group setting changes."
              ]
            }
          ]
        },
        {
          heading: "Deleting a group",
          blocks: [
            {
              type: "paragraph",
              text:
                "Deleting is stricter than archiving. The normal delete action is only available when all member balances in the group are settled."
            },
            {
              type: "paragraph",
              text:
                "There is one special case: if you leave a group and there is no other registered member left, Splex deletes the group even if open balances with unregistered placeholders still exist. At that point there is nobody left with an account who could continue managing the group."
            }
          ]
        },
        {
          heading: "Removing someone from a group",
          blocks: [
            {
              type: "paragraph",
              text:
                "When you remove a person, they do not disappear from old expenses. Splex converts their group membership into an unregistered placeholder. Expense shares, settlements, open takeover invites, and the group membership are moved to that placeholder. The removed person loses access to the group, but the history can still be balanced cleanly."
            },
            {
              type: "paragraph",
              text:
                "If you want to remove the person completely from the group, you can also remove the unregistered user. To keep all debts correct, Splex creates automatic settlements for the person being removed. Old expenses with that person still remain and stay understandable."
            },
            {
              type: "paragraph",
              text:
                "Those automatic settlements are bookkeeping entries. They set the debts in Splex to zero, but they do not mean that money was actually transferred. You need to settle that with the person yourself before removing them."
            }
          ]
        },
        {
          heading: "Leaving a group yourself",
          blocks: [
            {
              type: "paragraph",
              text:
                "If other registered members remain, leaving follows the same idea as removing a registered member: your group presence becomes an unregistered placeholder and the other members can keep the group ledger intact."
            },
            {
              type: "paragraph",
              text:
                "If you are the last registered member, or only unregistered placeholders remain, leaving deletes the group. That delete does not require all placeholder balances to be settled first."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Can the same person owe money in a group and as a friend?",
          answer:
            "Yes, but those are separate balances. A direct friend expense does not settle a group expense unless you record the matching settlement in the group as well."
        },
        {
          question: "Can an unregistered member be invited later?",
          answer:
            "Yes. Use the invite for that specific unregistered member, not a generic group invite, if you want that person to take over the placeholder identity."
        }
      ]
    },
    de: {
      path: "/de/dokumentation/freunde-und-gruppen/",
      title: "Freunde und Gruppen in Splex",
      description:
        "Wie Freunde, Gruppen, Einladungen, unregistrierte Mitglieder, Archivieren, Löschen, Verlassen und Entfernen in Splex funktionieren.",
      eyebrow: "Dokumentation",
      h1: "Freunde und Gruppen als Orte für Ausgaben",
      lead: [
        "Die erste Entscheidung in Splex ist der Ort der Ausgabe. Eine Ausgabe kann direkt zwischen zwei Freunden liegen oder in einer Gruppe.",
        "Diese beiden Orte bleiben getrennt. Was in einer Gruppe offen ist, verändert nicht, was direkt zwischen zwei Freunden offen ist, und eine direkte Ausgabe zwischen Freunden verändert keinen offenen Betrag in der Gruppe."
      ],
      sections: [
        {
          heading: "Freunde und Gruppen erstellen",
          blocks: [
            {
              type: "paragraph",
              text:
                "Eine Gruppe kannst du alleine anlegen. Entweder kannst du direkt existierende Freunde der Gruppe hinzufügen, du kannst Einladungen über Links verschicken oder du kannst deine Freunde als unregistrierte Benutzer hinzufügen."
            },
            {
              type: "paragraph",
              text:
                "Einen Freund kannst du durch einen Einladungslink hinzufügen. Sobald die andere Person den Link öffnet und die Einladung annimmt, seid ihr befreundet."
            },
            {
              type: "paragraph",
              text:
                "Eine Gruppeneinladung legt nebenbei auch Freundschaften an. Wenn jemand einer Gruppe beitritt, sorgt Splex dafür, dass die registrierten Gruppenmitglieder auch als Freunde verbunden sind. Das ist praktisch, wenn ihr später etwas direkt miteinander ausgleichen wollt."
            }
          ]
        },
        {
          heading: "Alle in der Gruppe können Dinge in der Gruppe bearbeiten",
          blocks: [
            {
              type: "paragraph",
              text:
                "Innerhalb einer Gruppe gibt es keine eigenen Berechtigungen, die regeln, wer was darf. Wer Mitglied ist, kann Ausgaben hinzufügen, Ausgaben bearbeiten, Ausgleichszahlungen eintragen und Fehler korrigieren. Für den gemeinsamen Verlauf sind Gruppenmitglieder gleichberechtigt."
            },
            {
              type: "paragraph",
              text:
                "Nachvollziehbar bleibt es trotzdem. Neue, geänderte oder gelöschte Ausgaben und Ausgleichszahlungen landen in den Aktivitäten, inklusive der Person, die die Änderung gemacht hat."
            }
          ]
        },
        {
          heading: "Unregistrierte Mitglieder können später noch eingeladen werden",
          blocks: [
            {
              type: "paragraph",
              text:
                "Gruppen können Personen enthalten, die noch kein Konto haben. Du kannst sie als unregistrierte Mitglieder hinzufügen, wenn du sie trotzdem in Ausgaben, offene Beträge und Ausgleichszahlungen einbeziehen willst."
            },
            {
              type: "paragraph",
              text:
                "Später kannst du einen Einladungslink genau für diesen Platzhalter verschicken. Nimmt die Person die Einladung an, wird der Platzhalter zu ihrem Konto in dieser Gruppe. Bestehende Ausgaben, Zahlungen, Ausgleichszahlungen und offene Beträge bleiben an derselben Identität hängen."
            }
          ]
        },
        {
          heading: "Eine Gruppe archivieren",
          blocks: [
            {
              type: "paragraph",
              text:
                "Archivieren ist für Gruppen gedacht, mit denen ihr fertig seid, die aber nicht verschwinden sollen. Das gilt immer für die ganze Gruppe, also sehen alle Mitglieder die Gruppe als archiviert."
            },
            {
              type: "list",
              items: [
                "Eine Gruppe kann auch dann archiviert werden, wenn noch offene Beträge existieren.",
                "Archivierte Gruppen verschwinden aus der normalen Übersicht und liegen im Archivbereich.",
                "Archivierte Gruppen sind in der App schreibgeschützt: keine neuen Ausgaben, keine Änderungen an Ausgleichszahlungen, keine Bearbeitung alter Ausgaben und keine Gruppeneinstellungen."
              ]
            }
          ]
        },
        {
          heading: "Eine Gruppe löschen",
          blocks: [
            {
              type: "paragraph",
              text:
                "Löschen ist strenger als Archivieren. Die normale Löschaktion ist nur möglich, wenn alle offenen Beträge in der Gruppe ausgeglichen sind."
            },
            {
              type: "paragraph",
              text:
                "Es gibt einen Sonderfall: Wenn du eine Gruppe verlässt und kein anderes registriertes Mitglied mehr übrig ist, löscht Splex die Gruppe auch dann, wenn noch offene Beträge mit unregistrierten Platzhaltern existieren. Dann gibt es niemanden mit Konto mehr, der die Gruppe weiter pflegen könnte."
            }
          ]
        },
        {
          heading: "Jemanden aus einer Gruppe entfernen",
          blocks: [
            {
              type: "paragraph",
              text:
                "Wenn du eine Person entfernst, verschwindet sie nicht aus alten Ausgaben. Splex wandelt ihre Gruppenmitgliedschaft in einen unregistrierten Platzhalter um. Anteile an Ausgaben, Ausgleichszahlungen, offene Übernahme-Einladungen und die Gruppenmitgliedschaft werden auf diesen Platzhalter verschoben. Die entfernte Person verliert den Zugriff auf die Gruppe, aber der Verlauf bleibt sauber abrechenbar."
            },
            {
              type: "paragraph",
              text:
                "Möchtest du die Person aber komplett aus der Gruppe entfernen, kannst du auch den unregistrierten Benutzer entfernen. Damit alle Schulden stimmen, erstellt Splex automatische Ausgleichszahlungen für die Person, die entfernt wird. Alte Ausgaben mit der Person bleiben weiterhin bestehen und nachvollziehbar."
            },
            {
              type: "paragraph",
              text:
                "Diese automatischen Ausgleichszahlungen sind Buchungseinträge. Sie setzen die Schulden in Splex auf null, bedeuten aber nicht, dass wirklich Geld überwiesen wurde. Das musst du persönlich mit der Person klären, bevor du sie entfernst."
            }
          ]
        },
        {
          heading: "Eine Gruppe selbst verlassen",
          blocks: [
            {
              type: "paragraph",
              text:
                "Wenn noch andere registrierte Mitglieder bleiben, passiert beim Verlassen im Grunde dasselbe wie beim Entfernen einer registrierten Person: Deine Identität in dieser Gruppe wird zu einem unregistrierten Platzhalter, und die anderen können den Gruppenverlauf weiter benutzen."
            },
            {
              type: "paragraph",
              text:
                "Wenn du das letzte registrierte Mitglied bist oder nur noch unregistrierte Platzhalter übrig sind, löscht Splex die Gruppe. Dafür müssen offene Beträge mit Platzhaltern nicht vorher ausgeglichen sein."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Kann dieselbe Person in einer Gruppe und als Freund Geld schulden?",
          answer:
            "Ja, aber es sind getrennte offene Beträge. Eine direkte Ausgabe mit einem Freund gleicht keine Gruppenausgabe aus, außer du erfasst den passenden Ausgleich auch in der Gruppe."
        },
        {
          question: "Kann ein unregistriertes Mitglied später eingeladen werden?",
          answer:
            "Ja. Nutze dafür die Einladung für genau dieses unregistrierte Mitglied, nicht nur eine allgemeine Gruppeneinladung, wenn die Person den Platzhalter übernehmen soll."
        }
      ]
    }
  },
  {
    key: "currencyCalculator",
    featured: true,
    related: ["addingExpense", "balancesSettlements"],
    en: {
      path: "/docs/currency-calculator/",
      title: "Currency calculator in Splex",
      description:
        "How the Splex currency calculator uses exchange rates, offline cache, daily updates, and stale-rate warnings.",
      eyebrow: "Documentation",
      h1: "The currency calculator is for getting a feel for prices during your trip",
      lead: [
        "The currency calculator is meant for the moment when you are in another country and want to know roughly what a price means in your home currency.",
        "It uses the same exchange-rate snapshot Splex already needs for multi-currency expenses, so it can keep working after the rates have been cached."
      ],
      sections: [
        {
          heading: "What it is useful for",
          blocks: [
            {
              type: "list",
              items: [
                "Checking a restaurant bill, grocery price, ticket, or taxi fare in a currency you are less familiar with.",
                "Comparing a few common amounts without opening a separate converter app.",
                "It also works when you currently have no network."
              ]
            }
          ]
        },
        {
          heading: "How rates are loaded",
          blocks: [
            {
              type: "paragraph",
              text:
                "When the app opens, Splex checks whether exchange rates are already cached on the device. If the cached snapshot is missing or older than 24 hours, it asks the server for a fresh snapshot."
            },
            {
              type: "paragraph",
              text:
                "The server stores complete daily snapshots for the supported currencies. If today's complete snapshot already exists, it reuses it. Otherwise it tries to fetch a new one from the configured currency provider."
            }
          ]
        },
        {
          heading: "Offline behavior",
          blocks: [
            {
              type: "paragraph",
              text:
                "Once rates have been downloaded, they are stored for offline use. If you open the calculator without a connection, Splex can still calculate with the cached snapshot."
            },
            {
              type: "paragraph",
              text:
                "If no rates have ever been cached on that device, the calculator cannot show conversions until the app has been online at least once."
            },
            {
              type: "paragraph",
              text:
                "Keep in mind that the rates can therefore be a little inaccurate."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Are calculator rates exact enough for settling expenses?",
          answer:
            "They are good enough for Splex's internal conversions, but they are still exchange-rate snapshots. Your bank, card provider, or payment app may use a different rate and add fees."
        },
        {
          question: "Does the calculator need internet every time?",
          answer:
            "No. It needs internet to download rates, but cached rates can be used offline afterwards."
        }
      ]
    },
    de: {
      path: "/de/dokumentation/waehrungsrechner/",
      title: "Währungsrechner in Splex",
      description:
        "Wie der Währungsrechner in Splex Wechselkurse, Offline-Cache, tägliche Aktualisierung und Hinweise auf alte Kurse nutzt.",
      eyebrow: "Dokumentation",
      h1: "Der Währungsrechner ist für ein Gefühl für Preise während deines Trips gedacht",
      lead: [
        "Der Währungsrechner hilft in dem Moment, in dem du in einem anderen Land stehst und wissen willst, was ein Preis ungefähr in deiner gewohnten Währung bedeutet.",
        "Er nutzt dieselben Wechselkursdaten, die Splex auch für Ausgaben in mehreren Währungen braucht. Deshalb kann er weiter funktionieren, sobald die Kurse einmal gespeichert wurden."
      ],
      sections: [
        {
          heading: "Wofür er praktisch ist",
          blocks: [
            {
              type: "list",
              items: [
                "Eine Restaurantrechnung, einen Supermarktpreis, ein Ticket oder eine Taxifahrt grob einschätzen.",
                "Ein paar typische Beträge vergleichen, ohne eine separate Währungs-App zu öffnen.",
                "Das Ganze funktioniert auch wenn du gerade kein Netz hast."
              ]
            }
          ]
        },
        {
          heading: "Wie Kurse geladen werden",
          blocks: [
            {
              type: "paragraph",
              text:
                "Beim Öffnen der App prüft Splex, ob Wechselkurse auf dem Gerät gespeichert sind. Fehlt der gespeicherte Stand oder ist er älter als 24 Stunden, fragt die App beim Server nach einem neuen Stand."
            },
            {
              type: "paragraph",
              text:
                "Der Server speichert vollständige Tagesstände für die unterstützten Währungen. Wenn der vollständige Stand für heute schon da ist, wird er wiederverwendet. Sonst versucht der Server, neue Kurse beim konfigurierten Anbieter zu holen."
            }
          ]
        },
        {
          heading: "Offline-Nutzung",
          blocks: [
            {
              type: "paragraph",
              text:
                "Sobald Kurse geladen wurden, werden sie für die Offline-Nutzung gespeichert. Wenn du den Rechner ohne Verbindung öffnest, kann Splex mit dem gespeicherten Stand weiterrechnen."
            },
            {
              type: "paragraph",
              text:
                "Wenn auf diesem Gerät noch nie Kurse gespeichert wurden, kann der Rechner erst etwas anzeigen, nachdem die App mindestens einmal online war."
            },
            {
              type: "paragraph",
              text:
                "Bedenke, dass die Kurse dadurch etwas ungenau sein können."
            }
          ]
        },
      ],
      faq: [
        {
          question: "Sind die Kurse genau genug zum Abrechnen?",
          answer:
            "Für die Umrechnung innerhalb von Splex sind sie gedacht. Es bleiben aber Momentaufnahmen. Deine Bank, Kreditkarte oder Zahlungs-App kann einen anderen Kurs verwenden und Gebühren einrechnen."
        },
        {
          question: "Braucht der Rechner jedes Mal Internet?",
          answer:
            "Nein. Internet wird gebraucht, um Kurse herunterzuladen. Danach können gespeicherte Kurse auch offline verwendet werden."
        }
      ]
    }
  },
  {
    key: "balancesSettlements",
    featured: true,
    related: ["addingExpense", "friendsGroups"],
    en: {
      path: "/docs/balances-and-settlements/",
      title: "Balances and settlements in Splex",
      description:
        "How Splex calculates balances, handles rounding cents, simplifies group debts, records settlements, and shows preferred payment methods.",
      eyebrow: "Documentation",
      h1: "Balances and settlements",
      lead: [
        "A balance is calculated from expenses and settlements in the current group or friendship.",
        "For every expense, Splex stores two sides: who paid money upfront, and who owed which share of the expense."
      ],
      sections: [
        {
          heading: "How an expense becomes a balance",
          blocks: [
            {
              type: "paragraph",
              text:
                "Splex first looks at the payment shares. If one person paid the whole bill, that is simple. If several people paid parts of the bill, Splex treats each payer as having covered that proportion of every owed share."
            },
            {
              type: "paragraph",
              text:
                "Example: Alex and Sam pay 60 and 40 for a 100 bill. Dana owes 50 of that bill. Dana's 50 is split across the payers in the same 60/40 ratio, so Dana owes Alex 30 and Sam 20."
            },
            {
              type: "paragraph",
              text:
                "After that, opposing debts between the same two people are netted. If Alex owes Sam 12 and Sam owes Alex 5, the displayed debt is Alex owes Sam 7."
            }
          ]
        },
        {
          heading: "Where the cents go",
          blocks: [
            {
              type: "paragraph",
              text:
                "Money is stored in cents. When an equal split cannot be divided evenly, Splex distributes the leftover cents deterministically instead of losing them."
            },
            {
              type: "paragraph",
              text:
                "A 10.00 expense split equally between three people becomes 3.34, 3.33, and 3.33. No cent is lost, and no cent is counted twice."
            },
            {
              type: "paragraph",
              text:
                "Exact splits and percentage splits also have to add up to the total after rounding to cents. If they do not, the form shows how much is still missing or over."
            }
          ]
        },
        {
          heading: "How settlements change balances",
          blocks: [
            {
              type: "paragraph",
              text:
                "A settlement is a recorded payment from one participant to another. It subtracts from the debt in that direction. If you record that Alex paid Sam 20, Alex's debt to Sam is reduced by 20."
            },
            {
              type: "paragraph",
              text:
                "The amount you enter can be in another currency. For balances, Splex converts the settlement into the group or friendship currency using the rate for the day the settlement is created."
            },
            {
              type: "paragraph",
              text:
                "Deleting a settlement removes it from the balance calculation, but the activity history still keeps a record that it existed."
            }
          ]
        },
        {
          heading: "Simplified debt",
          blocks: [
            {
              type: "paragraph",
              text:
                "In groups, the normal view can show the real pairwise debts. The simplified view keeps each person's final net balance the same, but reduces the number of payments needed to settle the group."
            },
            {
              type: "paragraph",
              text:
                "Example: Alex owes Bea 5, Bea owes Chris 10, and Chris owes Alex 5. Alex's net is zero, Bea's net is -5, and Chris's net is +5. The simplified result is just: Bea pays Chris 5."
            },
            {
              type: "paragraph",
              text:
                "This does not rewrite old expenses and it does not change any balance. It only changes which settlements are suggested in the balance details."
            }
          ]
        },
        {
          heading: "Preferred payment methods",
          blocks: [
            {
              type: "paragraph",
              text:
                "Each person can save a preferred payment method in their account settings. It tells the people who owe you money how you would like to be paid."
            },
            {
              type: "paragraph",
              text:
                "When someone wants to pay you in the settlement dialog, Splex shows how you would like to receive the payment. Registered people in the same active group or friendship can see your payment method; unrelated users cannot."
            },
            {
              type: "paragraph",
              text:
                "For paypal.me handles, Splex opens a PayPal link with the amount and currency filled in where possible. For PayPal email addresses, Splex shows the email and opens PayPal's normal send-money page. Either way, Splex does not make the payment for you and does not know whether PayPal was completed. You still have to save the settlement in Splex."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Does simplified debt change the balance?",
          answer:
            "No. It changes only the suggested payment path. Each person's net amount stays the same."
        },
        {
          question: "Why can one person get the extra cent in an equal split?",
          answer:
            "Because the total has to add up exactly. Splex stores money in cents, so any leftover cents from an equal split are assigned deterministically instead of disappearing."
        }
      ]
    },
    de: {
      path: "/de/dokumentation/offene-betraege-und-ausgleich/",
      title: "Offene Beträge und Ausgleich in Splex",
      description:
        "Wie Splex berechnet, wer wem noch etwas schuldet, Rundungscent verteilt, Gruppenschulden vereinfacht, Ausgleichszahlungen speichert und bevorzugte Zahlungswege anzeigt.",
      eyebrow: "Dokumentation",
      h1: "Offene Beträge und Ausgleiche",
      lead: [
        "Was offen ist, wird aus Ausgaben und Ausgleichszahlungen in der jeweiligen Gruppe oder Freundschaft berechnet.",
        "Bei jeder Ausgabe speichert Splex zwei Seiten: wer Geld vorgestreckt hat und wer welchen Anteil der Ausgabe schuldet."
      ],
      sections: [
        {
          heading: "Wie aus einer Ausgabe ein offener Betrag wird",
          blocks: [
            {
              type: "paragraph",
              text:
                "Splex schaut zuerst auf die Zahlungsanteile. Wenn eine Person die ganze Rechnung bezahlt hat, ist das einfach. Wenn mehrere Personen Teile bezahlt haben, werden die geschuldeten Anteile im Verhältnis der Zahlungen auf die Zahler verteilt."
            },
            {
              type: "paragraph",
              text:
                "Beispiel: Alex und Sam zahlen 60 und 40 für eine Rechnung über 100. Dana schuldet 50 davon. Diese 50 werden im Verhältnis 60/40 aufgeteilt, also schuldet Dana Alex 30 und Sam 20."
            },
            {
              type: "paragraph",
              text:
                "Danach werden Gegenschulden zwischen denselben zwei Personen verrechnet. Wenn Alex Sam 12 schuldet und Sam Alex 5, bleibt als Anzeige: Alex schuldet Sam 7."
            }
          ]
        },
        {
          heading: "Was mit einzelnen Cent passiert",
          blocks: [
            {
              type: "paragraph",
              text:
                "Geld wird in Cent gespeichert. Wenn eine gleiche Aufteilung nicht glatt aufgeht, verteilt Splex die übrigen Cent eindeutig, statt sie verschwinden zu lassen."
            },
            {
              type: "paragraph",
              text:
                "Eine Ausgabe über 10,00, gleichmäßig auf drei Personen verteilt, wird zu 3,34, 3,33 und 3,33. Es geht also kein Cent verloren und es wird auch kein Cent doppelt gerechnet."
            },
            {
              type: "paragraph",
              text:
                "Exakte und prozentuale Aufteilungen müssen nach Rundung auf Cent ebenfalls zur Gesamtsumme passen. Wenn etwas fehlt oder zu viel verteilt wurde, zeigt das Formular den Restbetrag an."
            }
          ]
        },
        {
          heading: "Wie Ausgleichszahlungen offene Beträge verändern",
          blocks: [
            {
              type: "paragraph",
              text:
                "Ein Ausgleich ist eine gespeicherte Zahlung von einer Person an eine andere. Er reduziert die Schuld in dieser Richtung. Wenn du speicherst, dass Alex Sam 20 bezahlt hat, sinkt Alex' Schuld gegenüber Sam um 20."
            },
            {
              type: "paragraph",
              text:
                "Du kannst den Ausgleich in einer anderen Währung eintragen. Für den offenen Betrag rechnet Splex den Betrag in die Währung der Gruppe oder Freundschaft um, und zwar mit dem Kurs des Tages, an dem der Ausgleich erstellt wird."
            },
            {
              type: "paragraph",
              text:
                "Wenn du einen Ausgleich löschst, zählt er nicht mehr in die offenen Beträge hinein. Im Aktivitätsverlauf bleibt aber sichtbar, dass es diesen Eintrag gab."
            }
          ]
        },
        {
          heading: "Vereinfachte Schulden",
          blocks: [
            {
              type: "paragraph",
              text:
                "In Gruppen kann die normale Ansicht die echten paarweisen Schulden zeigen. Die vereinfachte Ansicht lässt gleich, wer am Ende wie viel zahlen oder bekommen soll, reduziert aber die Anzahl der Zahlungen, die zum Ausgleichen nötig sind."
            },
            {
              type: "paragraph",
              text:
                "Beispiel: Alex schuldet Bea 5, Bea schuldet Chris 10 und Chris schuldet Alex 5. Alex bekommt also unterm Strich nichts, Bea muss 5 zahlen und Chris bekommt 5. Vereinfacht bleibt nur: Bea zahlt Chris 5."
            },
            {
              type: "paragraph",
              text:
                "Dabei werden keine alten Ausgaben umgeschrieben und kein offener Betrag verändert. Es ändert sich nur, welche Ausgleichszahlungen in den Details vorgeschlagen werden."
            }
          ]
        },
        {
          heading: "Bevorzugte Zahlungsmethoden",
          blocks: [
            {
              type: "paragraph",
              text:
                "Jede Person kann in den Kontoeinstellungen eine bevorzugte Zahlungsmethode hinterlegen. Sie sagt den Leuten, die dir Geld schulden, wie du gerne bezahlt werden möchtest."
            },
            {
              type: "paragraph",
              text:
                "Wenn jemand im Ausgleichsdialog Geld an dich zahlen will, zeigt Splex, auf welche Weise du bezahlt werden möchtest. Registrierte Personen in derselben aktiven Gruppe oder Freundschaft dürfen deine Zahlungsmethode sehen, fremde Nutzer nicht."
            },
            {
              type: "paragraph",
              text:
                "Bei paypal.me-Handles öffnet Splex, wenn möglich, einen PayPal-Link mit Betrag und Währung. Bei PayPal-E-Mail-Adressen zeigt Splex die E-Mail an und öffnet die normale PayPal-Seite zum Geld senden. In beiden Fällen überweist Splex nichts selbst und weiß nicht, ob die Zahlung bei PayPal abgeschlossen wurde. Den Ausgleich musst du anschließend in Splex speichern."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Verändert die Vereinfachung, wer wie viel schuldet?",
          answer:
            "Nein. Sie verändert nur den vorgeschlagenen Zahlungsweg. Der Nettobetrag jeder Person bleibt gleich."
        },
        {
          question: "Warum bekommt eine Person bei gleicher Aufteilung den extra Cent?",
          answer:
            "Weil die Summe exakt stimmen muss. Splex speichert Geld in Cent, deshalb werden übrige Cent eindeutig zugeteilt, statt verloren zu gehen."
        }
      ]
    }
  },
  {
    key: "addingExpense",
    featured: true,
    related: ["balancesSettlements", "currencyCalculator"],
    en: {
      path: "/docs/adding-expenses/",
      title: "Adding expenses in Splex",
      description:
        "How expense entry works in Splex: nearby suggestions, calculator fields, currencies, split methods, multiple payers, locations, receipts, and offline sync.",
      eyebrow: "Documentation",
      h1: "Adding expenses in Splex",
      lead: [
        "The add-expense screen decides how a real bill becomes ledger rows: amount, currency, payers, owed shares, date, location, and optional receipts.",
        "Most fields are simple on purpose, but a few details are worth knowing because they affect the final balance."
      ],
      sections: [
        {
          heading: "Who can add or edit group expenses",
          blocks: [
            {
              type: "paragraph",
              text:
                "Inside a group, every member has the same access to the shared expense ledger. There is no owner-only mode for expenses: any active group member can add an expense, edit an existing group expense, or record a settlement."
            },
            {
              type: "paragraph",
              text:
                "That is intentional for small shared groups, where the person who notices a mistake should be able to fix it. The safety net is the activity history: Splex records who created, changed, or deleted a ledger entry."
            }
          ]
        },
        {
          heading: "Suggested descriptions from nearby places",
          blocks: [
            {
              type: "paragraph",
              text:
                "If location tracking is enabled and the device can provide a current position, Splex asks for suggestions within about 100 meters of that position."
            },
            {
              type: "paragraph",
              text:
                "The suggestions come from your own previous expenses that have saved coordinates near you. Splex walks newest expenses first, removes duplicate descriptions, and shows up to five suggestions. It is not a public place search and it does not query a map provider for restaurant names."
            },
            {
              type: "paragraph",
              text:
                "If location permission is missing, the device cannot get a position, or the request fails, the description field simply behaves like a normal text field."
            }
          ]
        },
        {
          heading: "The calculator in money fields",
          blocks: [
            {
              type: "paragraph",
              text:
                "Money fields have a calculator button that opens a calculator. You can calculate a value before entering it, without switching to another calculator app."
            },
            {
              type: "paragraph",
              text:
                "When you apply the result, the calculator writes it back into the field."
            },
            {
              type: "paragraph",
              text:
                "This is useful for receipts with subtotals, tips, partial reimbursements, or multi-payer amounts where you want to calculate the value directly in the field."
            }
          ]
        },
        {
          heading: "Currencies and the date of the expense",
          blocks: [
            {
              type: "paragraph",
              text:
                "The amount you enter stays visible in the original currency. For balances, Splex converts it into the group or friendship currency."
            },
            {
              type: "paragraph",
              text:
                "The conversion uses the expense date, not necessarily today's date. If an exact historical rate is not available, Splex falls back to the nearest cached rate it can use, and stores which rate date was actually used. The date is shown later in the expense detail view."
            },
            {
              type: "paragraph",
              text:
                "Costs and exact splits are entered in the original expense currency. The stored shares are saved in the currency of the group or friendship."
            }
          ]
        },
        {
          heading: "Split methods",
          blocks: [
            {
              type: "list",
              items: [
                "Equal: split the full amount between everyone, or only the selected participants. Use it for shared meals, taxis, groceries, or any bill where everyone should pay the same share.",
                "Exact: enter the exact amount each person owes. Use it when each participant takes over a specific part of the bill. For example, person A only pays for a drink and person B pays for a much more expensive meal.",
                "Percentage: enter percentages that must add up to 100. Use it for rent, utilities, or any recurring cost where shares are defined as percentages.",
                "Adjusted equal: before the bill is split equally, you can set that some people take over more or less of the bill. For example, if three people spent 60 in a pub, the drinks should be split equally, but person C also had food worth 12 that they should pay for themselves. Enter 12 as an adjustment for person C. Person C then pays 28 (12 for the food plus 16 for the drinks), while persons A and B each pay 16. Adjustments can also be negative. Use this when almost everything is shared, but someone had an extra item or should pay less."
              ]
            },
            {
              type: "paragraph",
              text:
                "Splex checks the split before saving, so every cent of the bill is actually assigned and the numbers add up."
            }
          ]
        },
        {
          heading: "Multiple payers",
          blocks: [
            {
              type: "paragraph",
              text:
                "An expense can have one payer or multiple payers. In single-payer mode, Splex stores that person as having paid the full amount. In multi-payer mode, the entered payer amounts must add up to the expense total."
            },
            {
              type: "paragraph",
              text:
                "Multiple payers do not change what people owe; they change who already covered money. If Alex paid 70 and Bea paid 30 for a 100 expense, Splex uses those proportions when turning owed shares into debts."
            },
            {
              type: "paragraph",
              text:
                "This is useful when several people paid at the counter, contributed cash, or split one larger card payment before the expense was entered."
            }
          ]
        },
        {
          heading: "When a location is saved",
          blocks: [
            {
              type: "paragraph",
              text:
                "A location is only sent when location tracking is enabled in the account, the device provides a usable coordinate, and the location switch in the expense is on."
            },
            {
              type: "paragraph",
              text:
                "For a new expense, turning the location switch off means no location is stored. When editing an existing expense, leaving the switch on keeps the existing location unchanged; turning it off removes the saved location."
            },
            {
              type: "paragraph",
              text:
                "If the expense date is in the past or future, Splex assumes that you are not currently at the place of the expense and does not save a location."
            }
          ]
        },
        {
          heading: "Offline sync",
          blocks: [
            {
              type: "paragraph",
              text:
                "If creating a new expense fails because you are offline, Splex stores a pending create mutation on the device. The draft appears immediately in the activity feed and in the group or friend page as pending sync, and the overview shows a pending count."
            },
            {
              type: "paragraph",
              text:
                "Pending expenses are not part of the balance yet. The balance can therefore look wrong until the expense has synced successfully. You can open the draft, retry sync, or delete it."
            },
            {
              type: "paragraph",
              text:
                "Splex makes sure that the expense is not accidentally created twice when the connection is bad."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Can I edit an expense while it is still pending sync?",
          answer:
            "You can open the pending draft from the pending entry. Saving it updates the queued mutation on the device; it still needs to sync before it affects server balances."
        },
        {
          question: "Do nearby suggestions use public places?",
          answer:
            "No. They are based on your own previous geotagged expense descriptions near your current position."
        }
      ]
    },
    de: {
      path: "/de/dokumentation/ausgaben-erfassen/",
      title: "Ausgaben in Splex erfassen",
      description:
        "Wie das Erfassen von Ausgaben funktioniert: Vorschläge in der Nähe, Rechner, Währungen, Aufteilungen, mehrere Zahler, Standort, Belege und Offline-Sync.",
      eyebrow: "Dokumentation",
      h1: "Ausgaben in Splex erfassen",
      lead: [
        "Im Ausgabenformular wird aus einer echten Rechnung ein Eintrag in Splex: Betrag, Währung, Zahler, geschuldete Anteile, Datum, Standort und optional Belege.",
        "Die meisten Felder sind bewusst einfach. Ein paar Details sind trotzdem wichtig, weil sie beeinflussen, wer wem später etwas schuldet."
      ],
      sections: [
        {
          heading: "Wer Gruppenausgaben erfassen oder bearbeiten kann",
          blocks: [
            {
              type: "paragraph",
              text:
                "In einer Gruppe haben alle Mitglieder denselben Zugriff auf den gemeinsamen Ausgabenverlauf. Es gibt keinen Besitzer-Modus nur für Ausgaben: Jedes aktive Gruppenmitglied kann eine Ausgabe hinzufügen, eine bestehende Gruppenausgabe bearbeiten oder einen Ausgleich eintragen."
            },
            {
              type: "paragraph",
              text:
                "Das ist für kleine gemeinsame Gruppen gedacht, in denen die Person, die einen Fehler sieht, ihn auch direkt korrigieren können soll. Der Schutz liegt im Aktivitätsverlauf: Splex speichert, wer einen Eintrag erstellt, geändert oder gelöscht hat."
            }
          ]
        },
        {
          heading: "Beschreibungsvorschläge aus der Nähe",
          blocks: [
            {
              type: "paragraph",
              text:
                "Wenn Standorttracking aktiviert ist und das Gerät eine aktuelle Position liefern kann, fragt Splex nach Vorschlägen im Umkreis von ungefähr 100 Metern."
            },
            {
              type: "paragraph",
              text:
                "Die Vorschläge kommen aus deinen eigenen früheren Ausgaben mit gespeichertem Standort in der Nähe. Splex geht die neuesten Ausgaben zuerst durch und zeigt bis zu fünf Vorschläge. Es ist keine öffentliche Ortssuche und Splex fragt dafür keinen Kartendienst nach Restaurantnamen."
            },
            {
              type: "paragraph",
              text:
                "Wenn die Standortberechtigung fehlt, das Gerät keine Position findet oder die Anfrage fehlschlägt, ist das Beschreibungsfeld einfach ein normales Textfeld."
            }
          ]
        },
        {
          heading: "Der Rechner in Geldfeldern",
          blocks: [
            {
              type: "paragraph",
              text:
                "Geldfelder haben einen Rechner-Button, der einen Rechner öffnet. Damit kannst du einen Wert berechnen, bevor du ihn eingibst, ohne in eine andere Rechner-App wechseln zu müssen."
            },
            {
              type: "paragraph",
              text:
                "Beim Übernehmen schreibt der Rechner das Ergebnis zurück ins Feld."
            },
            {
              type: "paragraph",
              text:
                "Das ist praktisch für Belege mit Zwischensummen, Trinkgeld, Teilbeträge oder mehrere Zahler, wenn du den Betrag direkt im Feld ausrechnen willst."
            }
          ]
        },
        {
          heading: "Währungen und das Ausgabendatum",
          blocks: [
            {
              type: "paragraph",
              text:
                "Der eingegebene Betrag bleibt in der Originalwährung sichtbar. Für den offenen Betrag rechnet Splex ihn in die Währung der Gruppe oder Freundschaft um."
            },
            {
              type: "paragraph",
              text:
                "Für die Umrechnung zählt das Ausgabendatum, nicht zwingend der heutige Tag. Wenn kein exakter historischer Kurs vorhanden ist, nutzt Splex den nächsten gespeicherten Kurs, den es verwenden kann, und speichert mit, welches Kursdatum tatsächlich genutzt wurde. Das Datum wird später in der Detailansicht der Ausgabe angezeigt."
            },
            {
              type: "paragraph",
              text:
                "Kosten und exakte Aufteilungen gibst du in der Originalwährung der Ausgabe ein. Gespeichert werden die Anteile in der Währung der Gruppe oder Freundschaft."
            }
          ]
        },
        {
          heading: "Aufteilungsarten",
          blocks: [
            {
              type: "list",
              items: [
                "Gleich: den Betrag auf alle oder nur auf ausgewählte Personen gleichmäßig verteilen. Passt für Essen, Taxis, Einkäufe oder alles, wo alle denselben Anteil zahlen sollen.",
                "Exakt: pro Person den genauen geschuldeten Betrag eintragen. Passt, wenn zum Beispiel jeder Teilnehmer eine Position der Rechnung übernimmt. Zum Beispiel Person A zahlt nur ein Getränk und Person B zahlt ein viel teureres Essen.",
                "Prozentual: Prozentwerte eintragen, die zusammen 100 ergeben müssen. Passt für Miete, Nebenkosten oder wiederkehrende Kosten mit festen Anteilen.",
                "Gleichmäßig angepasst: Bevor die Rechnung gleichmäßig aufgeteilt wird, kann eingestellt werden, dass Personen mehr oder weniger von der Rechnung übernehmen. Beispielsweise wenn 3 Personen für 60€ in einem Pub waren, die Getränke gleichmäßig aufgeteilt werden sollen, aber Person C zusätzlich noch ein Essen im Wert von 12€ hatte, welches sie selbst bezahlen soll. Hier werden die 12€ einfach als Anpassung für Person C eingetragen. Person C zahlt dann 28€ (12€ für das Essen + 16€ für die Getränke), Person A und B jeweils 16€. Die Anpassungen können auch negativ sein. Passt, wenn fast alles gemeinsam ist, aber jemand einen Zusatzposten hatte oder weniger zahlen soll."
              ]
            },
            {
              type: "paragraph",
              text:
                "Splex prüft die Aufteilung vor dem Speichern, dass auch wirklich jeder Cent der Rechnung aufgeteilt ist und alles zusammen passt."
            }
          ]
        },
        {
          heading: "Mehrere Zahler",
          blocks: [
            {
              type: "paragraph",
              text:
                "Eine Ausgabe kann einen Zahler oder mehrere Zahler haben. Bei mehreren Zahlern müssen die eingetragenen Zahlungen zusammen die Ausgabensumme ergeben."
            },
            {
              type: "paragraph",
              text:
                "Mehrere Zahler ändern nicht, wer welchen Anteil schuldet. Sie ändern nur, wer bereits Geld vorgestreckt hat. Wenn Alex 70 und Bea 30 für eine Ausgabe über 100 bezahlt haben, nutzt Splex dieses Verhältnis, um die geschuldeten Anteile in Schulden umzuwandeln."
            },
            {
              type: "paragraph",
              text:
                "Das ist nützlich, wenn mehrere Leute an der Kasse gezahlt haben, Bargeld zusammengelegt wurde oder eine größere Kartenzahlung schon vor dem Eintragen aufgeteilt war."
            }
          ]
        },
        {
          heading: "Wann ein Standort gespeichert wird",
          blocks: [
            {
              type: "paragraph",
              text:
                "Ein Standort wird nur gesendet, wenn Standorttracking im Konto aktiviert ist, das Gerät eine brauchbare Koordinate liefert und der Standort-Schalter in der Ausgabe aktiv ist."
            },
            {
              type: "paragraph",
              text:
                "Bei einer neuen Ausgabe bedeutet ein ausgeschalteter Standort-Schalter: Es wird kein Standort gespeichert. Beim Bearbeiten einer bestehenden Ausgabe lässt ein eingeschalteter Schalter den vorhandenen Standort unverändert; ein ausgeschalteter Schalter entfernt ihn."
            },
            {
              type: "paragraph",
              text:
                "Wenn das Datum der Ausgabe in der Vergangenheit oder Zukunft liegt, wird davon ausgegangen, dass du gerade nicht vor Ort bist, und es wird kein Standort gespeichert."
            }
          ]
        },
        {
          heading: "Offline-Sync",
          blocks: [
            {
              type: "paragraph",
              text:
                "Wenn das Erstellen einer neuen Ausgabe fehlschlägt weil du offline bist, speichert Splex eine ausstehende Erstellung auf dem Gerät. Der Entwurf erscheint sofort im Aktivitätsverlauf und in der Gruppen- oder Freundesansicht als ausstehende Synchronisierung; in der Übersicht siehst du außerdem eine Anzahl ausstehender Einträge."
            },
            {
              type: "paragraph",
              text:
                "Ausstehende Ausgaben sind noch nicht Teil der offenen Beträge. Deshalb kann es falsch wirken, wer wem etwas schuldet, bis die Ausgabe erfolgreich synchronisiert wurde. Du kannst den Entwurf öffnen, die Synchronisierung erneut versuchen oder ihn löschen."
            },
            {
              type: "paragraph",
              text:
                "Es ist sichergestellt, dass die Ausgabe bei schlechter Verbindung nicht aus Versehen doppelt erstellt wird."
            }
          ]
        }
      ],
      faq: [
        {
          question: "Kann ich eine Ausgabe bearbeiten, solange sie noch nicht synchronisiert ist?",
          answer:
            "Du kannst den ausstehenden Entwurf öffnen. Speichern aktualisiert die ausstehende Änderung auf dem Gerät; wer wem etwas schuldet, ändert sich aber erst nach erfolgreicher Synchronisierung."
        },
        {
          question: "Nutzen Vorschläge aus der Nähe öffentliche Orte?",
          answer:
            "Nein. Sie basieren auf deinen eigenen früheren Ausgaben mit gespeichertem Standort in deiner Nähe."
        }
      ]
    }
  }
];

export const documentationPageKeys = documentationPages.map((page) => page.key);

export function getDocumentationPage(key: DocumentationPageKey): DocumentationPageEntry {
  const page = documentationPages.find((candidate) => candidate.key === key);
  if (!page) throw new Error(`Unknown documentation page: ${key}`);
  return page;
}

export function localizedDocumentationPage(
  key: DocumentationPageKey,
  lang: Lang,
): LocalizedContentPage {
  const page = getDocumentationPage(key);
  return page[lang];
}

export function documentationPagePaths(key: DocumentationPageKey): Record<Lang, string> {
  const page = getDocumentationPage(key);
  return { en: page.en.path, de: page.de.path };
}

export function relatedDocumentationPages(key: DocumentationPageKey): DocumentationPageEntry[] {
  return getDocumentationPage(key).related.map(getDocumentationPage);
}

export function featuredDocumentationPages(): DocumentationPageEntry[] {
  return documentationPages.filter((page) => page.featured);
}
