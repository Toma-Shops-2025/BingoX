// Bingo X - Unity Ads Integration
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

const isNative = () => Capacitor.isNativePlatform();

declare global {
  interface Window {
    unityads?: any;
  }
}

// YOUR REAL UNITY GAME ID for Bingo X
const UNITY_GAME_ID = "6168869";

/** Initialize Unity Ads SDK */
export async function initAds(): Promise<void> {
  if (!isNative()) return;
  console.log("🎬 Ad System Initializing...");

  return new Promise((resolve) => {
    const checkPlugin = () => {
      if (window.unityads) {
        // false = Test Mode OFF (Real Ads ON)
        window.unityads.initialize(UNITY_GAME_ID, false, () => {
          console.log("✅ Unity Ads Initialized - Bingo X");
          resolve();
        });
      } else {
        document.addEventListener("deviceready", () => {
          if (window.unityads) {
            window.unityads.initialize(UNITY_GAME_ID, false, () => {
                console.log("✅ Unity Ads Initialized (deviceready) - Bingo X");
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
    toast.info("Simulating Rewarded Video...");
    await new Promise((r) => setTimeout(r, 2000));
    return { success: true };
  }

  return new Promise((resolve) => {
    if (!window.unityads) {
      toast.error("Ad Engine not ready");
      resolve({ success: false });
      return;
    }

    // "Rewarded_Android" is the default Ad Unit name in Unity
    window.unityads.show("Rewarded_Android", (res: any) => {
      if (res === "COMPLETED") {
        resolve({ success: true });
      } else {
        toast.error("Ad not finished - no reward granted");
        resolve({ success: false });
      }
    });
  });
}

/** Show an interstitial ad */
export async function showInterstitial(): Promise<void> {
    if (!isNative() || !window.unityads) return;

    // "Interstitial_Android" is the default Ad Unit name in Unity
    window.unityads.show("Interstitial_Android");
}

/** Show/Hide Banner Ad */
export function setBannerVisible(visible: boolean): void {
    console.log("Banner visibility set to:", visible);
}
