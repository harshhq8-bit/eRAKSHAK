import React from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { useDevice } from '../../contexts/DeviceContext.js';
import { Shield, Sun, Moon, Wifi, Smartphone, LogOut, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { espStatus, mobileStatus } = useDevice();

  const userName = profile?.name || user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-rose-100 dark:border-rose-950/40 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-700 via-red-600 to-rose-500 flex items-center justify-center text-white shadow-md shadow-rose-600/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <Link to="/dashboard" className="text-xl font-bold bg-gradient-to-r from-red-600 to-rose-700 bg-clip-text text-transparent tracking-tight flex items-center gap-1.5 font-['Outfit']">
              Simple IoT World
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                eRAKSHAK
              </span>
            </Link>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Smart IoT Security & Face Recognition Hub
            </p>
          </div>
        </div>

        {/* Live Device Status Badges */}
        <div className="hidden md:flex items-center space-x-3">
          {/* ESP8266 Status */}
          <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            espStatus === 'ONLINE'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
          }`}>
            <Wifi className="h-3.5 w-3.5" />
            <span>ESP8266:</span>
            <span className="font-bold flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${espStatus === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              {espStatus}
            </span>
          </div>

          {/* Mobile Camera Status */}
          <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
            mobileStatus.online
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
          }`}>
            <Smartphone className="h-3.5 w-3.5" />
            <span>Mobile:</span>
            <span className="font-bold flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${mobileStatus.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {mobileStatus.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Quick link to Mobile Camera companion */}
          <Link
            to="/mobile"
            className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Open Mobile Face Recognition Companion"
          >
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Companion</span>
          </Link>
        </div>

        {/* Right side: Welcome <USER NAME>, Theme toggle, Logout */}
        <div className="flex items-center space-x-3">
          {/* Welcome User Banner */}
          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">Logged in as</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Welcome <span className="text-rose-600 dark:text-rose-400">{userName}</span>
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={signOut}
            title="Sign Out"
            className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border border-rose-200/60 dark:border-rose-900/50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
