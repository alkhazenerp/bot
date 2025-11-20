import requests
import time
from datetime import datetime

TOKEN = "8476094626:AAEfkGzYpwGmT6btRssWkXdlxbudIRXIJHs"

def check_bot_status():
    try:
        url = f"https://api.telegram.org/bot{TOKEN}/getMe"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200 and response.json()['ok']:
            bot_info = response.json()['result']
            return True, f"✅ البوت شغال - @{bot_info['username']}"
        else:
            return False, "❌ البوت غير متصل"
    except Exception as e:
        return False, f"❌ خطأ في الاتصال: {e}"

if __name__ == "__main__":
    print("🔍 مراقبة حالة البوت...")
    while True:
        status, message = check_bot_status()
        print(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {message}")
        time.sleep(60)  # تحقق كل دقيقة