import React from 'react';
import { useToastStore } from '../store/useToastStore';
import { X, AlertCircle, CheckCircle } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[300px] max-w-sm border-l-4 bg-white ${toast.type === 'error' ? 'border-red-500' : 'border-green-500'} animate-in slide-in-from-right-8 duration-300`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          )}
          
          <div className="flex-1 text-sm text-gray-800 font-medium pt-0.5">
            {toast.message}
          </div>
          
          <button 
            onClick={() => removeToast(toast.id)} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
