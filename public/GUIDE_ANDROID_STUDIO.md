# 📱 Гайд: Как создать APK из этого приложения в Android Studio

## 🔧 Вариант 1: WebView обёртка (Самый простой)

### Шаг 1: Установка Android Studio
1. Скачай Android Studio с [developer.android.com](https://developer.android.com/studio)
2. Установи SDK (минимум API 24 — Android 7.0)
3. Установи Build Tools и эмулятор (или используй свой телефон)

### Шаг 2: Создание нового проекта
1. Открой Android Studio → **New Project**
2. Выбери **Empty Views Activity**
3. Заполни:
   - **Name:** `NFC Tester`
   - **Package name:** `com.yourname.nfctester`
   - **Language:** `Kotlin`
   - **Minimum SDK:** `API 24 (Android 7.0)`
4. Нажми **Finish**

### Шаг 3: Настройка AndroidManifest.xml
Открой `app/src/main/AndroidManifest.xml` и замени содержимое:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- NFC Permissions -->
    <uses-permission android:name="android.permission.NFC" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <!-- NFC Feature -->
    <uses-feature
        android:name="android.hardware.nfc"
        android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="NFC Tester"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.NFCTester"
        android:usesCleartextTraffic="true"
        tools:targetApi="31">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:screenOrientation="portrait"
            android:theme="@style/Theme.NFCTester">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- NFC Intent Filters -->
            <intent-filter>
                <action android:name="android.nfc.action.NDEF_DISCOVERED" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.nfc.action.TAG_DISCOVERED" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### Шаг 4: Создание MainActivity.kt
Открой `app/src/main/java/com/yourname/nfctester/MainActivity.kt`:

```kotlin
package com.yourname.nfctester

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Intent
import android.content.IntentFilter
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.nfc.tech.MifareClassic
import android.nfc.tech.MifareUltralight
import android.nfc.tech.Ndef
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var nfcAdapter: NfcAdapter? = null
    private var pendingIntent: PendingIntent? = null
    private var intentFilters: Array<IntentFilter>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Full screen
        window.statusBarColor = android.graphics.Color.parseColor("#050505")
        window.navigationBarColor = android.graphics.Color.parseColor("#050505")

        // Setup WebView
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
        }

        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        // Add JavaScript interface for native NFC
        webView.addJavascriptInterface(NFCBridge(), "AndroidNFC")

        // Load the web app
        webView.loadUrl("file:///android_asset/index.html")

        // Setup NFC
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        
        val intent = Intent(this, javaClass).apply {
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_MUTABLE
        )

        val ndef = IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED)
        val tag = IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED)
        intentFilters = arrayOf(ndef, tag)
    }

    override fun onResume() {
        super.onResume()
        nfcAdapter?.enableForegroundDispatch(
            this, pendingIntent, intentFilters, null
        )
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableForegroundDispatch(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        
        if (NfcAdapter.ACTION_TAG_DISCOVERED == intent.action ||
            NfcAdapter.ACTION_NDEF_DISCOVERED == intent.action) {
            
            val tag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            }
            
            tag?.let { processTag(it) }
        }
    }

    private fun processTag(tag: Tag) {
        val id = tag.id.joinToString(":") { String.format("%02X", it) }
        val techList = tag.techList.map { it.split(".").last() }
        
        val type = when {
            techList.contains("MifareClassic") -> "MIFARE Classic"
            techList.contains("MifareUltralight") -> "MIFARE Ultralight"
            techList.contains("IsoDep") -> "ISO-DEP"
            techList.contains("Ndef") -> "NDEF"
            else -> techList.firstOrNull() ?: "Unknown"
        }

        // Count records if NDEF
        var records = 0
        val ndef = Ndef.get(tag)
        if (ndef != null) {
            try {
                ndef.connect()
                records = ndef.ndefMessage?.records?.size ?: 0
                ndef.close()
            } catch (_: Exception) {}
        }

        val json = JSONObject().apply {
            put("id", id)
            put("type", type)
            put("technology", techList.joinToString(", "))
            put("records", records)
        }

        // Vibrate
        vibrate()

        // Send to WebView
        runOnUiThread {
            webView.evaluateJavascript(
                "window.onNFCTag && window.onNFCTag(${json})", null
            )
        }
    }

    private fun vibrate() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator.vibrate(
                VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE)
            )
        } else {
            @Suppress("DEPRECATION")
            val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(100)
            }
        }
    }

    inner class NFCBridge {
        @JavascriptInterface
        fun isNFCSupported(): Boolean = nfcAdapter != null

        @JavascriptInterface
        fun isNFCEnabled(): Boolean = nfcAdapter?.isEnabled == true

        @JavascriptInterface
        fun getDeviceModel(): String = "${Build.MANUFACTURER} ${Build.MODEL}"

        @JavascriptInterface
        fun getAndroidVersion(): String = "Android ${Build.VERSION.RELEASE}"

        @JavascriptInterface
        fun hasHCE(): Boolean {
            return packageManager.hasSystemFeature("android.hardware.nfc.hce")
        }

        @JavascriptInterface
        fun hasSecureElement(): Boolean {
            return packageManager.hasSystemFeature("android.hardware.nfc.ese") ||
                   packageManager.hasSystemFeature("android.hardware.nfc")
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
```

### Шаг 5: Копирование веб-файлов
1. Собери веб-приложение: `npm run build`
2. Скопируй содержимое папки `dist/` в `app/src/main/assets/`
3. Файл `dist/index.html` должен быть по пути `app/src/main/assets/index.html`

### Шаг 6: Стиль приложения
Создай файл `app/src/main/res/values/themes.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.NFCTester" parent="Theme.AppCompat.NoActionBar">
        <item name="android:statusBarColor">#050505</item>
        <item name="android:navigationBarColor">#050505</item>
        <item name="android:windowBackground">#050505</item>
        <item name="android:windowFullscreen">false</item>
    </style>
</resources>
```

### Шаг 7: Сборка APK
1. В Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Готовый APK: `app/build/outputs/apk/debug/app-debug.apk`
3. Для release: **Build → Generate Signed Bundle / APK...**

---

## 🔧 Вариант 2: Нативное Android приложение (Более продвинутый)

Если хочешь полностью нативное приложение с Jetpack Compose:

### Шаг 1: Новый проект
1. Android Studio → **New Project → Empty Compose Activity**
2. Kotlin + Compose

### Шаг 2: build.gradle (Module: app)
Добавь зависимости:

```gradle
dependencies {
    implementation("androidx.compose.material3:material3:1.2.0")
    implementation("androidx.compose.animation:animation:1.6.0")
    implementation("androidx.navigation:navigation-compose:2.7.6")
    implementation("androidx.compose.material:material-icons-extended:1.6.0")
}
```

### Шаг 3: NFC Manager
Создай `NFCManager.kt`:

```kotlin
package com.yourname.nfctester

import android.app.Activity
import android.app.PendingIntent
import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Build
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class NFCTagInfo(
    val id: String,
    val type: String,
    val technology: String,
    val records: Int,
    val timestamp: Long = System.currentTimeMillis()
)

class NFCManager(private val activity: Activity) {
    private val nfcAdapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)
    
    private val _tagFlow = MutableStateFlow<NFCTagInfo?>(null)
    val tagFlow: StateFlow<NFCTagInfo?> = _tagFlow

    val isSupported: Boolean get() = nfcAdapter != null
    val isEnabled: Boolean get() = nfcAdapter?.isEnabled == true
    
    val deviceModel: String get() = "${Build.MANUFACTURER} ${Build.MODEL}"
    val androidVersion: String get() = "Android ${Build.VERSION.RELEASE}"
    
    val hasHCE: Boolean get() = 
        activity.packageManager.hasSystemFeature("android.hardware.nfc.hce")
    
    val hasSecureElement: Boolean get() = 
        activity.packageManager.hasSystemFeature("android.hardware.nfc.ese") ||
        activity.packageManager.hasSystemFeature("android.hardware.nfc")

    private val pendingIntent = PendingIntent.getActivity(
        activity, 0,
        Intent(activity, activity.javaClass).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_MUTABLE
    )

    fun enableForegroundDispatch() {
        nfcAdapter?.enableForegroundDispatch(activity, pendingIntent, null, null)
    }

    fun disableForegroundDispatch() {
        nfcAdapter?.disableForegroundDispatch(activity)
    }

    fun processIntent(intent: Intent) {
        if (NfcAdapter.ACTION_TAG_DISCOVERED == intent.action ||
            NfcAdapter.ACTION_NDEF_DISCOVERED == intent.action) {
            
            val tag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG, Tag::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            }
            
            tag?.let { processTag(it) }
        }
    }

    private fun processTag(tag: Tag) {
        val id = tag.id.joinToString(":") { String.format("%02X", it) }
        val techList = tag.techList.map { it.split(".").last() }
        
        val type = when {
            "MifareClassic" in techList -> "MIFARE Classic"
            "MifareUltralight" in techList -> "MIFARE Ultralight"
            "IsoDep" in techList -> "ISO-DEP"
            "Ndef" in techList -> "NDEF"
            else -> techList.firstOrNull() ?: "Unknown"
        }

        var records = 0
        val ndef = Ndef.get(tag)
        if (ndef != null) {
            try {
                ndef.connect()
                records = ndef.ndefMessage?.records?.size ?: 0
                ndef.close()
            } catch (_: Exception) {}
        }

        _tagFlow.value = NFCTagInfo(
            id = id,
            type = type,
            technology = techList.joinToString(", "),
            records = records
        )
    }

    fun clearTag() {
        _tagFlow.value = null
    }
}
```

---

## 📦 Вариант 3: Capacitor / PWA (Средний)

### Использование Capacitor для обёртки:

```bash
# Установи Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "NFC Tester" "com.yourname.nfctester"

# Добавь Android платформу
npm install @capacitor/android
npx cap add android

# Собери веб-приложение и синхронизируй
npm run build
npx cap sync android

# Открой в Android Studio
npx cap open android
```

Затем в Android Studio собери APK как обычно.

---

## 🎯 Быстрая сборка APK (Без Android Studio)

Если у тебя установлен Android SDK:

```bash
# 1. Собери веб-версию
npm run build

# 2. Используй Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "NFC Tester" "com.yourname.nfctester" --web-dir dist
npx cap add android
npx cap sync

# 3. Собери APK через Gradle
cd android
./gradlew assembleDebug

# APK будет в: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## ⚡ Советы

1. **Тестирование NFC**: Используй реальное устройство, эмулятор НЕ поддерживает NFC
2. **Подписание APK**: Для Google Play нужна подпись ключом (keytool + jarsigner)
3. **Иконка**: Замени иконку через **Image Asset** в Android Studio (правый клик на res → New → Image Asset)
4. **ProGuard**: Для релизной сборки настрой минификацию в `build.gradle`

---

## 📋 Минимальные требования

- Android Studio Hedgehog или новее
- JDK 17
- Android SDK 24+ (Android 7.0+)
- Gradle 8.0+
- Реальное устройство с NFC для тестирования

---

## 🔐 Подписание APK для релиза

```bash
# Создай ключ
keytool -genkey -v -keystore nfc-tester.keystore \
  -alias nfctester -keyalg RSA -keysize 2048 -validity 10000

# В Android Studio: Build → Generate Signed Bundle/APK
# Выбери APK → Укажи keystore → Release → Build
```

Готовый подписанный APK можно установить на любое Android устройство или загрузить в Google Play Console.
