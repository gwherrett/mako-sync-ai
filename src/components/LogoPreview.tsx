import React from 'react';
import BrandLogo from './BrandLogo';

const LogoPreview: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-8">
      <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
        <h2 className="text-xl font-semibold mb-6">Logo Preview</h2>
        
        {/* Show different sizes */}
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-600 mb-2">Small (40px)</p>
            <div className="flex justify-center">
              <BrandLogo size={40} />
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mb-2">Medium (80px)</p>
            <div className="flex justify-center">
              <BrandLogo size={80} />
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mb-2">Large (120px)</p>
            <div className="flex justify-center">
              <BrandLogo size={120} />
            </div>
          </div>
          
          <div>
            <p className="text-sm text-gray-600 mb-2">Extra Large (200px)</p>
            <div className="flex justify-center">
              <BrandLogo size={200} />
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => document.querySelector('[data-logo-preview]')?.remove()}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
};

export default LogoPreview;