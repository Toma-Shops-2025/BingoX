import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type User } from '@supabase/supabase-js';
import { toast } from 'sonner';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

        if (error) {
            console.error("Auth: fetchProfile error", error);
            setLoading(false);
            return;
        }

        if (data) {
            setProfile(data);
        } else {
            // New user - create profile
            const { data: { session } } = await supabase.auth.getSession();
            const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Gamer';

            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: username,
                    jackpot_score: 0,
                    total_earned: 0
                })
                .select()
                .single();

            if (!createError) setProfile(newProfile);
        }
    } catch (e) {
        console.error("Auth: fetchProfile critical error", e);
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Timeout to prevent infinite loading screen
    const timer = setTimeout(() => {
        if (loading) {
            console.warn("Auth: Loading timed out, assuming no session");
            setLoading(false);
        }
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
      } else {
          setLoading(false);
      }
      clearTimeout(timer);
    }).catch(() => {
        setLoading(false);
        clearTimeout(timer);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
      } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
      }
    });

    return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
    };
  }, [fetchProfile]);

  const addCash = useCallback(async (amount: number, game: string = 'Bingo X') => {
    if (!user) return;

    try {
        const { error } = await supabase.rpc('claim_game_reward', {
            p_game: game,
            p_score: 1,
            p_reward_est: amount
        });

        if (error) {
            console.warn("RPC failed, attempting manual update...");
            const { data: current } = await supabase.from('profiles').select('cash_balance, total_earned').eq('id', user.id).single();
            const newTotal = (current?.cash_balance || 0) + amount;
            const newLifetime = (current?.total_earned || 0) + (amount > 0 ? amount : 0);

            await supabase.from('profiles').update({
                cash_balance: newTotal,
                total_earned: newLifetime
            }).eq('id', user.id);
        }

        await fetchProfile(user.id);
    } catch (e) {
        console.error("Cash sync failed", e);
    }
  }, [user, fetchProfile]);

  const addJS = useCallback(async (amount: number) => {
    if (!user) return;

    try {
        const { data: current } = await supabase
            .from('profiles')
            .select('jackpot_score, total_earned')
            .eq('id', user.id)
            .single();

        const newScore = Math.max(0, (current?.jackpot_score || 0) + amount);
        const newLifetime = (current?.total_earned || 0) + (amount > 0 ? amount : 0);

        const { error } = await supabase.from('profiles').update({
            jackpot_score: newScore,
            total_earned: newLifetime,
        }).eq('id', user.id);

        if (error) throw error;
        await fetchProfile(user.id);
    } catch (e) {
        console.error("JS sync failed", e);
        throw e;
    }
  }, [user, fetchProfile]);

  const signIn = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  };

  const signUp = async (email: string, pass: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { username } }
    });
    if (error) throw error;
    // Database trigger handles the rest!
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const activateDoubleJs = useCallback(async () => {
    if (!user) return;

    localStorage.setItem('bingox_double_js', '1');

    const { error } = await supabase
      .from('profiles')
      .update({ has_double_js: true })
      .eq('id', user.id);

    if (error) {
      console.warn('activateDoubleJs: profile update failed (run Supabase migration if needed)', error.message);
    }

    setProfile((prev: any) => (prev ? { ...prev, has_double_js: true } : prev));
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  return { user, profile, loading, signIn, signUp, signOut, addCash, addJS, activateDoubleJs, supabase, fetchProfile };
}
