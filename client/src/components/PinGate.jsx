import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Loader2, Lock } from 'lucide-react';

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function PinGate({ onAuth }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError('');

    try {
      const enteredHash = await sha256(pin.trim());

      const { data, error: fetchError } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['admin_pin', 'employee_pin']);

      if (fetchError) throw fetchError;

      const settings = {};
      (data || []).forEach(row => { settings[row.key] = row.value; });

      if (enteredHash === settings['admin_pin']) {
        sessionStorage.setItem('role', 'admin');
        onAuth('admin');
      } else if (enteredHash === settings['employee_pin']) {
        sessionStorage.setItem('role', 'employee');
        onAuth('employee');
      } else {
        setError('Incorrect PIN. Try again.');
        setPin('');
        triggerShake();
      }
    } catch (err) {
      console.error(err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div
        className={`bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center transition-all ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Logo / Icon */}
        <div className="inline-flex items-center justify-center bg-blue-600 text-white p-4 rounded-2xl mb-5 shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Mamta Lighting</h1>
        <p className="text-gray-500 text-sm mb-8">Enter your PIN to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); }}
            placeholder="••••"
            className={`w-full border-2 rounded-xl px-4 py-4 text-center text-3xl tracking-[0.5em] font-bold focus:outline-none transition-colors ${
              error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-blue-500'
            }`}
            autoFocus
          />

          {error && (
            <p className="text-red-500 text-sm font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enter'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
