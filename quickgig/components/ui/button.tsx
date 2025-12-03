import { type ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      disabled,
      fullWidth,
      children,
      ...props
    },
    ref
  ) => {
    // Base inline styles - Minimal with hover effects
    const baseStyle: React.CSSProperties = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      transition: 'all 300ms ease',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? '0.5' : '1',
      border: '0',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: fullWidth ? '100%' : 'auto',
      position: 'relative',
      overflow: 'hidden'
    };

    // Variant styles - Minimal black and white only
    const variantStyles: Record<string, React.CSSProperties> = {
      primary: {
        background: '#000000',
        color: '#FFFFFF',
        border: '2px solid #000000'
      },
      secondary: {
        background: '#FFFFFF',
        color: '#000000',
        border: '2px solid #000000'
      },
      outline: {
        background: 'transparent',
        color: '#000000',
        border: '2px solid #000000'
      },
      ghost: {
        background: 'transparent',
        color: '#000000'
      },
      danger: {
        background: '#000000',
        color: '#FFFFFF',
        border: '2px solid #000000'
      },
      success: {
        background: '#000000',
        color: '#FFFFFF',
        border: '2px solid #000000'
      },
      info: {
        background: '#000000',
        color: '#FFFFFF',
        border: '2px solid #000000'
      }
    };

    // Size styles - Reduced padding
    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: {
        padding: '8px 16px',
        fontSize: '11px'
      },
      md: {
        padding: '10px 24px',
        fontSize: '12px'
      },
      lg: {
        padding: '12px 32px',
        fontSize: '13px'
      },
      xl: {
        padding: '14px 40px',
        fontSize: '14px'
      }
    };

    // Combine all styles
    const combinedStyle = {
      ...baseStyle,
      ...variantStyles[variant],
      ...sizeStyles[size]
    };

    // Hover handler
    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;
      const button = e.currentTarget;
      if (variant === 'primary') {
        button.style.background = '#FFFFFF';
        button.style.color = '#000000';
      } else if (variant === 'outline') {
        button.style.background = '#000000';
        button.style.color = '#FFFFFF';
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return;
      const button = e.currentTarget;
      if (variant === 'primary') {
        button.style.background = '#000000';
        button.style.color = '#FFFFFF';
      } else if (variant === 'outline') {
        button.style.background = 'transparent';
        button.style.color = '#000000';
      }
    };

    return (
      <button
        ref={ref}
        className={className}
        style={combinedStyle}
        disabled={disabled || isLoading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {isLoading && (
          <svg
            className="mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            style={{
              animation: 'spin 1s linear infinite',
              marginRight: '8px'
            }}
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              style={{ opacity: '0.25' }}
            />
            <path
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              style={{ opacity: '0.75' }}
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
