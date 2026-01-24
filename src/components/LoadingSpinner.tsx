import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text,
  fullScreen = false 
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  const spinner = (
    <>
      <Loader2 className={`${sizes[size]} animate-spin text-blue-600`} />
      {text && <p className="ml-3 text-gray-600">{text}</p>}
    </>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex items-center">
          {spinner}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-4">
      {spinner}
    </div>
  );
};
