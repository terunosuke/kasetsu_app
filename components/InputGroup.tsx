import React, { InputHTMLAttributes, SelectHTMLAttributes, ReactNode, useId } from 'react';

type BaseProps = {
    label: string;
    as?: 'input' | 'select' | 'checkbox';
    children?: ReactNode;
    hideLabel?: boolean;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { as?: 'input' | 'checkbox' };
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { as: 'select' };

type InputGroupProps = BaseProps & (InputProps | SelectProps);

export const InputGroup: React.FC<InputGroupProps> = ({ label, as = 'input', hideLabel = false, children, ...props }) => {
    const id = useId();
    const commonClasses = "w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 ease-in-out";

    if (as === 'select') {
        return (
            <div>
                <label htmlFor={id} className={`block text-sm font-medium text-slate-700 mb-1 ${hideLabel ? 'sr-only' : ''}`}>
                    {label}
                </label>
                <select id={id} className={commonClasses} {...(props as SelectHTMLAttributes<HTMLSelectElement>)}>{children}</select>
            </div>
        );
    }
    
    if (as === 'checkbox') {
        return (
             <div className="flex items-center gap-2">
                <input id={id} type="checkbox" className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded" {...(props as InputHTMLAttributes<HTMLInputElement>)} />
                <label htmlFor={id} className={`block text-sm font-medium text-slate-700 ${hideLabel ? 'sr-only' : ''}`}>{label}</label>
             </div>
        );
    }

    // Default to 'input'
    return (
        <div>
            <label htmlFor={id} className={`block text-sm font-medium text-slate-700 mb-1 ${hideLabel ? 'sr-only' : ''}`}>
                {label}
            </label>
            <input id={id} className={commonClasses} {...(props as InputHTMLAttributes<HTMLInputElement>)} />
        </div>
    );
};
