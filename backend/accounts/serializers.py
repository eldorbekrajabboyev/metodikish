from rest_framework import serializers
from .models import User

class UserCreateSerializer(serializers.Serializer):
    telegram_id = serializers.IntegerField(required=True)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_telegram_id(self, value):
        if value <= 0:
            raise serializers.ValidationError('Invalid Telegram ID.')
        return value

    def create(self, validated_data):
        user, created = User.objects.get_or_create(
            telegram_id=validated_data['telegram_id'],
            defaults={
                'username': validated_data.get('username', ''),
                'first_name': validated_data.get('first_name', ''),
                'last_name': validated_data.get('last_name', ''),
                'phone_number': validated_data.get('phone_number', ''),
            },
        )
        if not created:
            user.username = validated_data.get('username', user.username)
            user.first_name = validated_data.get('first_name', user.first_name)
            user.last_name = validated_data.get('last_name', user.last_name)
            user.phone_number = validated_data.get('phone_number', user.phone_number)
            user.save()
        return user

class UserReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'telegram_id', 'username', 'first_name', 'last_name', 'phone_number', 'created_at', 'updated_at')
        read_only_fields = fields