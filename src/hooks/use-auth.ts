import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { type User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
        setProfile(data);
    } else {
        // Fallback: Check session if profile row doesn't exist yet
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            setProfile({
                username: session.user.user_metadata?.username || 'Gamer',
                jackpot_score: 0
            });
        }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
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
        options: { data: { username } }
    });
    if (error) throw error;
  };

  const addJS = useCallback(async (amount: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Use RPC or Upsert to be thread-safe
    const { data: profile } = await supabase.from('profiles').select('jackpot_score').eq('id', session.user.id).single();
    const newTotal = (profile?.jackpot_score || 0) + amount;

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        jackpot_score: newTotal,
        username: session.user.user_metadata?.username || 'Gamer'
      }, { onConflict: 'id' });

    if (!error) {
        setProfile((prev: any) => ({ ...prev, jackpot_score: newTotal }));
        return true;
    }
    return false;
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, profile, loading, signIn, signUp, signOut, addJS, supabase };
}
