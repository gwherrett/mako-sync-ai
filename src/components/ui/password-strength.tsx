import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  {
    label: 'At least 8 characters',
    test: (password) => password.length >= 8,
  },
  {
    label: 'One lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: 'One uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: 'One number',
    test: (password) => /\d/.test(password),
  },
];

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  className,
}) => {
  const metRequirements = requirements.filter(req => req.test(password));
  const strength = metRequirements.length;
  
  const getStrengthColor = () => {
    if (strength === 0) return 'bg-gray-600';
    if (strength <= 1) return 'bg-red-500';
    if (strength <= 2) return 'bg-orange-500';
    if (strength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (strength === 0) return 'Enter password';
    if (strength <= 1) return 'Weak';
    if (strength <= 2) return 'Fair';
    if (strength <= 3) return 'Good';
    return 'Strong';
  };

  if (!password) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Strength bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Password strength</span>
          <span className={cn(
            'text-xs font-medium',
            strength === 0 && 'text-gray-400',
            strength <= 1 && 'text-red-400',
            strength <= 2 && 'text-orange-400',
            strength <= 3 && 'text-yellow-400',
            strength === 4 && 'text-green-400'
          )}>
            {getStrengthText()}
          </span>
        </div>
        
        <div className="flex space-x-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-200',
                level <= strength ? getStrengthColor() : 'bg-gray-600'
              )}
            />
          ))}
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-1">
        {requirements.map((requirement, index) => {
          const isMet = requirement.test(password);
          return (
            <div
              key={index}
              className={cn(
                'flex items-center space-x-2 text-xs transition-colors duration-200',
                isMet ? 'text-green-400' : 'text-gray-400'
              )}
            >
              {isMet ? (
                <Check className="w-3 h-3" />
              ) : (
                <X className="w-3 h-3" />
              )}
              <span>{requirement.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PasswordStrength;