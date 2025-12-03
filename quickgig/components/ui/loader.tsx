interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Loader({ size = 'md', className = '' }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4'
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-black border-t-transparent animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function LoadingState({ message = 'LOADING', size = 'lg' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Loader size={size} className="mb-4" />
      <p className="font-mono text-xs uppercase tracking-wider font-bold">{message}</p>
    </div>
  );
}
