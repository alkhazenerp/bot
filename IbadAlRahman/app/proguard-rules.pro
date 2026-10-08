# Components referenced from the manifest and widget XML are kept automatically by AAPT.
# Enum names are persisted in SharedPreferences (valueOf), so keep them stable.
-keepclassmembers enum com.ibadalrahman.app.** {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
