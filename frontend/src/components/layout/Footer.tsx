import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full py-6 mt-auto border-t border-rose-100 dark:border-rose-950/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-center">
      <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center space-y-1">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5">
          Developed by Justice League
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
          Dept of ETC, SBJAIN
        </p>
      </div>
    </footer>
  );
};
