import React, { useState, useEffect } from 'react';
import Catalog from './components/Catalog';
import Cart from './components/Cart';
import ProductManagement from './components/ProductManagement';
import History from './components/History';
import ToastContainer from './components/ToastContainer';
import { PackageSearch, FileText, Settings, History as HistoryIcon } from 'lucide-react';
import { useQuoteStore } from './store/useQuoteStore';
import ManualQuote from './components/ManualQuote';

function App() {
  const [activeTab, setActiveTab] = useState('new-quote');
  const { quoteType, setQuoteMetadata, items } = useQuoteStore();

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-hidden">
      
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 z-30 shadow-sm relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Mamta Lighting</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">Quotation System</p>
          </div>
        </div>

        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('new-quote')}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'new-quote' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <FileText className="w-4 h-4" /> New Quote
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <HistoryIcon className="w-4 h-4" /> History
          </button>
          <button 
            onClick={() => setActiveTab('management')}
            className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors ${activeTab === 'management' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Settings className="w-4 h-4" /> Products
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        
        {activeTab === 'new-quote' && (
          <>
            {!quoteType ? (
              <div className="w-full flex items-center justify-center bg-gray-50 p-8">
                <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Image Quote Card */}
                  <button 
                    onClick={() => setQuoteMetadata({ quoteType: 'Image Quote' })}
                    className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left group"
                  >
                    <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <PackageSearch className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Image Quote</h2>
                    <ul className="text-gray-500 space-y-2 mb-6">
                      <li>• Lights</li>
                      <li>• Fans</li>
                      <li>• Decorative Fixtures</li>
                      <li>• Products with Images</li>
                    </ul>
                    <span className="text-blue-600 font-medium flex items-center gap-2">
                      Start Image Quote &rarr;
                    </span>
                  </button>

                  {/* Manual Quote Card */}
                  <button 
                    onClick={() => setQuoteMetadata({ quoteType: 'Manual Quote' })}
                    className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow text-left group"
                  >
                    <div className="bg-purple-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <FileText className="w-8 h-8 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Manual Quote</h2>
                    <ul className="text-gray-500 space-y-2 mb-6">
                      <li>• Wires</li>
                      <li>• Switches</li>
                      <li>• MCBs & Cables</li>
                      <li>• Accessories</li>
                    </ul>
                    <span className="text-purple-600 font-medium flex items-center gap-2">
                      Start Manual Quote &rarr;
                    </span>
                  </button>
                </div>
              </div>
            ) : quoteType === 'Image Quote' ? (
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
            ) : (
              <div className="w-full h-full flex flex-col bg-white">
                 <ManualQuote />
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
               <ProductManagement />
            </div>
          </div>
        )}

      </main>
      
      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;