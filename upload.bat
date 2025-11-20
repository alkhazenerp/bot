@echo off
chcp 65001 >nul
echo =================================
echo 📤 رفع الملفات إلى GitHub
echo =================================

echo.
echo 📁 جاري تهيئة Git...
git init

echo.
echo 👤 جاري إعداد معلومات المستخدم...
git config --global user.name "alkhazenerp"
git config --global user.email "abdulrahmankanjalhalabi@gmail.com"

echo.
echo ➕ جاري إضافة الملفات...
git add .

echo.
echo 💾 جاري حفظ التغييرات...
git commit -m "First commit: Telegram bot deployment"

echo.
echo 🌐 جاري الربط مع GitHub...
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

echo.
echo 🚀 جاري رفع الملفات...
git push -u origin main

echo.
echo ✅ تم رفع الملفات بنجاح!
echo 📍 يمكنك رؤيتها على: https://github.com/YOUR_USERNAME/YOUR_REPO_NAME
pause