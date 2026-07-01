import React, { useState, useEffect, startTransition } from 'react';
import Catalog from './components/Catalog';
import Cart from './components/Cart';
import ProductManagement from './components/ProductManagement';
import SwitchQuotePage from './components/SwitchQuotePage';
import WireQuotePage from './components/WireQuotePage';
import SwitchProductManagement from './components/SwitchProductManagement';
import WireProductManagement from './components/WireProductManagement';
import History from './components/History';
import ToastContainer from './components/ToastContainer';
import { History as HistoryIcon, ArrowLeftRight, PackageSearch, ToggleLeft, Zap, FileText, Settings } from 'lucide-react';
import { useQuoteStore } from './store/useQuoteStore';
import { supabase } from './supabase';

function App() {
  const [activeTab, setActiveTab] = useState('new-quote');
  const { systemMode, setSystemMode, items, quoteType } = useQuoteStore();

  const handleSelectSystem = (mode) => {
    // Defer the heavy component mount to the next tick so the click paints instantly (0ms INP)
    setTimeout(() => {
      startTransition(() => {
        setSystemMode(mode);
        setActiveTab('new-quote');
      });
    }, 0);
  };

  // Unsaved Changes Protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (items && items.length > 0) {
        const message = "You have unsaved changes. Are you sure you want to leave?";
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items]);

  if (!systemMode) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center bg-blue-600 text-white p-3 rounded-2xl mb-4 shadow-lg">
              <PackageSearch className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Mamta Lighting</h1>
            <p className="text-gray-500 mt-2 text-lg">Select a Quotation System to begin</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Image Quote System Card */}
            <button 
              onClick={() => handleSelectSystem('Image Quote')}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all text-left group"
            >
              <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <PackageSearch className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Image Quotation</h2>
              <p className="text-gray-500 mb-6 text-base">Build visual quotations with product images for clients. Ideal for decorative lights, fans, and fixtures.</p>
              <span className="text-blue-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all">
                Enter System &rarr;
              </span>
            </button>

            {/* Switch Quote System Card */}
            <button 
              onClick={() => handleSelectSystem('Switch Quote')}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all text-left group"
            >
              <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ToggleLeft className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Switch Quotation</h2>
              <p className="text-gray-500 mb-6 text-base">Spreadsheet-style quotation builder for modular switches, plates, and accessories.</p>
              <span className="text-purple-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all">
                Enter System &rarr;
              </span>
            </button>
            
            {/* Wire Quote System Card */}
            <button 
              onClick={() => handleSelectSystem('Wire Quote')}
              className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all text-left group"
            >
              <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Wire Quotation</h2>
              <p className="text-gray-500 mb-6 text-base">Dedicated system for house wires, cables, and conduit pipes with coil-based pricing.</p>
              <span className="text-green-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all">
                Enter System &rarr;
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // Disable scrolling number inputs with arrow keys globally
    const handleKeyDown = (e) => {
      if (document.activeElement.type === 'number' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
      }
    };
    
    // Disable scrolling number inputs with mouse wheel globally
    const handleWheel = (e) => {
      if (document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const isImageSystem = systemMode === 'Image Quote';
  const isSwitchSystem = systemMode === 'Switch Quote';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-hidden">
      
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 z-30 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-white ${isImageSystem ? 'bg-blue-600' : isSwitchSystem ? 'bg-purple-600' : 'bg-green-600'}`}>
            {isImageSystem ? <PackageSearch className="w-6 h-6" /> : isSwitchSystem ? <ToggleLeft className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Mamta Lighting</h1>
            <p className={`text-xs font-medium tracking-wide uppercase ${isImageSystem ? 'text-blue-600' : isSwitchSystem ? 'text-purple-600' : 'text-green-600'}`}>
              {systemMode} System
            </p>
          </div>
        </div>

        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setTimeout(() => startTransition(() => setActiveTab('new-quote')), 0)}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'new-quote' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <FileText className="w-4 h-4" /> New Quote
          </button>
          <button 
            onClick={() => setTimeout(() => startTransition(() => setActiveTab('history')), 0)}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <HistoryIcon className="w-4 h-4" /> History
          </button>
          <button 
            onClick={() => setTimeout(() => startTransition(() => setActiveTab('management')), 0)}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'management' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Settings className="w-4 h-4" /> Products
          </button>
        </div>

        <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setTimeout(() => {
                  startTransition(() => {
                    setSystemMode(null);
                  });
                }, 0);
              }}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Switch System
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        
        {activeTab === 'new-quote' && (
          <>
            {systemMode === 'Image Quote' && (
              <>
                {/* LEFT PANEL: PRODUCT DISCOVERY */}
                <div className="w-full md:w-[60%] flex-none md:flex-1 h-auto md:h-full flex flex-col border-b md:border-b-0 md:border-r border-gray-300 bg-white relative z-30">
                  <Catalog />
                </div>

                {/* RIGHT PANEL: QUOTATION CART */}
                <div className="w-full md:w-[40%] flex-none md:flex-1 h-auto md:h-full flex flex-col bg-white">
                  <Cart />
                </div>
              </>
            )}
            {systemMode === 'Switch Quote' && (
              <div className="w-full h-full flex flex-col">
                <SwitchQuotePage />
              </div>
            )}
            {systemMode === 'Wire Quote' && (
              <div className="w-full h-full flex flex-col">
                <WireQuotePage />
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <div className="w-full flex justify-center p-8 bg-gray-50 overflow-y-auto">
            <div className="max-w-4xl w-full">
              <History setActiveTab={setActiveTab} />
            </div>
          </div>
        )}

        {activeTab === 'management' && (
          <div className="w-full flex justify-center p-8 bg-gray-50 overflow-y-auto">
            <div className="max-w-4xl w-full">
              {systemMode === 'Image Quote' && <ProductManagement />}
              {systemMode === 'Switch Quote' && <SwitchProductManagement />}
              {systemMode === 'Wire Quote' && <WireProductManagement />}
            </div>
          </div>
        )}

      </main>
      
      <ToastContainer />
    </div>
  );
}

export default App;