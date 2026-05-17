from django.urls import path

from splex.expenses.api.views import ExpenseDetailView

urlpatterns = [path("expenses/<int:expense_id>/", ExpenseDetailView.as_view())]

