import React, { useEffect, useState } from 'react';
import {
  LogOut,
  UtensilsCrossed,
  ShoppingBag,
  Clock,
  Plus,
  Minus,
  Receipt,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LogoImg from '../../assets/image.png';
import { clearAuthSession } from '../../utils/auth';
import {
  getExaminerMenu,
  getExaminerOrders,
  getExaminerSession,
  placeExaminerOrder,
} from '../../services/examinerService';

const ExternalExaminerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('menu');
  const [isLoading, setIsLoading] = useState(true);

  const [guestDetails, setGuestDetails] = useState({
    name: 'Guest Examiner',
    code: 'G-XXX',
    roleLabel: 'External Examiner',
  });

  const [categorySettings, setCategorySettings] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({});
  const [myOrders, setMyOrders] = useState([]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const handleSignOut = () => {
    clearAuthSession();
    navigate('/', { replace: true });
  };

  const syncMenuState = (menuData) => {
    const nextSettings = menuData.categorySettings || {};
    const nextItems = menuData.menuItems || [];
    const activeIds = new Set(nextItems.map((item) => item._id));

    setCategorySettings(nextSettings);
    setMenuItems(nextItems);
    setCart((prev) => {
      const pruned = Object.fromEntries(Object.entries(prev).filter(([itemId]) => activeIds.has(itemId)));
      return pruned;
    });
  };

  const refreshMenuFromServer = async () => {
    try {
      const menuData = await getExaminerMenu();
      syncMenuState(menuData);
    } catch {
      // Silent refresh: do not interrupt the examiner while background syncing.
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sessionData, menuData, ordersData] = await Promise.all([
        getExaminerSession(),
        getExaminerMenu(),
        getExaminerOrders(),
      ]);

      setGuestDetails({
        name: sessionData.examiner.name,
        code: sessionData.examiner.code,
        roleLabel: sessionData.examiner.roleLabel || 'External Examiner',
      });
      syncMenuState(menuData);
      setMyOrders(ordersData.orders || []);
    } catch {
      alert('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshMenuFromServer();
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshMenuFromServer();
      }
    };

    window.addEventListener('focus', refreshMenuFromServer);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshMenuFromServer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const updateCart = (itemId, delta, isAvailable) => {
    if (!isAvailable) return;
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const cloned = { ...prev };
        delete cloned[itemId];
        return cloned;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const cartTotal = Object.entries(cart).reduce((total, [id, qty]) => {
    const item = menuItems.find((i) => i._id === id);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const totalItemsInCart = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  const handlePlaceOrder = async () => {
    if (cartTotal === 0 || isPlacingOrder) return;
    const itemsPayload = Object.entries(cart).map(([menuItemId, qty]) => ({ menuItemId, qty }));

    setIsPlacingOrder(true);
    try {
      const response = await placeExaminerOrder(itemsPayload);
      setMyOrders((prev) => [response.order, ...prev]);
      setCart({});
      setActiveTab('orders');
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to place order.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const categories = Object.keys(categorySettings);

  const renderMenuView = () => (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-pict-text uppercase tracking-tight">Canteen Menu</h2>
        <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Select items to generate your digital meal token.</p>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 md:gap-8">
        <div className="flex-1 space-y-6">
          {categories.map((category) => {
            const categoryItems = menuItems.filter((item) => item.category === category);
            const setting = categorySettings[category] || { status: true, slot: 'N/A' };
            const isAvailable = setting.status;

            if (categoryItems.length === 0) return null;
            return (
              <div key={category} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${isAvailable ? 'border-slate-200' : 'border-slate-100 opacity-75'}`}>
                <div className={`px-5 py-3.5 border-b ${isAvailable ? 'bg-slate-50 border-slate-100' : 'bg-slate-100/50 border-slate-100'}`}>
                  <h3 className={`text-[11px] font-black uppercase tracking-widest ${isAvailable ? 'text-pict-blue' : 'text-slate-400'}`}>{category}</h3>
                  <p className="text-[9px] mt-1 font-bold text-slate-400 flex items-center gap-1"><Clock size={10} /> {setting.slot}</p>
                </div>
                <div className={`divide-y divide-slate-50 ${!isAvailable ? 'grayscale pointer-events-none' : ''}`}>
                  {categoryItems.map((item) => (
                    <div key={item._id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="pr-4">
                        <p className="text-sm md:text-base font-black text-pict-text">{item.name}</p>
                        <p className="text-xs font-bold text-emerald-600 mt-0.5">Rs{item.price}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 rounded-xl p-1.5 border border-slate-200 shadow-inner shrink-0">
                        <button onClick={() => updateCart(item._id, -1, isAvailable)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-pict-blue bg-white rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer">
                          <Minus size={16} strokeWidth={3} />
                        </button>
                        <span className="w-4 sm:w-6 text-center text-xs font-black text-pict-text select-none">{cart[item._id] || 0}</span>
                        <button onClick={() => updateCart(item._id, 1, isAvailable)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-pict-blue bg-white rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer">
                          <Plus size={16} strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden xl:block xl:w-[350px] shrink-0">
          <div className="bg-pict-blue rounded-4xl shadow-xl p-8 sticky top-10 text-white">
            <h3 className="text-sm font-black uppercase tracking-widest text-blue-200 mb-6 flex items-center gap-3"><ShoppingBag size={18} /> Order Summary</h3>
            {totalItemsInCart === 0 ? (
              <p className="text-xs font-medium text-white/50 italic text-center py-8">No items selected yet.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {Object.entries(cart).map(([id, qty]) => {
                  const item = menuItems.find((i) => i._id === id);
                  if (!item) return null;
                  return (
                    <div key={id} className="flex justify-between text-sm font-bold border-b border-white/10 pb-3">
                      <span>{qty}x {item.name}</span>
                      <span>Rs{item.price * qty}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="pt-4 border-t border-white/20 flex justify-between items-end mb-8">
              <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">Total Amount</span>
              <span className="text-3xl font-black">Rs{cartTotal}</span>
            </div>
            <button disabled={cartTotal === 0 || isPlacingOrder} onClick={handlePlaceOrder} className="w-full bg-white text-pict-blue py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {isPlacingOrder ? 'Generating...' : 'Generate Order Token'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOrdersView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="mb-6 md:mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-pict-text uppercase tracking-tight">My Tokens</h2>
          <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Show these digital tokens at the canteen counter.</p>
        </div>
      </div>

      {myOrders.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-4xl p-10 text-center flex flex-col items-center justify-center">
          <Receipt size={40} className="text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-6">You have no active tokens.</p>
          <button onClick={() => setActiveTab('menu')} className="bg-pict-blue text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-lg transition-all">
            Browse Menu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {myOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-3xl shadow-md border border-slate-200 relative overflow-hidden flex flex-col">
              <div className={`p-5 flex justify-between items-center ${order.status === 'Pending' ? 'bg-orange-50/50' : 'bg-slate-50'}`}>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order ID</p>
                  <p className="font-mono text-lg font-black text-pict-blue tracking-tighter">{order.id}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${order.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {order.status}
                </div>
              </div>

              <div className="relative flex items-center">
                <div className="absolute -left-3 w-6 h-6 bg-[#F0F2F5] rounded-full border-r border-slate-200 z-10"></div>
                <div className="w-full border-t-2 border-dashed border-slate-200"></div>
                <div className="absolute -right-3 w-6 h-6 bg-[#F0F2F5] rounded-full border-l border-slate-200 z-10"></div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><Clock size={10} className="inline mr-1" /> {order.time}</p>
                  <p className="text-sm font-bold text-slate-700 leading-relaxed">{order.items}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-end">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value</p>
                  <p className="text-xl font-black text-emerald-600">Rs{order.amount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <p className="font-bold text-slate-600">Loading guest dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] font-sans relative">
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-72 bg-pict-blue text-white flex-col shadow-2xl">
        <div className="p-8 border-b border-white/10">
          <div className="bg-white p-3 rounded-xl shadow-lg inline-block mb-6">
            <img src={LogoImg} className="h-8 w-auto" alt="PICT" />
          </div>
          <div className="space-y-1 text-left">
            <h2 className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">{guestDetails.roleLabel}</h2>
            <div className="font-mono text-2xl font-black text-white tracking-tighter bg-white/10 inline-block px-4 py-2 rounded-xl border border-white/20 mt-1">
              {guestDetails.code}
            </div>
            <p className="text-sm font-bold mt-2 text-white tracking-wide">{guestDetails.name}</p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4 text-left">Navigation</p>

          <button onClick={() => setActiveTab('menu')} className={`w-full flex items-center justify-between px-4 py-4 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${activeTab === 'menu' ? 'bg-white/10 border-l-4 border-blue-400 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}>
            <div className="flex items-center gap-3"><UtensilsCrossed size={18} /> Order Food</div>
          </button>

          <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center justify-between px-4 py-4 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${activeTab === 'orders' ? 'bg-white/10 border-l-4 border-emerald-400 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'}`}>
            <div className="flex items-center gap-3"><Receipt size={18} /> My Tokens</div>
            {myOrders.length > 0 && <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full">{myOrders.length}</span>}
          </button>
        </nav>

        <div className="p-6 border-t border-white/10">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-pict-blue text-white px-5 py-4 rounded-b-3xl shadow-lg border-b border-blue-800">
        <div className="flex justify-between items-start mb-3">
          <img src={LogoImg} className="h-6 w-auto brightness-0 invert opacity-90" alt="PICT" />
        </div>
        <div className="flex justify-between items-end text-left">
          <div>
            <p className="text-[12px] text-blue-200 font-bold tracking-wide">{guestDetails.name}</p>
            <p className="font-mono text-2xl font-black tracking-tighter mt-0.5 flex items-center gap-2">
              {guestDetails.code}
              <span className="text-[8px] bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest font-bold -translate-y-0.5">Active Pass</span>
            </p>
          </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 z-50 flex justify-around items-center px-2 py-3 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('menu')} className={`flex flex-col items-center p-2 min-w-17.5 ${activeTab === 'menu' ? 'text-pict-blue' : 'text-slate-400'}`}>
          <UtensilsCrossed size={20} className={activeTab === 'menu' ? 'mb-1' : 'mb-1 opacity-70'} strokeWidth={activeTab === 'menu' ? 3 : 2} />
          <span className={`text-[9px] uppercase tracking-widest ${activeTab === 'menu' ? 'font-black' : 'font-bold'}`}>Menu</span>
        </button>
        <button onClick={() => setActiveTab('orders')} className={`relative flex flex-col items-center p-2 min-w-17.5 ${activeTab === 'orders' ? 'text-pict-blue' : 'text-slate-400'}`}>
          <Receipt size={20} className={activeTab === 'orders' ? 'mb-1' : 'mb-1 opacity-70'} strokeWidth={activeTab === 'orders' ? 3 : 2} />
          <span className={`text-[9px] uppercase tracking-widest ${activeTab === 'orders' ? 'font-black' : 'font-bold'}`}>Tokens</span>
          {myOrders.length > 0 && <span className="absolute top-1 right-3 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>}
        </button>
        <button onClick={handleSignOut} className="flex flex-col items-center p-2 min-w-17.5 text-red-400">
          <LogOut size={20} className="mb-1 opacity-70" strokeWidth={2} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Exit</span>
        </button>
      </div>

      {activeTab === 'menu' && totalItemsInCart > 0 && (
        <div className="md:hidden fixed bottom-20 left-4 right-4 bg-pict-blue text-white rounded-2xl p-4 shadow-[0_10px_40px_rgba(45,62,139,0.35)] z-40 flex justify-between items-center border border-blue-400 animate-in slide-in-from-bottom-4">
          <div>
            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">{totalItemsInCart} Items Selected</p>
            <p className="text-xl font-black">Rs{cartTotal}</p>
          </div>
          <button disabled={isPlacingOrder} onClick={handlePlaceOrder} className="bg-white text-pict-blue px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform cursor-pointer shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {isPlacingOrder ? 'Placing...' : 'Place Order'}
          </button>
        </div>
      )}

      <main className="flex-1 w-full md:ml-72 pt-32 md:pt-0 min-h-screen flex flex-col">
        <div className="p-4 sm:p-6 md:p-10 lg:p-14 text-left flex-1 pb-32 md:pb-14 w-full max-w-7xl mx-auto">
          {activeTab === 'menu' ? renderMenuView() : renderOrdersView()}
        </div>
      </main>
    </div>
  );
};

export default ExternalExaminerDashboard;
