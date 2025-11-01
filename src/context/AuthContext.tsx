import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { supabase, userService } from '../services/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      const currentUser = await userService.getCurrentUser();
      if (currentUser) {
        setUser({
          id: currentUser.id,
          email: currentUser.email || '',
          name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User',
        });
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 Attempting login for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error);
        throw error;
      }
      
      if (!data.user) {
        console.error('❌ No user data returned');
        return false;
      }

      console.log('✅ Login successful:', data.user.id);
      
      setUser({
        id: data.user.id,
        email: data.user.email || '',
        name: data.user.user_metadata?.name || email.split('@')[0],
      });

      return true;
    } catch (error) {
      console.error('❌ Login error:', error);
      return false;
    }
  };

  const signUp = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('📝 Attempting sign up for:', email, 'Name:', name);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        console.error('❌ Sign up error:', error);
        
        // Check for leaked password error
        const errorMessage = error.message?.toLowerCase() || '';
        if (errorMessage.includes('compromised') || 
            errorMessage.includes('breach') || 
            errorMessage.includes('pwned') ||
            errorMessage.includes('leaked')) {
          return {
            success: false,
            error: 'This password has been found in a data breach. Please choose a different, unique password.',
          };
        }
        
        throw error;
      }
      
      if (!data.user) {
        console.error('❌ No user data returned');
        return { success: false, error: 'Sign up failed. Please try again.' };
      }

      console.log('✅ Sign up successful:', data.user.id);

      setUser({
        id: data.user.id,
        email: data.user.email || '',
        name,
      });

      return { success: true };
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      return { 
        success: false, 
        error: error.message || 'An error occurred during sign up' 
      };
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    try {
      console.log('🔐 Attempting Google sign in');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('❌ Google sign in error:', error);
        throw error;
      }

      console.log('✅ Google sign in initiated');
      // The actual sign-in will happen via OAuth redirect
      // The auth state change listener will handle updating the user
    } catch (error) {
      console.error('❌ Google sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await userService.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        signUp,
        signInWithGoogle,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
