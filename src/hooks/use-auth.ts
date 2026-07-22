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
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            setProfile(data);
        } else {
            // Profile doesn't exist, create it from user metadata
            const { data: { user } } = await supabase.auth.getUser();
            const username = user?.user_metadata?.username || 'Gamer';
            const { data: newProfile, error: createError } = await supabase
                .from('profiles')
                .upsert({ id: userId, username: username, jackpot_score: 0 })
                .select()
                .single();
            if (newProfile) setProfile(newProfile);
        }
    } catch (e) {
        console.error("Auth: Profile fetch error", e);
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
        options: { data: { username } }
    });
    if (error) throw error;
    // Force create profile row immediately
    if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, username, jackpot_score: 0 });
    }
  };

  const addJS = useCallback(async (amount: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // 1. Get freshest score
    const { data: current } = await supabase.from('profiles').select('jackpot_score').eq('id', session.user.id).single();
    const newTotal = (current?.jackpot_score || 0) + amount;

    // 2. Update DB
    const { error } = await supabase
      .from('profiles')
      .update({ jackpot_score: newTotal })
      .eq('id', session.user.id);

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
