import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Sí, eliminar',
  cancelText = 'No, cancelar',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-black hover:bg-white rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
            <p className="text-sm text-zinc-700">{message}</p>
          </div>
        </div>
        <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-colors">{cancelText}</button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-red-200 transition-all">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;