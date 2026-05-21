from django.urls import path

from splex.expenses.api.views import ExpenseDetailView, LocationSuggestionsView

urlpatterns = [
    path("expenses/location-suggestions/", LocationSuggestionsView.as_view()),
    path("expenses/<int:expense_id>/", ExpenseDetailView.as_view()),
]

