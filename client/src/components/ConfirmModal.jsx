import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", isDestructive = true }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col scale-in-center">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            {isDestructive && <AlertTriangle className="w-5 h-5 text-red-500" />}
            {title}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-700 text-sm">{message}</p>
          <div className="mt-8 flex items-center justify-end gap-3">
            <button 
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onConfirm();
              }}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
