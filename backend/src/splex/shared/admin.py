from django.contrib import admin

from .models import PeriodicTask


class NoAddNoDeleteAdminMixin:
    """Makes an admin view/edit-only.

    Financial and ledger models (expenses, settlements, participants, groups)
    have soft-delete semantics and service-layer invariants the admin does not
    understand. Adding rows by hand or hard-deleting them (which cascades to
    shares/memberships and trips PROTECT FKs) is an easy way to corrupt the
    ledger, so creation and deletion are disabled here - the admin stays useful
    for inspection and the occasional field fix without being a footgun.
    """

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PeriodicTask)
class PeriodicTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "last_run_at")
    search_fields = ("name",)
