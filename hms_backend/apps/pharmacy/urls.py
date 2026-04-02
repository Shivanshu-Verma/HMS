"""URL routes for the pharmacy app."""
from django.urls import path
from apps.pharmacy.views import (
    PharmacyQueueView,
    PharmacySessionDetailView,
    PharmacyMedicineSearchView,
    PharmacyDispenseView,
    PharmacyCheckoutView,
    PharmacyDebtPaymentView,
    PharmacyInventoryView,
    PharmacyInventoryItemView,
    PharmacyAddStockView,
    PharmacyReportsView,
)

app_name = 'pharmacy'

urlpatterns = [
    path('pharmacy/queue/', PharmacyQueueView.as_view(), name='pharmacy-queue'),
    path('pharmacy/session/<str:session_id>/', PharmacySessionDetailView.as_view(), name='pharmacy-session-detail'),
    path('pharmacy/medicines/search/', PharmacyMedicineSearchView.as_view(), name='pharmacy-medicine-search'),
    path('pharmacy/session/<str:session_id>/dispense/', PharmacyDispenseView.as_view(), name='pharmacy-dispense'),
    path('pharmacy/session/<str:session_id>/checkout/', PharmacyCheckoutView.as_view(), name='pharmacy-checkout'),
    path('pharmacy/debt-payment/', PharmacyDebtPaymentView.as_view(), name='pharmacy-debt-payment'),
    path('pharmacy/inventory/', PharmacyInventoryView.as_view(), name='pharmacy-inventory'),
    path('pharmacy/inventory/<str:medicine_id>/', PharmacyInventoryItemView.as_view(), name='pharmacy-inventory-item'),
    path('pharmacy/inventory/<str:medicine_id>/stock/', PharmacyAddStockView.as_view(), name='pharmacy-add-stock'),
    path('pharmacy/reports/', PharmacyReportsView.as_view(), name='pharmacy-reports'),
]
