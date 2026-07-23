import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const PRODUCT_DOUBLE_JS = 'double_js';

export function useBilling(addJS: (n: number) => void) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initStore = async () => {
        const CdvPurchase = (window as any).CdvPurchase;
        if (!CdvPurchase || !CdvPurchase.store) {
            console.warn("Billing: Plugin not found. This is expected in a browser.");
            return;
        }

        const store = CdvPurchase.store;

        // Detailed logging
        store.verbosity = CdvPurchase.LogLevel.DEBUG;

        store.register({
            id: PRODUCT_DOUBLE_JS,
            type: CdvPurchase.ProductType.NON_CONSUMABLE,
            platform: CdvPurchase.Platform.GOOGLE_PLAY,
        });

        store.when().approved((tx: any) => {
            console.log("Billing: Purchase approved!", tx.productId);
            if (tx.productId === PRODUCT_DOUBLE_JS) {
                toast.success("DOUBLE JS ACTIVATED FOREVER!");
                // Here we could update a 'is_pro' flag in the database
            }
            tx.verify();
            tx.finish();
        });

        store.when().verified((p: any) => p.finish());

        store.when().unverified((p: any) => {
            console.log("Billing: Product unverified", p.id);
        });

        store.ready(() => {
            console.log("Billing: Store is ready!");
            setIsReady(true);
        });

        store.error((err: any) => {
            console.error("Billing error:", err.code, err.message);
        });

        try {
            await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
            await store.update();
        } catch (e) {
            console.error("Billing: Initialization failed", e);
        }
    };

    initStore();
  }, []);

  const purchase = async (id: string) => {
    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase || !CdvPurchase.store) {
        return toast.error("Billing service not connected. Please use a real Android device.");
    }

    const store = CdvPurchase.store;
    const p = store.get(id);

    if (p) {
        console.log("Billing: Ordering product", id);
        store.order(p);
    } else {
        console.log("Billing: Product not found, refreshing store...");
        await store.update();
        toast.info("Connecting to Google Play... please wait 3 seconds and try again.");
    }
  };

  return { isReady, purchase };
}
