import React from 'react';
import { Server, Activity, AlertCircle, Zap, TrendingUp } from 'lucide-react';

export default function StatsGrid({ stats }) {
  return ( 
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <div className="group relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Total Containers</p>
            <p className="text-4xl font-black text-gray-900 mt-1">{stats.total}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp size={14} className="text-blue-500" />
              <span className="text-xs text-blue-600 font-medium">Active</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4">
              <Server className="text-white" size={28} />
            </div>
          </div>
        </div>
      </div>

      <div className="group relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Running</p>
            <p className="text-4xl font-black text-emerald-600 mt-1">{stats.running}</p>
            <div className="flex items-center gap-1 mt-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-xs text-emerald-600 font-medium">Healthy</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4">
              <Activity className="text-white" size={28} />
            </div>
          </div>
        </div>
      </div>

      <div className="group relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-red-500/5"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Stopped</p>
            <p className="text-4xl font-black text-red-600 mt-1">{stats.stopped}</p>
            <div className="flex items-center gap-1 mt-2">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-xs text-red-600 font-medium">Inactive</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-4">
              <AlertCircle className="text-white" size={28} />
            </div>
          </div>
        </div>
      </div>

      <div className="group relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-indigo-500/5"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Performance</p>
            <p className="text-4xl font-black text-purple-600 mt-1">98%</p>
            <div className="flex items-center gap-1 mt-2">
              <Zap size={14} className="text-purple-500" />
              <span className="text-xs text-purple-600 font-medium">Optimal</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/20 rounded-2xl blur-xl"></div>
            <div className="relative bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4">
              <Zap className="text-white" size={28} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
