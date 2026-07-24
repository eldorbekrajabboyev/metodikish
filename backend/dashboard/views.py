from decimal import Decimal
from django.db import models
from rest_framework import permissions
from rest_framework.generics import GenericAPIView
from accounts.permissions import IsAdminPermission
from api.utils import success_response
from orders.models import Order
from payments.models import Payment
from .serializers import DashboardStatsSerializer

class DashboardStatsView(GenericAPIView):
    serializer_class = DashboardStatsSerializer
    permission_classes = [IsAdminPermission]

    def get(self, request, *args, **kwargs):
        order_stats = Order.objects.aggregate(
            total=models.Count('id'),
            pending=models.Count('id', filter=models.Q(status=Order.Status.PENDING)),
            payment_checking=models.Count('id', filter=models.Q(status=Order.Status.PAYMENT_CHECKING)),
            paid=models.Count('id', filter=models.Q(status=Order.Status.PAID)),
            rejected=models.Count('id', filter=models.Q(status=Order.Status.REJECTED)),
            completed=models.Count('id', filter=models.Q(status=Order.Status.COMPLETED)),
        )
        total_revenue = Payment.objects.filter(status=Payment.Status.APPROVED).aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        data = {
            'total_orders': order_stats['total'],
            'pending_orders': order_stats['pending'] + order_stats['payment_checking'],
            'paid_orders': order_stats['paid'],
            'rejected_orders': order_stats['rejected'],
            'completed_orders': order_stats['completed'],
            'total_revenue': total_revenue,
        }
        serializer = self.get_serializer(data)
        return success_response(data=serializer.data, message='Dashboard stats retrieved successfully')