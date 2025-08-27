import React from 'react';
import { Trash2, Clock, Server, Plus } from 'lucide-react';

export default function ContainerGrid({
  containers,
  loading,
  onRemove,
  onAdd,
  formatUptime,
  getStatusColor,
  getStatusGradient
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
      {containers.map((container) => (
        <div
          key={container.id}
          className="group relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/40 p-6"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-indigo-500/5"></div>
          <div className="relative">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-bold text-gray-900 text-xl">
                    {container.name || `Container-${container.id?.slice(0, 8)}`}
                  </h3>
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(container.status || 'pending')} shadow-lg`}></div>
                </div>
                <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-200/60">
                  <p className="text-sm text-gray-600 font-mono">
                    ID: {container.id?.slice(0, 12) || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemove(container.id)}
                disabled={loading}
                className="text-gray-400 p-3 rounded-xl disabled:opacity-50"
                aria-label="Remove container"
              >
                <Trash2 size={20} />
              </button>
            </div>
            <div className="mb-6">
              <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${getStatusGradient(container.status)} text-white px-4 py-2 rounded-full shadow-lg`}>
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm font-semibold">
                  {(container.status || 'pending').charAt(0).toUpperCase() + (container.status || 'pending').slice(1)}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50/60 rounded-xl border border-gray-200/40">
                <span className="text-sm font-medium text-gray-700">Uptime</span>
                <span className="text-sm text-gray-900 flex items-center gap-2 font-mono">
                  <Clock size={16} className="text-blue-500" />
                  {formatUptime(container.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50/60 rounded-xl border border-gray-200/40">
                <span className="text-sm font-medium text-gray-700">Image</span>
                <span className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded-lg border">
                  {container.image || 'nginx:latest'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50/60 rounded-xl border border-gray-200/40">
                <span className="text-sm font-medium text-gray-700">Created</span>
                <span className="text-sm text-gray-900 font-medium">
                  {container.created_at
                    ? new Date(container.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Unknown'
                  }
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-600">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                  K3s Node Ready
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Server size={12} className="text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Empty State */}
      {containers.length === 0 && (
        <div className="col-span-full">
          <div className="text-center py-20">
            <div className="relative bg-white/80 backdrop-blur-sm border-2 border-dashed border-gray-300/60 rounded-3xl p-16 max-w-lg mx-auto shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl"></div>
              <div className="relative">
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <Server className="text-gray-400" size={40} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3">No Containers Deployed</h3>
                <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                  Ready to deploy your first container? Get started with our enterprise-grade infrastructure.
                </p>
                <button
                  onClick={onAdd}
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold shadow-xl"
                >
                  <Plus size={20} />
                  Deploy First Container
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
