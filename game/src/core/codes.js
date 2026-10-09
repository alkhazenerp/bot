// توليد والتحقق من أكواد التفعيل المرتبطة بمعرّف الجهاز (UUID)
// نفس الخوارزمية موجودة في tools/keygen.html و tools/keygen.py — يجب أن تبقى متطابقة

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // بدون 0/O و 1/I

function utf8(str) {
  return new TextEncoder().encode(str);
}

function fnv1a(bytes, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  // خلط نهائي
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

export function normalizeUuid(u) {
  return String(u || '').trim().toLowerCase();
}

export function makeCode(uuid, itemId, orderNo, secret) {
  const msg = `${normalizeUuid(uuid)}|${itemId}|${orderNo}|${secret}`;
  const b = utf8(msg);
  const h1 = fnv1a(b, 2166136261);
  const h2 = fnv1a(b, 0x9747b28c);
  let out = '';
  let x = h1, y = h2;
  for (let i = 0; i < 5; i++) { out += ALPHABET[x & 31]; x >>>= 5; }
  for (let i = 0; i < 5; i++) { out += ALPHABET[y & 31]; y >>>= 5; }
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function cleanCode(c) {
  return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function verifyCode(code, uuid, itemId, orderNo, secret) {
  return cleanCode(code) === cleanCode(makeCode(uuid, itemId, orderNo, secret));
}
