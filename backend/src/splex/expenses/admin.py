from django.contrib import admin

from splex.shared.admin import NoAddNoDeleteAdminMixin

from .models import Expense, ExpenseOwedShare, ExpensePaymentShare, Receipt


class ExpensePaymentShareInline(admin.TabularInline):
    model = ExpensePaymentShare
    extra = 0
    raw_id_fields = ("participant",)


class ExpenseOwedShareInline(admin.TabularInline):
    model = ExpenseOwedShare
    extra = 0
    raw_id_fields = ("participant",)


@admin.register(Expense)
class ExpenseAdmin(NoAddNoDeleteAdminMixin, admin.ModelAdmin):
    date_hierarchy = "date"
    list_display = (
        "id",
        "description",
        "date",
        "original_amount",
        "original_currency",
        "split_method",
        "group",
        "friendship",
        "created_by",
        "deleted_at",
    )
    list_filter = ("split_method", "original_currency", "deleted_at", "date")
    search_fields = ("description", "client_id", "group__name", "created_by__email")
    raw_id_fields = ("group", "friendship", "created_by")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ExpensePaymentShareInline, ExpenseOwedShareInline)


@admin.register(ExpensePaymentShare)
class ExpensePaymentShareAdmin(admin.ModelAdmin):
    list_display = ("id", "expense", "participant", "amount", "currency")
    search_fields = ("expense__description", "participant__display_name")
    raw_id_fields = ("expense", "participant")


@admin.register(ExpenseOwedShare)
class ExpenseOwedShareAdmin(admin.ModelAdmin):
    list_display = ("id", "expense", "participant", "amount", "currency")
    search_fields = ("expense__description", "participant__display_name")
    raw_id_fields = ("expense", "participant")


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "original_filename",
        "content_type",
        "size_bytes",
        "expense",
        "group",
        "uploaded_by",
        "created_at",
    )
    list_filter = ("content_type",)
    search_fields = ("original_filename", "client_id", "uploaded_by__email")
    raw_id_fields = ("expense", "group", "friendship", "uploaded_by")
    readonly_fields = ("created_at", "updated_at")
