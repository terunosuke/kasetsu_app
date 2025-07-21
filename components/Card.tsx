
import React, { useState, ReactNode } from 'react';

interface CardProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
      <button
        className="w-full flex justify-between items-center p-4 text-left focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-slate-200">
          {children}
        </div>
      )}
    </div>
  );
};
