import hashlib
import hmac
import json
import time
from urllib.parse import unquote
from rest_framework.permissions import BasePermission
from django.conf import settings


class TelegramInitDataPermission(BasePermission):
    """
    Telegram MiniApp initData tekshiruvi.
    HMAC-SHA256 orqali telegram_id ni tasdiqlaydi.
    """

    MAX_AUTH_AGE = 86400  # 24 soat

    def has_permission(self, request, view):
        init_data = request.headers.get('X-Telegram-Init-Data', '')
        if not init_data:
            return False

        bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        if not bot_token:
            # Agar bot token yo'qsa — ruxsat bermaslik (fail-closed)
            return False

        try:
            user_data = self._validate_init_data(init_data, bot_token)
            if user_data is None:
                return False

            # Telegram ID ni request ga qo'shamiz
            request.telegram_user_id = user_data.get('id')
            request.telegram_user = user_data
            return True
        except Exception:
            return False

    def _validate_init_data(self, init_data, bot_token):
        """Telegram initData ni tekshiradi va foydalanuvchi ma'lumotlarini qaytaradi."""
        params = {}
        for item in init_data.split('&'):
            if '=' in item:
                key, value = item.split('=', 1)
                params[key] = unquote(value)

        hash_value = params.pop('hash', None)
        if not hash_value:
            return None

        # Data-check-string yaratish
        data_check_entries = []
        for key, value in sorted(params.items()):
            data_check_entries.append(f'{key}={value}')
        data_check_string = '\n'.join(data_check_entries)

        # HMAC-SHA256 tekshiruvi
        secret_key = hmac.new(
            b'WebAppData',
            bot_token.encode(),
            hashlib.sha256
        ).digest()

        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, hash_value):
            return None

        # Auth_date yangiligini tekshirish
        auth_date = int(params.get('auth_date', '0'))
        if not auth_date:
            return None

        now = int(time.time())
        if now - auth_date > self.MAX_AUTH_AGE:
            return None

        # Foydalanuvchi ma'lumotlarini olish
        user_str = params.get('user')
        if not user_str:
            return None

        try:
            user_data = json.loads(user_str)
            if not user_data.get('id'):
                return None
            return user_data
        except json.JSONDecodeError:
            return None
