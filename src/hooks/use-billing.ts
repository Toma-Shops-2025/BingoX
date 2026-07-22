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

        store.register({
            id: PRODUCT_DOUBLE_JS,
            type: CdvPurchase.ProductType.NON_CONSUMABLE,
            platform: CdvPurchase.Platform.GOOGLE_PLAY,
        });

        store.when().approved((tx: any) => {
            if (tx.productId === PRODUCT_DOUBLE_JS) {
                toast.success("DOUBLE JS ACTIVATED!");
                // You could trigger a flag update in your DB here
            }
            tx.verify();
            tx.finish();
        });

        store.ready(() => {
            setIsReady(true);
        });

        try {
            store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
            store.update();
        } catch (e) {
            console.error("Billing: Init error", e);
        }
    };

    initStore();
  }, []);

  const purchase = (id: string) => {
    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase || !CdvPurchase.store) {
        return toast.error("Billing service not connected. Are you on a real device?");
    }

    const p = CdvPurchase.store.get(id);
    if (p) {
        CdvPurchase.store.order(p);
    } else {
        CdvPurchase.store.update();
        toast.info("Connecting to Play Store... please wait 3 seconds.");
    }
  };

  return { isReady, purchase };
}
