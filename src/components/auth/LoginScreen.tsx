import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaGoogle } from 'react-icons/fa';

export const LoginScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check for error in URL params (from OAuth callback)
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let success = false;
      if (isLogin) {
        success = await login(email, password);
      } else {
        success = await signUp(email, password, name);
      }

      if (success) {
        navigate('/home');
      } else {
        setError(isLogin ? 'Invalid credentials' : 'Sign up failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#2a2a2a] rounded-2xl shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-[#9ca3af] mb-8">
            {isLogin 
              ? 'Sign in to continue to your learning journey' 
              : 'Start your learning journey today'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                label="Full Name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
            
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <p className="text-sm text-[#ef4444]">{error}</p>
            )}

            <Button 
              type="submit" 
              fullWidth
              disabled={loading}
            >
              {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#3a3a3a]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-[#2a2a2a] text-[#9ca3af]">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={async () => {
                try {
                  setError('');
                  await signInWithGoogle();
                } catch (err) {
                  setError('Google sign in failed');
                }
              }}
              fullWidth
              variant="secondary"
              className="mt-4"
              disabled={loading}
            >
              <FaGoogle className="w-5 h-5" />
              Sign {isLogin ? 'in' : 'up'} with Google
            </Button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-[#9ca3af] hover:text-white transition-colors"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
