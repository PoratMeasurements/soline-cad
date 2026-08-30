plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "il.co.soline.measure"
    compileSdk = 35

    defaultConfig {
        applicationId = "il.co.soline.measure"
        minSdk = 26
        targetSdk = 35
        versionCode = 11
        versionName = "0.8.4"
    }

    buildFeatures {
        compose = true
        // נדרש עבור BuildConfig.DEBUG — משמש לגדר את fallbackToDestructiveMigration
        // לדיבאג-בלבד (קבוצה-A בביקורת · מונע מחיקת-נתונים-בשקט ב-release).
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        getByName("debug") {
            isMinifyEnabled = false
        }
    }

    // בדיקות-יחידה על ה-JVM (ללא-מכשיר): Robolectric דורש משאבי-אנדרואיד ממוזגים
    // (manifest/assets) כדי לספק Context/SQLite/org.json אמיתיים למבחני-המיגרציה וה-SolWriter.
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
}

// נעילת-סכימת-Room: KSP פולט את JSON-הסכימה לכל-גרסה אל `app/schemas/` (נשמר בבקרת-גרסאות
// · המלצת-הביקורת #1). schema-diff חושף שינוי-סכימה בסקירה במקום כשל-ריצה שקט.
ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.09.03")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.navigation:navigation-compose:2.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")

    val room = "2.6.1"
    implementation("androidx.room:room-runtime:$room")
    implementation("androidx.room:room-ktx:$room")
    ksp("androidx.room:room-compiler:$room")

    // ── בדיקות-יחידה (JVM · ללא-מכשיר) — תוספתי-בלבד ──────────────────────────────
    // הסולברים (geometry/*) נבדקים ב-JUnit טהור; מבחני-המיגרציה וה-SolWriter רצים תחת
    // Robolectric כדי לקבל SQLite/Context/org.json אמיתיים על ה-JVM (בלי אמולטור/מכשיר).
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation("androidx.room:room-testing:$room")
}
