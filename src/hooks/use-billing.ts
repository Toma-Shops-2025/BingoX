import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import 'cordova-plugin-purchase/www/store.js';

export const PRODUCT_DOUBLE_JS = 'double_js';
export const DOUBLE_JS_LOCAL_KEY = 'bingox_double_js';

type CdvStore = {
  verbosity: number;
  register: (product: unknown) => void;
  when: () => {
    approved: (cb: (tx: { productId: string; verify: () => void }) => void) => void;
    verified: (cb: (receipt: { finish: () => void }) => void) => void;
    unverified: (cb: () => void) => void;
  };
  ready: (cb: () => void) => void;
  error: (cb: (err: { code?: string; message?: string }) => void) => void;
  initialize: (platforms: unknown[]) => Promise<void>;
  update: () => Promise<void>;
  get: (id: string, platform?: unknown) => { canPurchase?: boolean } | undefined;
  order: (product: unknown) => void;
};

function getStore() {
  const CdvPurchase = (window as { CdvPurchase?: { store: CdvStore; LogLevel: { DEBUG: number }; ProductType: { NON_CONSUMABLE: unknown }; Platform: { GOOGLE_PLAY: unknown } } }).CdvPurchase;
  if (!CdvPurchase?.store) return null;
  return { store: CdvPurchase.store, CdvPurchase };
}

function readLocalDoubleJs() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DOUBLE_JS_LOCAL_KEY) === '1';
}

export function useBilling(onPurchased?: () => void | Promise<void>) {
  const [isReady, setIsReady] = useState(false);
  const [ownsDoubleJs, setOwnsDoubleJs] = useState(readLocalDoubleJs);
  const initStarted = useRef(false);
  const onPurchasedRef = useRef(onPurchased);

  useEffect(() => {
    onPurchasedRef.current = onPurchased;
  }, [onPurchased]);

  const markOwned = useCallback(async () => {
    localStorage.setItem(DOUBLE_JS_LOCAL_KEY, '1');
    setOwnsDoubleJs(true);
    await onPurchasedRef.current?.();
  }, []);

  const syncOwnership = useCallback(async () => {
    const ctx = getStore();
    if (!ctx) return;

    const product =
      ctx.store.get(PRODUCT_DOUBLE_JS, ctx.CdvPurchase.Platform.GOOGLE_PLAY) ??
      ctx.store.get(PRODUCT_DOUBLE_JS);

    if (product && product.canPurchase === false) {
      await markOwned();
    }
  }, [markOwned]);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    const initStore = async () => {
      const ctx = getStore();
      if (!ctx) {
        console.warn('Billing: cordova-plugin-purchase not available');
        return;
      }

      const { store, CdvPurchase } = ctx;
      store.verbosity = CdvPurchase.LogLevel.DEBUG;

      store.register({
        id: PRODUCT_DOUBLE_JS,
        type: CdvPurchase.ProductType.NON_CONSUMABLE,
        platform: CdvPurchase.Platform.GOOGLE_PLAY,
      });

      store.when().approved((tx) => {
        if (tx.productId === PRODUCT_DOUBLE_JS) {
          void markOwned().then(() => {
            toast.success('DOUBLE JS ACTIVATED FOREVER!');
          });
        }
        tx.verify();
      });

      store.when().verified((receipt) => receipt.finish());
      store.when().unverified(() => toast.error('Purchase could not be verified'));

      store.ready(() => {
        console.log('Billing: Store is ready');
        setIsReady(true);
        void syncOwnership();
      });

      store.error((err) => {
        console.error('Billing error:', err?.code, err?.message);
      });

      try {
        await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
        await store.update();
        await syncOwnership();
      } catch (e) {
        console.error('Billing: Initialization failed', e);
      }
    };

    void initStore();
  }, [markOwned, syncOwnership]);

  const purchase = async (id: string) => {
    const ctx = getStore();
    if (!ctx) {
      toast.error('Google Play billing is not available on this build.');
      return;
    }

    const { store, CdvPurchase } = ctx;

    if (!isReady) {
      toast.info('Connecting to Google Play...');
      try {
        await store.update();
      } catch {
        toast.error('Google Play store is still loading. Try again in a few seconds.');
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
        'Product not found. Create in-app product "double_js" in Play Console and install from Play testing.',
      );
      return;
    }

    if (!product.canPurchase) {
      await markOwned();
      toast.info('You already own Double JS.');
      return;
    }

    store.order(product);
  };

  return { isReady, purchase, ownsDoubleJs };
};
