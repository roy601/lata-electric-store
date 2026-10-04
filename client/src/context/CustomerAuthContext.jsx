import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, setRememberLogin } from '../lib/supabase';

const CustomerAuthContext = createContext(null);

/** Only allow returning to a page on this site (never an outside link). */
export const safeNext = (next) =>
  typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/account';

export const CustomerAuthProvider = ({ children }) => {
  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [recovery, setRecovery] = useState(false);   // arrived from a "reset password" email

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const origin = window.location.origin;

  const signUp = ({ email, password, firstName, lastName, next }) => {
    setRememberLogin(true);
    return supabase.auth.signUp({
      email,
      password,
      options: {
        // The confirmation email brings the customer back here (not to the Supabase default URL)
        emailRedirectTo: `${origin}${safeNext(next)}`,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
        },
      },
    });
  };

  const signIn = ({ email, password, rememberMe = true }) => {
    setRememberLogin(rememberMe);
    return supabase.auth.signInWithPassword({ email, password });
  };

  const oauth = (provider, next) => {
    setRememberLogin(true);
    return supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}${safeNext(next)}` } });
  };
  const signInWithGoogle   = (next) => oauth('google', next);
  const signInWithFacebook = (next) => oauth('facebook', next);

  const forgotPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` });

  const updatePassword = async (password) => {
    const res = await supabase.auth.updateUser({ password });
    if (!res.error) setRecovery(false);
    return res;
  };

  /** Name, phone and saved delivery address live in the account's metadata. */
  const updateProfile = async (fields) => {
    const data = { ...fields };
    if ('first_name' in fields || 'last_name' in fields) {
      const first = fields.first_name ?? user?.user_metadata?.first_name ?? '';
      const last  = fields.last_name  ?? user?.user_metadata?.last_name  ?? '';
      data.full_name = `${first} ${last}`.trim();
    }
    const res = await supabase.auth.updateUser({ data });
    if (!res.error && res.data?.user) setUser(res.data.user);
    return res;
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <CustomerAuthContext.Provider value={{
      user, loading, recovery,
      signUp, signIn, signInWithGoogle, signInWithFacebook, forgotPassword,
      updatePassword, updateProfile, signOut,
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
