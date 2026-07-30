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
            return;
        }

        if (data) {
            setProfile(data);
        } else {
            const { data: { session } } = await supabase.auth.getSession();
            const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Gamer';

            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: username,
                    jackpot_score: 0
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id);
      } else {
          setLoading(false);
      }
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

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const addJS = useCallback(async (amount: number) => {
    if (!user) return;

    try {
        // 1. Update jackpot_score (current balance)
        const { error: scoreErr } = await supabase.rpc('increment_jackpot_score', {
            user_id: user.id,
            amount: amount
        });

        // 2. If it's a positive gain, also update total_earned (for leaderboard)
        if (amount > 0) {
            await supabase.rpc('increment_total_earned', {
                user_id: user.id,
                amount: amount
            }).catch(() => {
                console.warn("total_earned column might not exist yet");
            });
        }

        if (scoreErr) {
            console.warn("RPC failed, attempting manual update...");
            const { data: current } = await supabase.from('profiles').select('jackpot_score, total_earned').eq('id', user.id).single();
            const newTotal = (current?.jackpot_score || 0) + amount;
            const newLifetime = (current?.total_earned || 0) + (amount > 0 ? amount : 0);

            await supabase.from('profiles').update({
                jackpot_score: newTotal,
                total_earned: newLifetime
            }).eq('id', user.id);
        }

        // FORCE SYNC
        await fetchProfile(user.id);
    } catch (e) {
        console.error("Score sync failed", e);
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
        options: { data: { username, display_name: username } }
    });
    if (error) throw error;
    if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, username, jackpot_score: 0 });
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, profile, loading, signIn, signUp, signOut, addJS, supabase, fetchProfile };
}
