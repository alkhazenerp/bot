#!/usr/bin/env python3
"""مولّد أكواد التفعيل للبائع — مطابق لخوارزمية src/core/codes.js

الاستخدام:
    python3 keygen.py <UUID> <ITEM_ID> [ORDER_NO] [--secret SECRET]

مثال:
    python3 keygen.py 3f2c...-...  gold_5k 1

المنتجات المتاحة: gold_5k, gold_25k, tow2b, unlock_all, vip, skin_gold
لطلبات الإهداء أضف ‎@gift إلى رمز المنتج واستخدم رقم الطلب المذكور في الرسالة (1000-9999)
يجب أن يطابق SECRET قيمة shopSecret في src/config.js
"""
import sys

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DEFAULT_SECRET = "RADA-2024-12-08-TOW"
ITEMS = ["gold_5k", "gold_25k", "tow2b", "unlock_all", "vip", "skin_gold"]


def fnv1a(data: bytes, seed: int) -> int:
    h = seed & 0xFFFFFFFF
    for b in data:
        h ^= b
        h = (h * 16777619) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0x5BD1E995) & 0xFFFFFFFF
    h ^= h >> 15
    return h & 0xFFFFFFFF


def make_code(uuid: str, item: str, order: int, secret: str) -> str:
    msg = f"{uuid.strip().lower()}|{item}|{order}|{secret}".encode("utf-8")
    x, y = fnv1a(msg, 2166136261), fnv1a(msg, 0x9747B28C)
    out = ""
    for _ in range(5):
        out += ALPHABET[x & 31]
        x >>= 5
    for _ in range(5):
        out += ALPHABET[y & 31]
        y >>= 5
    return f"{out[:5]}-{out[5:]}"


def main(argv):
    args = [a for a in argv[1:]]
    secret = DEFAULT_SECRET
    if "--secret" in args:
        i = args.index("--secret")
        secret = args[i + 1]
        del args[i:i + 2]
    if len(args) < 2:
        print(__doc__)
        return 1
    uuid, item = args[0], args[1]
    order = int(args[2]) if len(args) > 2 else 1
    if item.replace("@gift", "") not in ITEMS:
        print(f"تحذير: المنتج {item} غير معروف. المتاح: {', '.join(ITEMS)}")
    print(make_code(uuid, item, order, secret))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
