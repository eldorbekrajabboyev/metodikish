import os
import sys
import threading
import asyncio
import logging

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

logger = logging.getLogger(__name__)


def run_bot():
    if not os.environ.get('RUN_BOT'):
        return

    from decouple import config as env_config
    token = env_config('TELEGRAM_BOT_TOKEN', default='')
    if not token:
        logger.warning('TELEGRAM_BOT_TOKEN not set, bot not started')
        return

    logger.info('Starting Telegram bot...')

    try:
        from aiogram import Bot, Dispatcher
        from aiogram.client.default import DefaultBotProperties
    except ImportError:
        logger.warning('aiogram not installed, skipping bot')
        return

    async def main():
        bot = Bot(token=token, default=DefaultBotProperties(parse_mode='HTML'))
        dp = Dispatcher()

        try:
            from bot.handlers import router
            dp.include_router(router)
        except ImportError:
            logger.warning('bot.handlers module not found, running empty bot')

        await dp.start_polling(bot)

    def bot_thread():
        try:
            asyncio.run(main())
        except Exception as e:
            logger.error(f'Bot error: {e}')

    thread = threading.Thread(target=bot_thread, daemon=True)
    thread.start()
    logger.info('Bot thread started')


run_bot()
