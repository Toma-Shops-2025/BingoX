import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const PRODUCT_DOUBLE_JS = 'double_js';

export function useBilling(addJS: (n: number) => void) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase || !CdvPurchase.store) return;
    const store = CdvPurchase.store;

    store.register([
      { id: PRODUCT_DOUBLE_JS, type: CdvPurchase.ProductType.NON_CONSUMABLE, platform: CdvPurchase.Platform.GOOGLE_PLAY },
    ]);

    store.when().approved((tx: any) => {
      if (tx.productId === PRODUCT_DOUBLE_JS) {
          // You might want to handle this differently for a "Permanent" boost
          // e.g., saving a flag in your Supabase profile
          toast.success("Double JS Activated!");
      }
      tx.verify();
      tx.finish();
    });

    store.ready(() => setIsReady(true));
    store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
  }, [addJS]);

  const purchase = (id: string) => {
    const CdvPurchase = (window as any).CdvPurchase;
    if (!CdvPurchase) return toast.error("Hardware billing not detected.");

    const store = CdvPurchase.store;
    const p = store.get(id);

    if (p) {
        store.order(p);
    } else {
        store.update();
        toast.info("Connecting to Google Play... try again in 5 seconds");
    }
  };

  return { isReady, purchase };
}
