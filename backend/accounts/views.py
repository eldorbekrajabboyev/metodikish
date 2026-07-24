from rest_framework.generics import CreateAPIView
from rest_framework.permissions import AllowAny
from api.utils import success_response
from .serializers import UserCreateSerializer, UserReadSerializer
from .permissions import TelegramInitDataPermission


class UserCreateOrLoginView(CreateAPIView):
    serializer_class = UserCreateSerializer
    permission_classes = [TelegramInitDataPermission]

    def create(self, request, *args, **kwargs):
        # Telegram dan tasdiqlangan telegram_id ni ishlatamiz
        telegram_id = request.telegram_user_id
        if not telegram_id:
            return success_response(message='Telegram auth talab qilinadi', errors={'auth': 'InitData noto\'g\'ri'}, status_code=401)

        # Telegram dan olingan ma'lumotlarni request ga qo'shamiz
        data = request.data.copy()
        data['telegram_id'] = telegram_id

        # Telegram dan olingan username/ismlarni ham qo'shamiz (agar mavjud bo'lsa)
        tg_user = getattr(request, 'telegram_user', {})
        if tg_user.get('username') and not data.get('username'):
            data['username'] = tg_user['username']
        if tg_user.get('first_name') and not data.get('first_name'):
            data['first_name'] = tg_user['first_name']
        if tg_user.get('last_name') and not data.get('last_name'):
            data['last_name'] = tg_user['last_name']

        serializer = self.get_serializer(data=data)
        if not serializer.is_valid():
            return success_response(message='Validation error', errors=serializer.errors, status_code=400)
        user = serializer.save()
        read_serializer = UserReadSerializer(user)
        return success_response(data=read_serializer.data, message='User created or updated successfully', status_code=200)