from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser
from api.utils import success_response
from .models import Payment
from .serializers import PaymentUploadSerializer, PaymentReadSerializer

class PaymentUploadView(generics.CreateAPIView):
    serializer_class = PaymentUploadSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return success_response(message='Validation error', errors=serializer.errors, status_code=400)
        payment = serializer.save()
        read_serializer = PaymentReadSerializer(payment)
        return success_response(data=read_serializer.data, message='Payment uploaded successfully', status_code=201)

class PaymentDetailView(generics.RetrieveAPIView):
    serializer_class = PaymentReadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Payment.objects.select_related('order')
        if not self.request.user.is_admin:
            qs = qs.filter(order__user=self.request.user)
        return qs

    def retrieve(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
        except Payment.DoesNotExist:
            return success_response(message='Payment not found', status_code=404)
        serializer = self.get_serializer(instance)
        return success_response(data=serializer.data, message='Payment retrieved successfully')