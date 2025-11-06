import React, { useState } from 'react';
import makoSharkImage from '/lovable-uploads/e4b87a4e-9811-48cc-8416-672fd487b3e0.png';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 40, className = '' }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    setImageError(true);
  };

  if (imageError) {
    // Fallback to original SVG if image fails to load
    return (
      <div 
        className={`flex items-center justify-center rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(200 100% 50%)" />
              <stop offset="100%" stopColor="hsl(185 100% 50%)" />
            </linearGradient>
          </defs>
          
          {/* Outer circle */}
          <circle
            cx="20"
            cy="20"
            r="19"
            fill="url(#logoGradient)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          
          {/* Water splash base */}
          <path
            d="M8 28 Q12 26 16 28 Q20 30 24 28 Q28 26 32 28 L32 32 Q20 34 8 32 Z"
            fill="rgba(255,255,255,0.3)"
          />
          
          {/* Jumping Mako Shark */}
          <path
            d="M20 8 C22 8 24 10 26 12 L28 16 C28 18 26 20 24 20 L22 22 C20 24 18 22 16 20 L14 16 C14 14 16 12 18 10 C18.5 9 19.2 8 20 8 Z"
            fill="rgba(0,0,0,0.9)"
          />
          
          {/* Shark tail */}
          <path
            d="M15 18 L12 22 L14 24 L17 20 Z"
            fill="rgba(0,0,0,0.8)"
          />
          
          {/* Shark dorsal fin */}
          <path
            d="M20 10 L18 14 L22 12 Z"
            fill="rgba(0,0,0,0.7)"
          />
          
          {/* Water droplets */}
          <circle cx="12" cy="24" r="1" fill="rgba(255,255,255,0.6)" />
          <circle cx="28" cy="25" r="0.8" fill="rgba(255,255,255,0.5)" />
          <circle cx="15" cy="26" r="0.6" fill="rgba(255,255,255,0.4)" />
        </svg>
      </div>
    );
  }

  return (
    <div 
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Animated glow effect */}
      <div 
        className="absolute inset-0 rounded-full animate-pulse"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)',
          animation: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}
      />
      
      {/* Tail splash effect */}
      <div 
        className="absolute -right-1 top-1/2 -translate-y-1/2 animate-tail-splash"
      >
        <div className="w-2 h-2 bg-serato-cyan/60 rounded-full blur-sm" />
      </div>
      
      {/* Simple white circle background */}
      <div 
        className="relative w-full h-full rounded-full overflow-hidden bg-white border border-gray-200 shadow-lg transition-transform duration-300 hover:scale-105"
        style={{ width: size, height: size }}
      >
        <img
          src={makoSharkImage}
          alt="Mako Shark Logo"
          className="w-full h-full object-cover"
          onError={handleImageError}
          style={{
            imageRendering: 'crisp-edges'
          }}
        />
      </div>
    </div>
  );
};

export default BrandLogo;