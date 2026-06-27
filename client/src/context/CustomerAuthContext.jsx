import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const CustomerAuthContext = createContext(null);

export const CustomerAuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = ({ email, password, firstName, lastName }) =>
    supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });

  const signIn = async ({ email, password, rememberMe = true }) => {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (!result.error && !rememberMe) {
      // Move session out of localStorage so it clears on browser close
      const storageKey = Object.keys(localStorage).find(
        k => k.startsWith('sb-') && k.endsWith('-auth-token')
      );
      if (storageKey) {
        sessionStorage.setItem(storageKey, localStorage.getItem(storageKey));
        localStorage.removeItem(storageKey);
      }
    }
    return result;
  };

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/account` },
    });

  const signInWithFacebook = () =>
    supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${window.location.origin}/account` },
    });

  const forgotPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

  const signOut = () => supabase.auth.signOut();

  return (
    <CustomerAuthContext.Provider value={{
      user, loading,
      signUp, signIn, signInWithGoogle, signInWithFacebook, forgotPassword, signOut,
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used inside <CustomerAuthProvider>');
  return ctx;
};
