"""URL routes for the pharmacy app."""
from django.urls import path
from apps.pharmacy.views import (
    PharmacyQueueView, DispenseDetailView, DispenseView,
    CloseVisitView, InventoryListView, AddStockView,
    AddMedicineView, PharmacyHistoryView,
)

app_name = 'pharmacy'

urlpatterns = [
    path('pharmacy/queue', PharmacyQueueView.as_view(), name='pharmacy-queue'),
    path('pharmacy/dispense/<str:session_id>', DispenseDetailView.as_view(), name='dispense-detail'),
    path('pharmacy/dispense/<str:session_id>/submit', DispenseView.as_view(), name='dispense-submit'),
    path('pharmacy/visits/<str:session_id>/close', CloseVisitView.as_view(), name='close-visit'),
    path('pharmacy/inventory', InventoryListView.as_view(), name='inventory-list'),
    path('pharmacy/inventory/add', AddMedicineView.as_view(), name='add-medicine'),
    path('pharmacy/inventory/<str:medicine_id>/stock', AddStockView.as_view(), name='add-stock'),
    path('pharmacy/history', PharmacyHistoryView.as_view(), name='pharmacy-history'),
]
