"""Push notification text templates keyed by event_type and locale.

The frontend has its own i18n table for the in-app activity feed. Push titles/bodies
are rendered server-side so the OS notification banner has real text instead of an
i18n key, and per user's stored `locale` field. Falls back to English if the locale
or event_type is missing.
"""

from string import Formatter

_TEMPLATES: dict[str, dict[str, tuple[str, str]]] = {
    "en": {
        "expense.created": (
            "New expense",
            "{actor} added \"{description}\" ({amount} {currency}) in {context}",
        ),
        "expense.updated": (
            "Expense updated",
            "{actor} updated \"{description}\" ({amount} {currency}) in {context}",
        ),
        "expense.deleted": ("Expense deleted", "{actor} deleted \"{description}\" in {context}"),
        "settlement.created": (
            "Settlement recorded",
            "{actor} settled {amount} {currency} in {context}",
        ),
        "settlement.updated": (
            "Settlement updated",
            "{actor} updated a settlement ({amount} {currency}) in {context}",
        ),
        "settlement.deleted": ("Settlement deleted", "{actor} removed a settlement in {context}"),
        "group.created": ("Group created", "{actor} created the group {context}"),
        "group.updated": ("Group updated", "{actor} updated the group {context}"),
        "group.deleted": ("Group deleted", "{actor} deleted the group {context}"),
        "group.member_added": ("Member added", "{actor} added a member to {context}"),
        "group.member_removed": ("Member removed", "{actor} removed a member from {context}"),
        "group.member_invited": ("Member invited", "{actor} invited someone to {context}"),
        "group.member_joined": ("Member joined", "Someone joined {context}"),
        "group.member_renamed": ("Member renamed", "{actor} renamed a member in {context}"),
        "friend.invited": ("Friend invited", "{actor} invited you to be friends"),
        "friend.accepted": ("Friend added", "{actor} accepted your friend invite"),
        "invitation.accepted": ("Invitation accepted", "{actor} joined via your invite"),
    },
    "de": {
        "expense.created": (
            "Neue Ausgabe",
            "{actor} hat \"{description}\" ({amount} {currency}) in {context} hinzugefügt",
        ),
        "expense.updated": (
            "Ausgabe aktualisiert",
            "{actor} hat \"{description}\" ({amount} {currency}) in {context} aktualisiert",
        ),
        "expense.deleted": (
            "Ausgabe gelöscht",
            "{actor} hat \"{description}\" in {context} gelöscht",
        ),
        "settlement.created": (
            "Ausgleich verbucht",
            "{actor} hat {amount} {currency} in {context} ausgeglichen",
        ),
        "settlement.updated": (
            "Ausgleich aktualisiert",
            "{actor} hat einen Ausgleich ({amount} {currency}) in {context} aktualisiert",
        ),
        "settlement.deleted": (
            "Ausgleich entfernt",
            "{actor} hat einen Ausgleich in {context} entfernt",
        ),
        "group.created": ("Gruppe erstellt", "{actor} hat die Gruppe {context} erstellt"),
        "group.updated": ("Gruppe aktualisiert", "{actor} hat die Gruppe {context} aktualisiert"),
        "group.deleted": ("Gruppe gelöscht", "{actor} hat die Gruppe {context} gelöscht"),
        "group.member_added": (
            "Mitglied hinzugefügt",
            "{actor} hat ein Mitglied zu {context} hinzugefügt",
        ),
        "group.member_removed": (
            "Mitglied entfernt",
            "{actor} hat ein Mitglied aus {context} entfernt",
        ),
        "group.member_invited": (
            "Einladung verschickt",
            "{actor} hat jemanden zu {context} eingeladen",
        ),
        "group.member_joined": ("Mitglied beigetreten", "Jemand ist {context} beigetreten"),
        "group.member_renamed": (
            "Mitglied umbenannt",
            "{actor} hat ein Mitglied in {context} umbenannt",
        ),
        "friend.invited": ("Freund eingeladen", "{actor} möchte mit dir befreundet sein"),
        "friend.accepted": (
            "Freundschaft bestätigt",
            "{actor} hat deine Freundschaftsanfrage angenommen",
        ),
        "invitation.accepted": ("Einladung angenommen", "{actor} ist über deinen Link beigetreten"),
    },
}


class _SafeDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def _render(template: str, payload: dict) -> str:
    try:
        return Formatter().vformat(template, (), _SafeDict(payload or {}))
    except (KeyError, IndexError, ValueError):
        return template


def render_notification(event_type: str, payload: dict, locale: str) -> tuple[str, str]:
    """Return (title, body) for a notification, falling back to English."""
    table = _TEMPLATES.get(locale) or _TEMPLATES["en"]
    title_tmpl, body_tmpl = table.get(event_type) or _TEMPLATES["en"].get(event_type) or (
        event_type,
        "",
    )
    return _render(title_tmpl, payload), _render(body_tmpl, payload)
