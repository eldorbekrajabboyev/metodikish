from rest_framework import serializers
from .models import Payment

def mask_card_number(card_number):
    if not card_number:
        return '****'
    cleaned = card_number.replace(' ', '')
    if len(cleaned) < 4:
        return '****'
    return '**** **** **** ' + cleaned[-4:]

class PaymentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ('order', 'amount', 'card_number', 'receipt_image')

    def validate_order(self, value):
        if Payment.objects.filter(order=value).exists():
            raise serializers.ValidationError('Payment already exists for this order.')
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than 0.')
        return value

    def validate_card_number(self, value):
        if not value.strip():
            raise serializers.ValidationError('Card number cannot be empty.')
        cleaned = value.replace(' ', '')
        if not cleaned.isdigit() or len(cleaned) < 16:
            raise serializers.ValidationError('Invalid card number.')
        return cleaned

    def validate_receipt_image(self, value):
        if not value:
            raise serializers.ValidationError('Receipt image is required.')
        return value

class PaymentReadSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    card_number = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ('id', 'order', 'order_number', 'amount', 'card_number', 'receipt_image', 'status', 'admin_comment', 'created_at', 'updated_at')
        read_only_fields = fields

    def get_card_number(self, obj):
        return mask_card_number(obj.card_number)