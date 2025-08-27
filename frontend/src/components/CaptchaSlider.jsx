// src/components/CaptchaSlider.jsx
import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

const CaptchaSlider = ({ onVerify }) => {
  const [sliderValue, setSliderValue] = useState(0);
  const [targetValue, setTargetValue] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showError, setShowError] = useState(false);
  
  // Generate a random target value when component mounts
  useEffect(() => {
    const newTarget = Math.floor(Math.random() * 81) + 10; // Random number between 10 and 90
    setTargetValue(newTarget);
  }, []);

  const handleSliderChange = (e) => {
    const newValue = parseInt(e.target.value, 10);
    setSliderValue(newValue);
    setShowFeedback(true);
    setShowError(false);
  };

  const resetCaptcha = () => {
    const newTarget = Math.floor(Math.random() * 81) + 10;
    setTargetValue(newTarget);
    setSliderValue(0);
    setShowFeedback(false);
    setShowError(false);
    setAttempts(0);
  };

  const handleSubmit = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    // Simulate processing delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (Math.abs(sliderValue - targetValue) <= 5) {
      setIsVerified(true);
      setTimeout(() => {
        onVerify(true);
      }, 1000);
    } else {
      setAttempts(prev => prev + 1);
      setShowError(true);
      if (attempts >= 2) {
        resetCaptcha();
      }
    }
    
    setIsProcessing(false);
  };

  const getSliderTrackColor = () => {
    if (!showFeedback) return 'bg-gradient-to-r from-gray-200 to-gray-300';
    const distance = Math.abs(sliderValue - targetValue);
    if (distance <= 5) return 'bg-gradient-to-r from-green-200 to-green-400';
    if (distance <= 15) return 'bg-gradient-to-r from-yellow-200 to-yellow-400';
    return 'bg-gradient-to-r from-red-200 to-red-400';
  };

  const getProximityMessage = () => {
    if (!showFeedback) return '';
    const distance = Math.abs(sliderValue - targetValue);
    if (distance <= 5) return 'Perfect! Ready to verify.';
    if (distance <= 15) return 'Getting close...';
    if (distance <= 30) return 'Keep trying...';
    return 'Too far away';
  };

  return (
    <div className="relative">
      {/* Animated background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-purple-50/80 rounded-2xl blur-sm"></div>
      
      {/* Main container */}
      <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 max-w-md mx-auto transform transition-all duration-500 hover:scale-[1.02]">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4 shadow-lg">
            <Shield className="text-white" size={28} />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
            Security Verification
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Slide the handle to align with the blue target marker to prove you're human
          </p>
        </div>

        {/* Target indicator */}
        <div className="mb-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 rounded-full px-4 py-2 border border-blue-100">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-blue-700 font-medium text-sm">Target: {targetValue}%</span>
          </div>
        </div>

        {/* Slider Container */}
        <div className="relative mb-6">
          <div className="relative w-full h-12 bg-gray-100 rounded-full overflow-hidden shadow-inner border border-gray-200">
            {/* Animated background track */}
            <div className={`absolute inset-0 ${getSliderTrackColor()} transition-all duration-300`}></div>
            
            {/* Target marker */}
            <div
              style={{ left: `${targetValue}%` }}
              className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <div className="w-1 h-8 bg-blue-500 rounded-full shadow-lg relative">
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-600 rounded-full animate-ping"></div>
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full"></div>
              </div>
            </div>

            {/* Custom slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={handleSliderChange}
              disabled={isVerified || isProcessing}
              className="absolute inset-0 w-full h-full appearance-none cursor-pointer bg-transparent z-30 slider-custom"
              style={{
                background: 'transparent',
              }}
            />

            {/* User's position indicator */}
            {showFeedback && (
              <div
                style={{ left: `${sliderValue}%` }}
                className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-200"
              >
                <div className={`w-2 h-8 rounded-full shadow-lg ${
                  Math.abs(sliderValue - targetValue) <= 5 ? 'bg-green-500' : 'bg-red-500'
                } transition-colors duration-200`}></div>
              </div>
            )}
          </div>

          {/* Progress indicators */}
          <div className="flex justify-between mt-2 px-1">
            <span className="text-xs text-gray-400">0</span>
            <span className="text-xs text-gray-600 font-medium">Current: {sliderValue}%</span>
            <span className="text-xs text-gray-400">100</span>
          </div>
        </div>

        {/* Feedback message */}
        {showFeedback && (
          <div className="text-center mb-4">
            <p className={`text-sm font-medium transition-all duration-300 ${
              Math.abs(sliderValue - targetValue) <= 5 
                ? 'text-green-600' 
                : Math.abs(sliderValue - targetValue) <= 15 
                ? 'text-yellow-600' 
                : 'text-red-600'
            }`}>
              {getProximityMessage()}
            </p>
          </div>
        )}

        {/* Error message */}
        {showError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 animate-shake">
            <AlertCircle className="text-red-500" size={16} />
            <p className="text-red-700 text-sm">
              Not quite right. {attempts >= 2 ? 'Generating new challenge...' : `${3 - attempts} attempts remaining.`}
            </p>
          </div>
        )}

        {/* Success message */}
        {isVerified && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 mb-4 animate-fadeIn">
            <CheckCircle className="text-green-500" size={16} />
            <p className="text-green-700 text-sm font-medium">Verification successful! Redirecting...</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={isProcessing || isVerified || !showFeedback}
            className="flex-1 relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin" />
                <span>Verifying...</span>
              </div>
            ) : isVerified ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                <span>Verified!</span>
              </div>
            ) : (
              'Verify Human'
            )}
          </button>

          <button
            onClick={resetCaptcha}
            disabled={isProcessing || isVerified}
            className="px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-transparent rounded-xl transition-colors duration-200 border border-gray-200 hover:border-gray-300"
            title="Generate new challenge"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Attempts indicator */}
        {attempts > 0 && !isVerified && (
          <div className="flex justify-center mt-4">
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                    i < attempts ? 'bg-red-400' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom styles */}
      <style jsx>{`
        .slider-custom::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .slider-custom::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }
        
        .slider-custom::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CaptchaSlider;