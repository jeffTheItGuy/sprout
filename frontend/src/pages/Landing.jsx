// src/pages/Landing.jsx
import React, { useState, useEffect } from 'react';
import { Shield, Globe, Plus, RefreshCw, AlertCircle } from "lucide-react";
import Header from '../components/Header';
import StatsGrid from '../components/StatsGrid';
import ContainerGrid from '../components/ContainerGrid';
import CaptchaSlider from '../components/CaptchaSlider';
import '../css/animate.css';

// Utility functions
const getStatusColor = (status) => {
  switch (status) {
    case 'running': return 'bg-emerald-400';
    case 'stopped': return 'bg-red-400';
    case 'pending': return 'bg-amber-400';
    case 'failed': return 'bg-red-500';
    default: return 'bg-gray-400';
  }
};

const getStatusGradient = (status) => {
  switch (status) {
    case 'running': return 'from-emerald-500 to-green-600';
    case 'stopped': return 'from-red-500 to-red-600';
    case 'pending': return 'from-amber-500 to-orange-600';
    case 'failed': return 'from-red-600 to-red-700';
    default: return 'from-gray-500 to-gray-600';
  }
};

// Fixed timezone-aware uptime calculation
const formatUptime = (createdAt) => {
  if (!createdAt) return '0m';
  
  let created;
  if (createdAt.includes('T')) {
    created = !createdAt.endsWith('Z') && !createdAt.includes('+') 
      ? new Date(createdAt + 'Z') 
      : new Date(createdAt);
  } else {
    created = new Date(createdAt);
  }
  
  const now = new Date();
  const diff = Math.floor((now - created) / 1000 / 60); 
  
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  return `${Math.floor(diff / 1440)}d ${Math.floor((diff % 1440) / 60)}h`;
};

// Function to format creation time in local timezone
const formatCreatedTime = (createdAt) => {
  if (!createdAt) return 'Unknown';
  
  let created;
  if (createdAt.includes('T')) {
    created = !createdAt.endsWith('Z') && !createdAt.includes('+') 
      ? new Date(createdAt + 'Z') 
      : new Date(createdAt);
  } else {
    created = new Date(createdAt);
  }
  
  return created.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

function Landing() {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, running: 0, stopped: 0 });
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [pageLoaded, setPageLoaded] = useState(false);

  // Rate limit state
  const [rateLimit, setRateLimit] = useState({
    limit: 120,
    remaining: 120,
    reset_in_seconds: 0,
    window: 900
  });

  // Determine API base URL (supports localhost and production)
  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 
    (window.location.hostname === 'localhost' 
      ? 'http://localhost:8000'
      : `${window.location.protocol}//${window.location.host}/api`);

  const API_KEY = import.meta.env.VITE_API_KEY || 'demo123';

  useEffect(() => setPageLoaded(true), []);

  //  Fetch Containers with Rate Limit Error Handling
  const fetchContainers = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/containers`, {
        headers: { 'X-API-Key': API_KEY }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please wait before trying again.");
        } else {
          throw new Error(`Failed to load containers: Rate limit may have exceeded. ${errorData.detail || `HTTP ${response.status}`}`);
        }
      }

      const data = await response.json();
      
      const containersWithFormattedTime = data.map(container => ({
        ...container,
        displayCreatedTime: formatCreatedTime(container.created_at)
      }));
      
      setContainers(containersWithFormattedTime);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch Rate Limit Status 
  const fetchRateLimit = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/rate-limit`, {
        headers: { 'X-API-Key': API_KEY }
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimit(data);
      }
    } catch (err) {
      console.warn('Could not fetch rate limit info:', err);
    }
  };

  // Initial Load and Polling
  useEffect(() => {
    fetchContainers();
    fetchRateLimit();

    // Poll containers every 15 seconds (60 requests/15min max)
    const containerInterval = setInterval(fetchContainers, 15000);

    // Poll rate limit every 60 seconds (15 requests/15min max)
    const limitInterval = setInterval(fetchRateLimit, 60000);

    return () => {
      clearInterval(containerInterval);
      clearInterval(limitInterval);
    };
  }, []);

  //  Update Stats on Container Change 
  useEffect(() => {
    const running = containers.filter(c => c.status === 'running').length;
    const stopped = containers.length - running;
    setStats({ total: containers.length, running, stopped });
  }, [containers]);

  //  CAPTCHA FLOW 
  const requestCaptchaToken = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/captcha/request`, {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          throw new Error("Too many attempts. Please wait before trying again.");
        }
        throw new Error('Failed to initialize CAPTCHA. Rate limit may be exceeded.');
      }

      const { captcha_token } = await res.json();
      setCaptchaToken(captcha_token);
      return captcha_token;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const handleCaptchaVerify = async (sliderVerified) => {
    if (!sliderVerified || !captchaToken) return;

    setShowCaptcha(false);

    try {
      if (pendingAction === 'create') {
        await executeCreateContainer();
      } else if (pendingAction === 'delete' && targetId) {
        await executeDeleteContainer(targetId);
      }
      // Refresh data after success
      fetchContainers();
      fetchRateLimit();
    } catch (err) {
      setError(err.message);
    } finally {
      setCaptchaToken(null);
      setPendingAction(null);
      setTargetId(null);
      setLoading(false);
    }
  };

  // Create Container 
  const executeCreateContainer = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/containers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          captcha_token: captchaToken,
          name: `container-${Date.now()}`,
          image: 'nginx:latest'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Action failed: Rate limit exceeded. Please wait before trying again.");
        } else {
          throw new Error(errorData.detail || `Create failed: HTTP ${response.status}`);
        }
      }

      const newContainer = await response.json();
      newContainer.displayCreatedTime = formatCreatedTime(newContainer.created_at);
      setContainers(prev => [...prev, newContainer]);
    } catch (err) {
      throw err;
    }
  };

  // Delete Container 
  const executeDeleteContainer = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/containers/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          captcha_token: captchaToken
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error("Deletion failed: Rate limit exceeded. Please wait.");
        } else {
          throw new Error(errorData.detail || `Delete failed: HTTP ${response.status}`);
        }
      }

      setContainers(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      throw err;
    }
  };

  // Trigger CAPTCHA for Create
  const addContainer = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestCaptchaToken();
      setPendingAction('create');
      setShowCaptcha(true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  //  Trigger CAPTCHA for Delete
  const removeContainer = async (id) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await requestCaptchaToken();
      setPendingAction('delete');
      setTargetId(id);
      setShowCaptcha(true);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden transition-all duration-1000 ${pageLoaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Background patterns */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-10 left-10 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-1/2 right-10 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-gradient-to-br from-emerald-400/20 to-blue-600/20 rounded-full blur-3xl animate-float-slow"></div>
      </div>
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgb(15 23 42) 1px, transparent 0)`,
        backgroundSize: '24px 24px'
      }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">

        <Header onRefresh={fetchContainers} refreshing={refreshing} />

        <StatsGrid stats={stats} />

        {/* Error Alert */}
        {error && (
          <div className="mb-8 transform transition-all duration-500 translate-y-0 opacity-100">
            <div className="relative overflow-hidden bg-red-50/90 backdrop-blur-sm border border-red-200/80 rounded-2xl p-6 shadow-lg">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-red-600/5"></div>
              <div className="relative flex items-center gap-4">
                <div className="bg-red-100 rounded-full p-2">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800">Action Failed</h3>
                  <p className="text-red-700 mt-1">{error}</p>
                </div>
                <button 
                  onClick={() => setError(null)} 
                  className="text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg p-2 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/*  Container Management Header */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/40 p-8 mb-12 relative overflow-hidden transform transition-all duration-1000 delay-600 translate-y-0 opacity-100">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-indigo-500/5"></div>
          <div className="relative flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                Container Management
              </h2>
              <p className="text-gray-600 mt-2 text-lg">Deploy and orchestrate containers with enterprise-grade security</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-green-500" />
                  <span className="text-sm text-green-600 font-medium">Secured</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-blue-500" />
                  <span className="text-sm text-blue-600 font-medium">Global CDN</span>
                </div>
              </div>
            </div>
            {stats.running >= 3 ? (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 max-w-md shadow-md">
                <div className="flex items-center gap-3 text-amber-800">
                  <AlertCircle size={20} />
                  <span className="font-medium">
                    Max containers running ({stats.running}/3)
                  </span>
                </div>
                <p className="text-amber-700 text-sm mt-1">
                  Delete a container to deploy a new one.
                </p>
              </div>
            ) : (
              <button
                onClick={addContainer}
                disabled={loading}
                className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
                <div className="relative flex items-center gap-3">
                  {loading ? (
                    <>
                     <RefreshCw size={20} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      <span>Deploy Container</span>
                    </>
                  )}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* CAPTCHA Modal  */}
        {showCaptcha && (
          <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-blue-900/30 to-purple-900/40 backdrop-blur-sm flex items-center justify-center z-50 animate__animated animate__fadeIn">
            <button
              onClick={() => {
                setShowCaptcha(false);
                setCaptchaToken(null);
                setPendingAction(null);
                setTargetId(null);
                setLoading(false);
              }}
              className="absolute top-6 right-6 text-white/80 hover:text-white text-2xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-all duration-200"
            >
              ×
            </button>
            <div className="animate__animated animate__slideIn">
              <CaptchaSlider onVerify={handleCaptchaVerify} />
            </div>
          </div>
        )}

        {/* Container Grid */}
        <ContainerGrid
          containers={containers}
          loading={loading}
          onRemove={removeContainer}
          onAdd={addContainer}
          formatUptime={formatUptime}
          getStatusColor={getStatusColor}
          getStatusGradient={getStatusGradient}
          formatCreatedTime={formatCreatedTime}
        />

        {/* Loading Placeholder */}
        {refreshing && containers.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
              <RefreshCw className="relative mx-auto text-blue-600 mb-6 animate-spin" size={60} />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Containers</h3>
            <p className="text-gray-600">Fetching your container infrastructure...</p>
          </div>
        )}

        {/*  RATE LIMIT DISPLAY */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-wrap items-center gap-4 px-6 py-4 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-blue-500" />
              <span className="font-semibold text-gray-800">API Rate Limit</span>
            </div>
            <div className="w-px h-6 bg-gray-300"></div>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${rateLimit.remaining < 10 ? 'text-red-600' : 'text-emerald-600'}`}>
                {rateLimit.remaining}
              </span>
              <span className="text-gray-600">of {rateLimit.limit} requests used</span>
            </div>
            <div className="w-px h-6 bg-gray-300"></div>
            {rateLimit.reset_in_seconds > 0 ? (
              <div className="flex items-center gap-1 text-gray-600">
                <RefreshCw size={14} className="animate-spin" />
                <span>Resets in {Math.ceil(rateLimit.reset_in_seconds / 60)} minute(s)</span>
              </div>
            ) : (
              <div className="text-green-600 font-medium">Ready for more requests</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;