from rest_framework import serializers
from .models import Order

class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ('full_name', 'region', 'district', 'school_name', 'home_address', 'subject', 'grade', 'topic')
        read_only_fields = ('price',)

    def _validate_not_empty(self, value, field_name):
        if not value or not value.strip():
            raise serializers.ValidationError(f'{field_name} cannot be empty.')
        return value.strip()

    def validate_full_name(self, value):
        return self._validate_not_empty(value, 'Full name')
    def validate_region(self, value):
        return self._validate_not_empty(value, 'Region')
    def validate_district(self, value):
        return self._validate_not_empty(value, 'District')
    def validate_school_name(self, value):
        return self._validate_not_empty(value, 'School name')
    def validate_home_address(self, value):
        return self._validate_not_empty(value, 'Home address')
    def validate_subject(self, value):
        return self._validate_not_empty(value, 'Subject')
    def validate_grade(self, value):
        return self._validate_not_empty(value, 'Grade')
    def validate_topic(self, value):
        return self._validate_not_empty(value, 'Topic')

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class OrderReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ('id', 'order_number', 'user', 'full_name', 'region', 'district', 'school_name', 'home_address', 'subject', 'grade', 'topic', 'price', 'status', 'created_at', 'updated_at')
        read_only_fields = fields