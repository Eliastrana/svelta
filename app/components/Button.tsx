import React from 'react';

type ButtonVariant = 'primary' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', type = 'button', variant = 'primary', ...props }, ref) => {
        const variantClass = variant === 'ghost' ? 'button-ghost' : 'confirm-button';
        return (
            <button
                ref={ref}
                type={type}
                className={`${variantClass} ${className}`.trim()}
                {...props}
            />
        );
    },
);

Button.displayName = 'Button';

export default Button;
