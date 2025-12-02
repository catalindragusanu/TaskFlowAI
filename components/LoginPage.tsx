import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ArrowRight, Lock, Mail, Loader2, Github, HelpCircle, ArrowLeft } from 'lucide-react';
import { db } from '../services/databaseService';
import { useToast } from './Toast';

interface LoginPageProps {
  onLogin: (user: UserProfile) => void;
  onGotoSignup: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onGotoSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Password Reset Mode
  const [isResetting, setIsResetting] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    // Handle Password Reset
    if (isResetting) {
        setIsLoading(true);
        setError('');
        try {
            await db.resetPassword(email.trim());
            addToast("Reset email sent. Check your inbox.", "success");
            setIsResetting(false);
        } catch (err: any) {
            setError(err.message || "Failed to send reset email.");
        } finally {
            setIsLoading(false);
        }
        return;
    }

    // Handle Normal Login
    setIsLoading(true);
    setError('');
    try {
      const user = await db.loginUser(email.trim(), password.trim());
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'github') => {
    setIsLoading(true);
    setError('');
    try {
        const user = await db.socialLogin(provider);
        onLogin(user);
    } catch (err: any) {
        setError(err.message || "Social login failed.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-onyx flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-mahogany/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-strawberry/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="bg-carbon border border-garnet/30 rounded-2xl shadow-2xl p-8 relative backdrop-blur-xl">
          
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4 group">
              <div className="absolute inset-0 bg-strawberry/20 blur-xl rounded-full group-hover:bg-strawberry/40 transition-all duration-500"></div>
              <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative drop-shadow-2xl">
                <path d="M20 8V16M35 8V16M50 8V16M65 8V16M80 8V16" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <path d="M20 84V92M35 84V92M50 84V92M65 84V92M80 84V92" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <path d="M8 20H16M8 35H16M8 50H16M8 65H16M8 80H16" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <path d="M84 20H92M84 35H92M84 50H92M84 65H92M84 80H92" stroke="#a4161a" strokeWidth="6" strokeLinecap="round"/>
                <rect x="16" y="16" width="68" height="68" rx="10" fill="#ba181b" />
                <rect x="24" y="24" width="52" height="52" rx="4" fill="#660708" />
                <rect x="26" y="26" width="48" height="48" rx="3" stroke="#e5383b" strokeWidth="2" />
                <text x="50" y="62" fontFamily="sans-serif" fontSize="30" fontWeight="bold" fill="white" textAnchor="middle">AI</text>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-smoke tracking-tight">
                {isResetting ? "Reset Password" : "TaskFlow"}
            </h1>
            <p className="text-silver/60 text-sm mt-1">
              {isResetting 
                ? "Enter your email to receive instructions" 
                : (!db.isRealMode ? "Demo Mode (Simulated Login)" : "Intelligent Task Management")
              }
            </p>
          </div>

          {!isResetting && (
            <>
                {/* Social Login Buttons */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <button 
                        onClick={() => handleSocialLogin('google')}
                        className="flex items-center justify-center p-3 rounded-xl bg-onyx border border-garnet/30 hover:border-strawberry/50 hover:bg-garnet/10 transition-all group"
                        title="Sign in with Google"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#EA4335"/>
                            <path d="M12.24 24.0008C15.4765 24.0008 18.2058 22.9382 20.1945 21.1039L16.3275 18.1055C15.2517 18.8375 13.8627 19.252 12.2445 19.252C9.11388 19.252 6.45946 17.1399 5.50705 14.3003H1.5166V17.3912C3.55371 21.4434 7.7029 24.0008 12.24 24.0008Z" fill="#34A853"/>
                            <path d="M5.50253 14.3003C5.00236 12.8099 5.00236 11.1961 5.50253 9.70575V6.61481H1.51649C-0.18551 10.0056 -0.18551 14.0004 1.51649 17.3912L5.50253 14.3003Z" fill="#FBBC05"/>
                            <path d="M12.24 4.74966C13.9509 4.7232 15.6044 5.36697 16.8434 6.54867L20.2695 3.12262C18.1001 1.0855 15.2208 -0.034466 12.24 0.000808666C7.7029 0.000808666 3.55371 2.55822 1.5166 6.61481L5.50264 9.70575C6.45064 6.86173 9.10947 4.74966 12.24 4.74966Z" fill="#4285F4"/>
                        </svg>
                    </button>
                    <button 
                        onClick={() => handleSocialLogin('apple')}
                        className="flex items-center justify-center p-3 rounded-xl bg-onyx border border-garnet/30 hover:border-strawberry/50 hover:bg-garnet/10 transition-all group"
                        title="Sign in with Apple"
                    >
                        <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.6534 16.9602C16.8837 18.0673 16.0354 19.1417 14.881 19.1654C13.7844 19.1654 13.4328 18.5146 12.1158 18.5146C10.8202 18.5146 10.4246 19.1417 9.39059 19.1891C8.24838 19.2372 7.15238 18.0673 6.38274 16.9602C4.80164 14.6738 3.59375 10.4912 5.17646 7.7497C5.96541 6.37684 7.39414 5.51354 8.95101 5.48912C10.0289 5.48912 11.0838 6.21074 11.7431 6.21074C12.3798 6.21074 13.6323 5.37119 14.8624 5.44238C15.3758 5.4654 16.8208 5.64969 17.7413 7.01429C17.6534 7.06175 15.5516 8.27137 15.5736 10.9181C15.5955 13.4325 17.7633 14.6186 17.8292 14.6423C17.7852 14.7847 17.4776 15.8282 16.9725 16.5574L17.6534 16.9602ZM11.6991 5.3468C12.248 4.63509 12.6214 3.63891 12.5115 2.6665C11.5667 2.71396 10.4246 3.2831 9.74209 4.08933C9.2148 4.75373 8.79744 5.77353 8.92925 6.72223C9.98375 6.79341 11.1499 6.09212 11.6991 5.3468Z" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => handleSocialLogin('github')}
                        className="flex items-center justify-center p-3 rounded-xl bg-onyx border border-garnet/30 hover:border-strawberry/50 hover:bg-garnet/10 transition-all group"
                        title="Sign in with GitHub"
                    >
                        <Github className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                    </button>
                </div>

                <div className="relative flex items-center justify-center mb-6">
                    <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-garnet/30"></div>
                    </div>
                    <span className="relative bg-carbon px-2 text-xs text-silver/40 uppercase tracking-widest">Or continue with</span>
                </div>
            </>
          )}

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg text-center animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-silver/80 uppercase tracking-wider mb-1.5 ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-silver/50 group-focus-within:text-strawberry transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-onyx text-smoke pl-10 pr-4 py-3 rounded-xl border border-garnet/30 focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none transition-all placeholder:text-silver/20"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {!isResetting && (
                <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                    <label className="block text-xs font-semibold text-silver/80 uppercase tracking-wider">
                        Password
                    </label>
                    <button 
                        type="button" 
                        onClick={() => { setIsResetting(true); setError(''); }}
                        className="text-xs text-strawberry hover:text-white transition-colors"
                    >
                        Forgot?
                    </button>
                </div>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-silver/50 group-focus-within:text-strawberry transition-colors">
                    <Lock className="w-5 h-5" />
                    </div>
                    <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-onyx text-smoke pl-10 pr-4 py-3 rounded-xl border border-garnet/30 focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none transition-all placeholder:text-silver/20 tracking-widest"
                    placeholder="••••"
                    required
                    />
                </div>
                </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full mt-6 bg-mahogany hover:bg-ruby text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(164,22,26,0.39)] hover:shadow-[0_6px_20px_rgba(164,22,26,0.23)] hover:-translate-y-0.5"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isResetting ? "Send Reset Email" : "Sign In"}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            
            {isResetting && (
                <button
                    type="button"
                    onClick={() => { setIsResetting(false); setError(''); }}
                    className="w-full text-sm text-silver hover:text-white flex items-center justify-center gap-1 transition-colors mt-4"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                </button>
            )}
          </form>

          {!isResetting && (
            <div className="mt-6 text-center">
                <p className="text-sm text-silver">
                Don't have an account?{' '}
                <button onClick={onGotoSignup} className="text-strawberry hover:underline font-medium">
                    Sign up
                </button>
                </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};