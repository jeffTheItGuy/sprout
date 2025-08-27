import React from 'react';
import { RefreshCw } from 'lucide-react';
import Logo from '../assets/logo.svg';

export default function Header({ onRefresh, refreshing, apiBaseUrl }) {
  return (
    <header className="mb-12 transform transition-all duration-1000 delay-200 translate-y-0 opacity-100">
      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur-xl"></div>
          <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/40 shadow-xl">
            <h1 className="text-5xl font-black bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent flex items-center gap-4">
              <img
                src={Logo}
                alt="K3 Container Manager Logo"
                className="h-15 w-auto sm:30 md:h-30 lg:h-40 filter drop-shadow-lg"
              />
               Container Management Demo
            </h1>
            <p className="text-gray-700 mt-3 text-lg font-medium">
               Orchestrates deployment of pods to a k3
            </p>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2 bg-emerald-50 rounded-full px-3 py-1 border border-emerald-200">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-emerald-700 font-medium text-xs">LIVE</span>
              </div>
              <p className="text-sm text-gray-500 font-mono">
                API: {apiBaseUrl}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="group relative overflow-hidden bg-white/90 backdrop-blur-sm hover:bg-white border border-gray-200/80 hover:border-gray-300 text-gray-700 hover:text-gray-900 px-6 py-3 rounded-xl transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-all duration-300"></div>
          <div className="relative flex items-center gap-2">
            <RefreshCw size={18} className={`transition-transform duration-300 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
            Refresh
          </div>
        </button>
      </div>
    </header>
  );
}