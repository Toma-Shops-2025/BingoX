import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const PRODUCT_DOUBLE_JS = 'double_js';

export function useBilling(addJS: (n: number) => void) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initStore = async () => {
        const CdvPurchase = (window as any).CdvPurchase;
        if (!CdvPurchase || !CdvPurchase.store) {
            console.log("Billing: Store not found on window.");
            return;
        }

        const store = CdvPurchase.store;
        console.log("Billing: Initializing...");

        // Register Product
        store.register({
            id: PRODUCT_DOUBLE_JS,
            type: CdvPurchase.ProductType.NON_CONSUMABLE,
            platform: CdvPurchase.Platform.GOOGLE_PLAY,
        });

        store.when().approved((tx: any) => {
            console.log("Billing: Approved!", tx.productId);
            if (tx.productId === PRODUCT_DOUBLE_JS) {
                toast.success("Double JS Activated Permanently!");
                // You could save this state to Supabase here
            }
            tx.verify();
            tx.finish();
        });

        store.when().verified((p: any) => p.finish());

        store.error((err: any) => {
            console.error("Billing Error:", err.code, err.message);
        });

        store.ready(() => {
            console.log("Billing: Ready!");
            setIsReady(true);
        });

        try {
            await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
            await store.update();
        } catch (e) {
            console.error("Billing: Init Failed", e);
        }
    };

    initStore();
  }, []);

  const purchase = (id: string) => {
    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase || !CdvPurchase.store) return toast.error("Billing service not available.");

    const p = CdvPurchase.store.get(id);
    if (p) {
        console.log("Billing: Ordering", id);
        CdvPurchase.store.order(p);
    } else {
        console.log("Billing: Product not found, updating...");
        CdvPurchase.store.update();
        toast.info("Connecting to Play Store... try again in a moment.");
    }
  };

  return { isReady, purchase };
}
