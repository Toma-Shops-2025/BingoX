// Bingo X - AppLovin MAX Integration
import { Capacitor } from "@capacitor/core";

const isNative = () => Capacitor.isNativePlatform();

declare global {
  interface Window {
    applovin?: any;
  }
}

const SDK_KEY = "YOUR_SDK_KEY_HERE";
const REWARDED_AD_UNIT_ID = "YOUR_REWARDED_AD_UNIT_ID_HERE";
const INTERSTITIAL_AD_UNIT_ID = "YOUR_INTERSTITIAL_AD_UNIT_ID_HERE";
const BANNER_AD_UNIT_ID = "YOUR_BANNER_AD_UNIT_ID_HERE";

export type RewardedResult = { success: boolean; fallback: boolean };

/** Initialize AppLovin MAX SDK */
export async function initAds(): Promise<void> {
  if (!isNative()) return;

  return new Promise((resolve) => {
    const checkPlugin = () => {
      if (window.applovin) {
        window.applovin.initialize(SDK_KEY, (configuration: any) => {
          console.log("AppLovin SDK Initialized", configuration);
          window.applovin.loadRewardedAd(REWARDED_AD_UNIT_ID);
          window.applovin.loadInterstitialAd(INTERSTITIAL_AD_UNIT_ID);
          resolve();
        });
      } else {
        document.addEventListener("deviceready", () => {
          if (window.applovin) {
            window.applovin.initialize(SDK_KEY, (configuration: any) => {
              console.log("AppLovin SDK Initialized (deviceready)", configuration);
              window.applovin.loadRewardedAd(REWARDED_AD_UNIT_ID);
              window.applovin.loadInterstitialAd(INTERSTITIAL_AD_UNIT_ID);
              resolve();
            });
          }
        }, { once: true });
      }
    };
    checkPlugin();
  });
}

/** Show a rewarded ad */
export async function showRewardedAd(): Promise<{ success: boolean }> {
  if (!isNative()) {
    console.log("Simulating ad on web...");
    await new Promise((r) => setTimeout(r, 1500));
    return { success: true };
  }

  return new Promise((resolve) => {
    if (!window.applovin) {
      resolve({ success: false });
      return;
    }

    window.applovin.isRewardedAdReady(REWARDED_AD_UNIT_ID, (isReady: boolean) => {
      if (isReady) {
        window.applovin.showRewardedAd(REWARDED_AD_UNIT_ID);
        // Resolve after a short delay so UI is responsive
        setTimeout(() => resolve({ success: true }), 2000);
      } else {
        window.applovin.loadRewardedAd(REWARDED_AD_UNIT_ID);
        resolve({ success: false });
      }
    });
  });
}

/** Show an interstitial ad */
export async function showInterstitial(): Promise<void> {
    if (!isNative()) {
        console.log("Simulating interstitial on web...");
        return;
    }

    if (!window.applovin) return;

    window.applovin.isInterstitialReady(INTERSTITIAL_AD_UNIT_ID, (isReady: boolean) => {
        if (isReady) {
            window.applovin.showInterstitial(INTERSTITIAL_AD_UNIT_ID);
        } else {
            window.applovin.loadInterstitialAd(INTERSTITIAL_AD_UNIT_ID);
        }
    });
}

/** Show/Hide Banner Ad */
export function setBannerVisible(visible: boolean): void {
    if (!isNative() || !window.applovin) return;

    if (visible) {
        window.applovin.createBanner(BANNER_AD_UNIT_ID, "bottom_center");
        window.applovin.showBanner(BANNER_AD_UNIT_ID);
    } else {
        window.applovin.hideBanner(BANNER_AD_UNIT_ID);
    }
}
