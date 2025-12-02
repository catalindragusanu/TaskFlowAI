import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ArrowRight, User, Mail, Lock, Loader2, ArrowLeft, Github } from 'lucide-react';
import { db } from '../services/databaseService';
import { v4 as uuidv4 } from 'uuid';

interface SignupPageProps {
  onLogin: (user: UserProfile) => void;
  onBack: () => void;
}

export const SignupPage: React.FC<SignupPageProps> = ({ onLogin, onBack }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const newUser: UserProfile = {
        id: uuidv4(),
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
        joinedAt: new Date().toISOString(),
      };
      
      const registeredUser = await db.registerUser(newUser);
      onLogin(registeredUser);
    } catch (err: any) {
      setError(err.message || "Failed to create account");
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
        setError(err.message || "Social login failed");
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
          
          <button 
            onClick={onBack}
            className="absolute top-6 left-6 text-silver/50 hover:text-smoke transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center mb-6 pt-4">
             <h1 className="text-3xl font-bold text-smoke tracking-tight">Create Account</h1>
             <p className="text-silver/60 text-sm mt-1">Join TaskFlow today</p>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button 
                onClick={() => handleSocialLogin('google')}
                className="flex items-center justify-center p-3 rounded-xl bg-onyx border border-garnet/30 hover:border-strawberry/50 hover:bg-garnet/10 transition-all group"
                title="Sign up with Google"
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
                title="Sign up with Apple"
            >
                <svg className="w-5 h-5 text-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.6534 16.9602C16.8837 18.0673 16.0354 19.1417 14.881 19.1654C13.7844 19.1654 13.4328 18.5146 12.1158 18.5146C10.8202 18.5146 10.4246 19.1417 9.39059 19.1891C8.24838 19.2372 7.15238 18.0673 6.38274 16.9602C4.80164 14.6738 3.59375 10.4912 5.17646 7.7497C5.96541 6.37684 7.39414 5.51354 8.95101 5.48912C10.0289 5.48912 11.0838 6.21074 11.7431 6.21074C12.3798 6.21074 13.6323 5.37119 14.8624 5.44238C15.3758 5.4654 16.8208 5.64969 17.7413 7.01429C17.6534 7.06175 15.5516 8.27137 15.5736 10.9181C15.5955 13.4325 17.7633 14.6186 17.8292 14.6423C17.7852 14.7847 17.4776 15.8282 16.9725 16.5574L17.6534 16.9602ZM11.6991 5.3468C12.248 4.63509 12.6214 3.63891 12.5115 2.6665C11.5667 2.71396 10.4246 3.2831 9.74209 4.08933C9.2148 4.75373 8.79744 5.77353 8.92925 6.72223C9.98375 6.79341 11.1499 6.09212 11.6991 5.3468Z" />
                </svg>
            </button>
            <button 
                onClick={() => handleSocialLogin('github')}
                className="flex items-center justify-center p-3 rounded-xl bg-onyx border border-garnet/30 hover:border-strawberry/50 hover:bg-garnet/10 transition-all group"
                title="Sign up with GitHub"
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-silver/80 uppercase tracking-wider mb-1.5 ml-1">Full Name</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-silver/50 group-focus-within:text-strawberry transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-onyx text-smoke pl-10 pr-4 py-3 rounded-xl border border-garnet/30 focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none transition-all placeholder:text-silver/20"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

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
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-silver/80 uppercase tracking-wider mb-1.5 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-silver/50 group-focus-within:text-strawberry transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-onyx text-smoke pl-10 pr-4 py-3 rounded-xl border border-garnet/30 focus:border-strawberry focus:ring-1 focus:ring-strawberry outline-none transition-all placeholder:text-silver/20 tracking-widest"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="w-full mt-6 bg-mahogany hover:bg-ruby text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(164,22,26,0.39)] hover:shadow-[0_6px_20px_rgba(164,22,26,0.23)] hover:-translate-y-0.5"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};