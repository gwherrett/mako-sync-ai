import React from 'react';

interface BrandLogoProps {
  size?: number;
  className?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 40, className = '' }) => {
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
        
        {/* Shark fin */}
        <path
          d="M12 25 L20 12 L28 25 L24 23 L20 26 L16 23 Z"
          fill="rgba(0,0,0,0.8)"
        />
        
        {/* Accent dot */}
        <circle
          cx="20"
          cy="28"
          r="1.5"
          fill="rgba(0,0,0,0.6)"
        />
      </svg>
    </div>
  );
};

export default BrandLogo;