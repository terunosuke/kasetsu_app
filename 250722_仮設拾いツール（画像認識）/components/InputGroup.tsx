
import React, { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';

type BaseProps = {
    label: string;
    as?: 'input' | 'select' | 'checkbox';
    children?: ReactNode;
    hideLabel?: boolean;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { as?: 'input' | 'checkbox' };
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { as: 'select' };

type InputGroupProps = BaseProps & (InputProps | SelectProps);

export const InputGroup: React.FC<InputGroupProps> = ({ label, as = 'input', hideLabel = false, ...props }) => {
    const commonClasses = "w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-primary transition duration-150 ease-in-out";

    const renderInput = () => {
        if (as === 'select') {
             return <select className={commonClasses} {...(props as SelectProps)}>{props.children}</select>;
        }
        if (as === 'checkbox') {
             const { className, ...rest } = props as InputProps;
             return (
                 <div className="flex items-center h-full">
                     <input type="checkbox" className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded" {...rest} />
                 </div>
             );
        }
        return <input className={commonClasses} {...(props as InputProps)} />;
    };
    
    if (as === 'checkbox') {
        return (
             <div className="flex items-center gap-2">
                {renderInput()}
                <label className={`block text-sm font-medium text-slate-700 ${hideLabel ? 'sr-only' : ''}`}>{label}</label>
             </div>
        );
    }

    return (
        <div>
            <label className={`block text-sm font-medium text-slate-700 mb-1 ${hideLabel ? 'sr-only' : ''}`}>
                {label}
            </label>
            {renderInput()}
        </div>
    );
};
