#!/usr/bin/env bash
# بناء ملف APK للعبة ردع العدوان دون Android Studio
# المتطلبات: JDK 17+ و Node (لبناء نسخة الملف الواحد) واتصال بالإنترنت أول مرة لتنزيل الأدوات
# الناتج: ../dist/rada3.apk
set -euo pipefail
cd "$(dirname "$0")"

TOOLS=.tools
BUILD=build
mkdir -p "$TOOLS"

fetch() { # fetch <file> <url>
  [ -s "$TOOLS/$1" ] && return
  echo "تنزيل $1 ..."
  curl -fsSL -o "$TOOLS/$1.part" "$2"
  mv "$TOOLS/$1.part" "$TOOLS/$1"
}
fetch apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.9.3/apktool_2.9.3.jar
fetch android.jar https://raw.githubusercontent.com/Sable/android-platforms/master/android-30/android.jar
fetch dx.jar https://repo1.maven.org/maven2/com/jakewharton/android/repackaged/dalvik-dx/9.0.0_r3/dalvik-dx-9.0.0_r3.jar
fetch uber-apk-signer.jar https://github.com/patrickfav/uber-apk-signer/releases/download/v1.3.0/uber-apk-signer-1.3.0.jar

# 1) نسخة اللعبة بملف واحد (three.js مضمّن، تعمل دون إنترنت)
if [ "${SKIP_WEB:-0}" != "1" ]; then
  (cd .. && node build.mjs)
fi
[ -s ../dist/rada3.html ] || { echo "لم يُعثر على ../dist/rada3.html — شغّل npm install ثم أعد المحاولة"; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/app/assets"

# 2) ترجمة كود جافا ثم تحويله إلى dex
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$TOOLS/android.jar" -classpath "$TOOLS/android.jar" \
  -encoding UTF-8 -d "$BUILD/classes" $(find java -name '*.java')
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=21 --output="$BUILD/app/classes.dex" "$BUILD/classes"

# 3) تجميع الموارد والبيان واللعبة في APK
cp -r app/AndroidManifest.xml app/apktool.yml app/res "$BUILD/app/"
cp ../dist/rada3.html "$BUILD/app/assets/index.html"
java -jar "$TOOLS/apktool.jar" b "$BUILD/app" -o "$BUILD/unsigned.apk"

# 4) المحاذاة والتوقيع (مفتاح debug ثابت من uber-apk-signer، أو مفتاحك عبر KEYSTORE)
SIGN_ARGS=()
if [ -n "${KEYSTORE:-}" ]; then
  SIGN_ARGS=(--ks "$KEYSTORE" --ksAlias "${KS_ALIAS:-rada3}" --ksPass "${KS_PASS:?}" --ksKeyPass "${KS_KEY_PASS:-${KS_PASS}}")
fi
java -jar "$TOOLS/uber-apk-signer.jar" -a "$BUILD/unsigned.apk" -o "$BUILD/signed" "${SIGN_ARGS[@]}"
cp "$(ls "$BUILD"/signed/*.apk | head -1)" ../dist/rada3.apk
echo "تم: $(cd .. && pwd)/dist/rada3.apk ($(du -h ../dist/rada3.apk | cut -f1))"
