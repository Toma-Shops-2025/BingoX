// Bingo X - High Performance Ads with Web Simulation
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

const isNative = () => Capacitor.isNativePlatform();
const UNITY_GAME_ID = "6168869";

declare global {
  interface Window {
    unityads?: any;
  }
}

/** Initialize and Load Ads */
export async function initAds(): Promise<void> {
  if (!isNative()) return;

  const startInit = () => {
    if (window.unityads) {
      window.unityads.initialize(UNITY_GAME_ID, false, () => {
        console.log("✅ Unity Ads Ready - Bingo X");
        window.unityads.load("Rewarded_Android");
        window.unityads.load("Interstitial_Android");
        window.unityads.load("Banner_Android");
      });
    }
  };

  if (window.unityads) startInit();
  else document.addEventListener("deviceready", startInit, { once: true });
}

/** Show a rewarded ad with Auto-Reload */
export async function showRewardedAd(): Promise<{ success: boolean }> {
  if (!isNative()) {
      // WEB SIMULATION OVERLAY
      return new Promise((resolve) => {
          const div = document.createElement('div');
          div.style.cssText = "position:fixed;inset:0;background:black;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-center:center;color:white;font-family:sans-serif;font-weight:bold;";
          div.innerHTML = "<div style='text-align:center'><p style='font-size:24px'>VIDEO AD SIMULATION</p><p style='color:#666'>Rewarding in 3 seconds...</p></div>";
          document.body.appendChild(div);

          setTimeout(() => {
              document.body.removeChild(div);
              resolve({ success: true });
          }, 3000);
      });
  }

  return new Promise((resolve) => {
    if (!window.unityads) {
      toast.error("Ad Engine not ready");
      initAds();
      resolve({ success: false });
      return;
    }

    window.unityads.show("Rewarded_Android", (res: any) => {
      window.unityads.load("Rewarded_Android");
      if (res === "COMPLETED") {
        resolve({ success: true });
      } else {
        toast.error("Video skipped - no reward");
        resolve({ success: false });
      }
    });
  });
}

/** Show an interstitial */
export async function showInterstitial(): Promise<void> {
    if (!isNative()) {
        // WEB SIMULATION OVERLAY
        const div = document.createElement('div');
        div.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;color:white;font-family:sans-serif;";
        div.innerHTML = "<div><p>INTERSTITIAL AD SIMULATION</p></div>";
        document.body.appendChild(div);
        setTimeout(() => document.body.removeChild(div), 2000);
        return;
    }

    if (!window.unityads) return;
    window.unityads.show("Interstitial_Android", () => {
        window.unityads.load("Interstitial_Android");
    });
}

/** Show/Hide Banner Ad */
export function setBannerVisible(visible: boolean): void {
    if (!isNative() || !window.unityads) return;
    if (visible) window.unityads.showBanner("Banner_Android");
    else window.unityads.hideBanner();
}
