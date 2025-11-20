@echo off
chcp 65001 >nul
title Telegram Bot - Running 24/7
echo 🤖 بوت التليغرام يعمل بشكل دائم
echo 🔄 سيعيد التشغيل تلقائياً إذا توقف
echo 🛑 استخدم Ctrl+C لإيقاف البوت

:loop
python bot.py
echo.
echo ⚠️  البوت توقف، جاري إعادة التشغيل خلال 5 ثوان...
timeout /t 5 /nobreak >nul
goto loop