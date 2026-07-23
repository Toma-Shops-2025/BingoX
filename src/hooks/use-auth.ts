import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

        const { data: { session } } = await supabase.auth.getSession();
        const metaName = session?.user?.user_metadata?.username || session?.user?.user_metadata?.display_name || 'Gamer';

        if (data) {
            // If profile exists but username is missing, update it
            if (!data.username) {
                await supabase.from('profiles').update({ username: metaName }).eq('id', userId);
                data.username = metaName;
            }
            setProfile(data);
        } else {
            const { data: newP } = await supabase.from('profiles').upsert({
                id: userId,
                username: metaName,
                display_name: metaName,
                jackpot_score: 0
            }).select().single();
            if (newP) setProfile(newP);
        }
    } catch (e) {
        console.error("Auth: fetchProfile error", e);
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
        await supabase.from('profiles').upsert({ id: data.user.id, username, display_name: username, jackpot_score: 0 });
    }
  };

  const addJS = useCallback(async (amount: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // ATOMIC INCREMENT
    const { error } = await supabase.rpc('increment_jackpot_score', {
        user_id: session.user.id,
        amount: amount
    });

    if (error) {
        const { data: current } = await supabase.from('profiles').select('jackpot_score').eq('id', session.user.id).single();
        const newTotal = (current?.jackpot_score || 0) + amount;
        await supabase.from('profiles').update({ jackpot_score: newTotal }).eq('id', session.user.id);
        setProfile((prev: any) => ({ ...prev, jackpot_score: newTotal }));
    } else {
        fetchProfile(session.user.id);
    }
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, profile, loading, signIn, signUp, signOut, addJS, supabase, fetchProfile };
}
