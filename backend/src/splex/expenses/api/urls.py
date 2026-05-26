from django.urls import path

from splex.expenses.api.receipt_views import (
    ReceiptDetailView,
    ReceiptDownloadView,
    ReceiptUploadView,
)
from splex.expenses.api.views import ExpenseDetailView, LocationSuggestionsView

urlpatterns = [
    path("expenses/location-suggestions/", LocationSuggestionsView.as_view()),
    path("expenses/<int:expense_id>/", ExpenseDetailView.as_view()),
    path("receipts/", ReceiptUploadView.as_view()),
    path("receipts/<int:receipt_id>/", ReceiptDetailView.as_view()),
    path("receipts/<int:receipt_id>/download/", ReceiptDownloadView.as_view()),
]

