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
import SwitchComparePage from './components/SwitchComparePage';
import QuotePreview from './components/QuotePreview';
import CustomerDatabase from './components/CustomerDatabase';
import PinGate from './components/PinGate';
import ManufacturingPortal from './components/ManufacturingPortal';
import RawComponents from './components/RawComponents';
import { History as HistoryIcon, ArrowLeftRight, PackageSearch, ToggleLeft, Zap, FileText, Settings, GitCompare, Eye, Users, ClipboardList, Boxes, LogOut } from 'lucide-react';
import { useQuoteStore } from './store/useQuoteStore';

function App() {
  const [role, setRole] = useState(() => sessionStorage.getItem('role') || null);
  const [activeTab, setActiveTab] = useState('new-quote');
  const { systemMode, setSystemMode, items, quoteType } = useQuoteStore();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.type === 'number' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
      }
    };
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

  const handleAuth = (authRole) => {
    setRole(authRole);
    if (authRole === 'employee') {
      // Employee goes straight to manufacturing, no system select needed
      setActiveTab('manufacturing');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('role');
    setRole(null);
  };

  const handleSelectSystem = (mode) => {
    setTimeout(() => {
      startTransition(() => {
        setSystemMode(mode);
        if (mode === 'Customer Database') {
          setActiveTab('customers');
        } else if (mode === 'Raw Components') {
          setActiveTab('raw-components');
        } else {
          setActiveTab('new-quote');
        }
      });
    }, 0);
  };

  // ── PIN GATE ────────────────────────────────────────────────────────────
  if (!role) {
    return <PinGate onAuth={handleAuth} />;
  }

  // ── EMPLOYEE VIEW: Manufacturing only ────────────────────────────────────
  if (role === 'employee') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-1.5 rounded-lg">
              <ClipboardList className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">Mamta Lighting</h1>
              <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Manufacturing</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </nav>
        <main className="flex-1 flex flex-col overflow-y-auto">
          <ManufacturingPortal role="employee" />
        </main>
        <ToastContainer />
      </div>
    );
  }

  // ── ADMIN VIEW ───────────────────────────────────────────────────────────
  const isImageSystem = systemMode === 'Image Quote';
  const isSwitchSystem = systemMode === 'Switch Quote';
  const isWireSystem = systemMode === 'Wire Quote';
  const isCustomerDb = systemMode === 'Customer Database';
  const isRawComponents = systemMode === 'Raw Components';
  const isManufacturing = activeTab === 'manufacturing';

  // Manufacturing portal — check BEFORE home screen so card navigation works
  if (isManufacturing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <div className="bg-orange-100 p-1.5 rounded-lg">
              <ClipboardList className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Manufacturing Portal</h1>
              <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Job Management</p>
            </div>
          </div>
          <button
            onClick={() => { startTransition(() => { setActiveTab('new-quote'); setSystemMode(null); }); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Home
          </button>
        </nav>
        <div className="flex-1 overflow-auto">
          <ManufacturingPortal role="admin" />
        </div>
      </div>
    );
  }

  // Home screen (no system selected)
  if (!systemMode) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center bg-blue-600 text-white p-3 rounded-2xl mb-4 shadow-lg">
              <PackageSearch className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Mamta Lighting</h1>
            <p className="text-gray-500 mt-2 text-lg">Select a system to begin</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Image Quote */}
            <button onClick={() => handleSelectSystem('Image Quote')} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all text-left group flex flex-col justify-between h-full">
              <div>
                <div className="bg-blue-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <PackageSearch className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Image Quotation</h2>
                <p className="text-gray-500 mb-6 text-base">Build visual quotations with product images for clients.</p>
              </div>
              <span className="text-blue-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all mt-auto">Enter System →</span>
            </button>

            {/* Switch Quote */}
            <button onClick={() => handleSelectSystem('Switch Quote')} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all text-left group flex flex-col justify-between h-full">
              <div>
                <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ToggleLeft className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Switch Quotation</h2>
                <p className="text-gray-500 mb-6 text-base">Spreadsheet-style quotation builder for modular switches.</p>
              </div>
              <span className="text-purple-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all mt-auto">Enter System →</span>
            </button>

            {/* Wire Quote */}
            <button onClick={() => handleSelectSystem('Wire Quote')} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all text-left group flex flex-col justify-between h-full">
              <div>
                <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Wire Quotation</h2>
                <p className="text-gray-500 mb-6 text-base">Dedicated system for house wires, cables, and conduit pipes.</p>
              </div>
              <span className="text-green-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all mt-auto">Enter System →</span>
            </button>

            {/* Customer Database */}
            <button onClick={() => handleSelectSystem('Customer Database')} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-amber-300 hover:shadow-xl transition-all text-left group flex flex-col justify-between h-full">
              <div>
                <div className="bg-amber-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Database</h2>
                <p className="text-gray-500 mb-6 text-base">Consolidated customer profiles and unified quotation history.</p>
              </div>
              <span className="text-amber-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all mt-auto">Enter Database →</span>
            </button>

            {/* Raw Components */}
            <button onClick={() => handleSelectSystem('Raw Components')} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-slate-400 hover:shadow-xl transition-all text-left group flex flex-col justify-between h-full">
              <div>
                <div className="bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Boxes className="w-8 h-8 text-slate-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Raw Components</h2>
                <p className="text-gray-500 mb-6 text-base">Manage the global catalog of manufacturing parts and components.</p>
              </div>
              <span className="text-slate-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all mt-auto">Manage Parts →</span>
            </button>

            {/* Manufacturing Portal */}
            <button onClick={() => { setSystemMode(null); setTimeout(() => { startTransition(() => { setActiveTab('manufacturing'); }); }, 0); }} className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all text-left group flex flex-col justify-between h-full">
              <div>
                <div className="bg-orange-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ClipboardList className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Manufacturing Portal</h2>
                <p className="text-gray-500 mb-6 text-base">Track and manage manufacturing jobs with component checklists.</p>
              </div>
              <span className="text-orange-600 font-semibold flex items-center gap-2 text-base group-hover:gap-3 transition-all mt-auto">View Jobs →</span>
            </button>
          </div>

          {/* Logout */}
          <div className="flex justify-center mt-10">
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }



  // ── RAW COMPONENTS ─────────────────────────────────────────────────────────
  if (isRawComponents) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 p-2 rounded-lg">
              <Boxes className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Mamta Lighting</h1>
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Raw Components</p>
            </div>
          </div>
          <button
            onClick={() => setSystemMode(null)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" /> Switch System
          </button>
        </nav>
        <main className="flex-1 overflow-y-auto p-6">
          <RawComponents />
        </main>
        <ToastContainer />
      </div>
    );
  }

  // ── MAIN TABBED APP (all quote systems + customer db) ─────────────────────
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-hidden">

      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0 z-30 shadow-sm relative print:hidden">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg text-white ${
            isImageSystem ? 'bg-blue-600' :
            isSwitchSystem ? 'bg-purple-600' :
            isWireSystem ? 'bg-green-600' :
            'bg-amber-600'
          }`}>
            {isImageSystem ? <PackageSearch className="w-6 h-6" /> :
             isSwitchSystem ? <ToggleLeft className="w-6 h-6" /> :
             isWireSystem ? <Zap className="w-6 h-6" /> :
             <Users className="w-6 h-6" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Mamta Lighting</h1>
            <p className={`text-xs font-medium tracking-wide uppercase ${
              isImageSystem ? 'text-blue-600' :
              isSwitchSystem ? 'text-purple-600' :
              isWireSystem ? 'text-green-600' :
              'text-amber-600'
            }`}>
              {isCustomerDb ? 'Customer Database' : `${systemMode} System`}
            </p>
          </div>
        </div>

        {/* Tab buttons - horizontal scroll on mobile */}
        <div className="w-full md:w-auto overflow-x-auto">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg min-w-max">
            {systemMode !== 'Customer Database' && (
              <>
                <button
                  onClick={() => setTimeout(() => startTransition(() => setActiveTab('new-quote')), 0)}
                  className={`px-3 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'new-quote' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <FileText className="w-4 h-4" /> New Quote
                </button>
                {isImageSystem && (
                  <button
                    onClick={() => setTimeout(() => startTransition(() => setActiveTab('preview')), 0)}
                    className={`px-3 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                )}
                <button
                  onClick={() => setTimeout(() => startTransition(() => setActiveTab('history')), 0)}
                  className={`px-3 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <HistoryIcon className="w-4 h-4" /> History
                </button>
              </>
            )}

            {systemMode === 'Customer Database' && (
              <button
                onClick={() => setTimeout(() => startTransition(() => setActiveTab('customers')), 0)}
                className={`px-3 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'customers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <Users className="w-4 h-4" /> Customer Database
              </button>
            )}

            {systemMode !== 'Customer Database' && (
              <>
                <button
                  onClick={() => setTimeout(() => startTransition(() => setActiveTab('management')), 0)}
                  className={`px-3 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'management' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <Settings className="w-4 h-4" /> Products
                </button>
                {isSwitchSystem && (
                  <button
                    onClick={() => setTimeout(() => startTransition(() => setActiveTab('compare')), 0)}
                    className={`px-3 py-2 rounded-md font-medium text-sm flex items-center gap-1.5 transition-colors whitespace-nowrap ${activeTab === 'compare' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    <GitCompare className="w-4 h-4" /> Compare
                  </button>
                )}
              </>
            )}


          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTimeout(() => { startTransition(() => { setSystemMode(null); }); }, 0); }}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <ArrowLeftRight className="w-4 h-4" /> Switch System
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-gray-700 bg-white border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

        {activeTab === 'new-quote' && (
          <>
            {isImageSystem && (
              <>
                <div className="w-full md:w-[60%] flex-none md:flex-1 h-auto md:h-full flex flex-col border-b md:border-b-0 md:border-r border-gray-300 bg-white relative z-30">
                  <Catalog />
                </div>
                <div className="w-full md:w-[40%] flex-none md:flex-1 h-auto md:h-full flex flex-col bg-white">
                  <Cart />
                </div>
              </>
            )}
            {isSwitchSystem && (
              <div className="w-full h-full flex flex-col">
                <SwitchQuotePage />
              </div>
            )}
            {isWireSystem && (
              <div className="w-full h-full flex flex-col">
                <WireQuotePage />
              </div>
            )}
          </>
        )}

        {activeTab === 'compare' && isSwitchSystem && (
          <div className="w-full h-full flex flex-col"><SwitchComparePage /></div>
        )}

        {activeTab === 'preview' && isImageSystem && (
          <div className="w-full h-full flex flex-col overflow-y-auto"><QuotePreview /></div>
        )}

        {activeTab === 'history' && (
          <div className="w-full flex justify-center p-4 sm:p-8 bg-gray-50 overflow-y-auto">
            <div className="max-w-4xl w-full">
              <History setActiveTab={setActiveTab} role={role} />
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="w-full flex justify-center p-4 sm:p-8 bg-gray-50 overflow-y-auto">
            <div className="max-w-6xl w-full">
              <CustomerDatabase setActiveTab={setActiveTab} />
            </div>
          </div>
        )}

        {activeTab === 'management' && (
          <div className="w-full flex justify-center p-4 sm:p-8 bg-gray-50 overflow-y-auto">
            <div className="max-w-4xl w-full">
              {isImageSystem && <ProductManagement />}
              {isSwitchSystem && <SwitchProductManagement />}
              {isWireSystem && <WireProductManagement />}
            </div>
          </div>
        )}

      </main>

      <ToastContainer />
    </div>
  );
}

export default App;