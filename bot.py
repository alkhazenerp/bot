import os
import logging
import asyncio
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters

# الحصول على التوكن من متغير البيئة
TOKEN = os.environ.get('BOT_TOKEN', '8580551896:AAFFO27tsWo2GDNg_cPx-YOZIUGhvmtwSiE')

# إعداد التسجيل
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)

async def start(update: Update, context):
    """معالجة أمر /start"""
    await update.message.reply_text(
        "🎉 **مرحباً بك في بوت الاستثمار الخيري!**\n\n"
        "📝 يرجى إرسال اسمك الأول:"
    )

async def handle_message(update: Update, context):
    """معالجة الرسائل النصية"""
    user_id = update.message.from_user.id
    message_text = update.message.text
    
    # إذا كانت هذه أول رسالة من المستخدم
    if not hasattr(context, 'user_data'):
        context.user_data = {}
    
    if user_id not in context.user_data:
        context.user_data[user_id] = {'name': None}
    
    if context.user_data[user_id]['name'] is None and not message_text.startswith('/'):
        context.user_data[user_id]['name'] = message_text
        
        keyboard = [
            [InlineKeyboardButton("💰 Bitcoin (BTC)", callback_data="btc")],
            [InlineKeyboardButton("🔷 Ethereum (ETH)", callback_data="eth")],
            [InlineKeyboardButton("🟣 Tron (TRX)", callback_data="trx")],
            [InlineKeyboardButton("💵 USDT (TRC20)", callback_data="usdt")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            f"👋 أهلًا بك {message_text}!\n\n"
            "💰 **يرجى اختيار العملة:**",
            reply_markup=reply_markup
        )

async def handle_callback(update: Update, context):
    """معالجة النقر على الأزرار"""
    query = update.callback_query
    await query.answer()
    
    currency_choice = query.data
    
    wallets = {
        "btc": "bc1qxd96l3lx2m3rwsxs8vca97ak0vfuuxlhpzdmr5",
        "eth": "0x5Cc32D337f8c7614D0192a3A5bD873d00c5970bc",
        "trx": "TBoKFGKf6e4D8Z2nsSBSRo39LPoEWrpVqa",
        "usdt": "Fgbbx5vVZZCFkcuA3Z1h1SoytfqNWgxsBDV2kCAbYM1M"
    }
    
    if currency_choice in wallets:
        await query.edit_message_text(
            f"💎 **{currency_choice.upper()}**\n\n"
            f"📤 **العنوان:** `{wallets[currency_choice]}`\n\n"
            f"⚠️ **يرجى التأكد من صحة الشبكة قبل الإرسال**"
        )
        await query.message.reply_text("⏳ جاري انتظار تحويلك... شكراً لك! 🤝")

def main():
    """الدالة الرئيسية"""
    application = Application.builder().token(TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CallbackQueryHandler(handle_callback))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    print("🚀 البوت يعمل على السحابة...")
    application.run_polling()

if __name__ == "__main__":
    main()