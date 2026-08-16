import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export const PRODUCT_DOUBLE_JS = 'double_js';

export function useBilling(onPurchased?: () => void) {
  const [isReady, setIsReady] = useState(false);
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    const initStore = async () => {
      const CdvPurchase = (window as any).CdvPurchase;
      if (!CdvPurchase?.store) {
        console.warn("Billing: cordova-plugin-purchase not available");
        return;
      }

      const store = CdvPurchase.store;
      store.verbosity = CdvPurchase.LogLevel.DEBUG;

      store.register({
        id: PRODUCT_DOUBLE_JS,
        type: CdvPurchase.ProductType.NON_CONSUMABLE,
        platform: CdvPurchase.Platform.GOOGLE_PLAY,
      });

      store.when().approved((tx: any) => {
        if (tx.productId === PRODUCT_DOUBLE_JS) {
          toast.success("DOUBLE JS ACTIVATED FOREVER!");
          onPurchased?.();
        }
        tx.verify();
      });

      store.when().verified((receipt: any) => receipt.finish());
      store.when().unverified(() => toast.error("Purchase could not be verified"));

      store.ready(() => {
        console.log("Billing: Store is ready");
        setIsReady(true);
      });

      store.error((err: any) => {
        console.error("Billing error:", err?.code, err?.message);
      });

      try {
        await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
        await store.update();
      } catch (e) {
        console.error("Billing: Initialization failed", e);
      }
    };

    void initStore();
  }, [onPurchased]);

  const purchase = async (id: string) => {
    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase?.store) {
      toast.error("Google Play billing is not available on this build.");
      return;
    }

    const store = CdvPurchase.store;

    if (!isReady) {
      toast.info("Connecting to Google Play...");
      try {
        await store.update();
      } catch {
        toast.error("Google Play store is still loading. Try again in a few seconds.");
        return;
      }
    }

    let product = store.get(id, CdvPurchase.Platform.GOOGLE_PLAY) ?? store.get(id);

    if (!product) {
      await store.update();
      product = store.get(id, CdvPurchase.Platform.GOOGLE_PLAY) ?? store.get(id);
    }

    if (!product) {
      toast.error(
        "Product not found. Create in-app product \"double_js\" in Play Console and install from Play testing."
      );
      return;
    }

    if (!product.canPurchase) {
      toast.info("You already own Double JS.");
      return;
    }

    store.order(product);
  };

  return { isReady, purchase };
};
