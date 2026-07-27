export const CONFIG = {
    // Domain Info
    DOMAIN: "mybingox.fun",
    PRIVACY_URL: "https://mybingox.fun/privacy",
    TERMS_URL: "https://mybingox.fun/terms",

    // ADMOB IDS - Pulling from Netlify Env Vars
    ADMOB_APP_ID: import.meta.env.VITE_ADMOB_APP_ID || "ca-app-pub-3940256099942544~3347511713",
    ADMOB_BANNER_ID: "ca-app-pub-3940256099942544/6300978111",
    ADMOB_INTERSTITIAL_ID: "ca-app-pub-3940256099942544/1033173712",
    ADMOB_REWARDED_ID: import.meta.env.VITE_ADMOB_REWARDED_ID || "ca-app-pub-3940256099942544/5224354917",

    // Set this to false for production!
    IS_TESTING: false,

    // Game Rules
    ROUND_TIME_LIMIT: 150, // 2 minutes and 30 seconds
    POINTS_PER_DAUB: 200,
    BINGO_BONUS: 5000,
    X_PATTERN_BONUS: 15000,
};
