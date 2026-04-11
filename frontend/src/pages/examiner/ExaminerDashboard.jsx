import React, { useEffect, useState } from 'react';
import {
  LogOut,
  UtensilsCrossed,
  Ticket,
  MessageCircle,
  Trash2,
  Plus,
  Minus,
  UserPlus,
  ShoppingBag,
  Clock,
  Receipt,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LogoImg from '../../assets/image.png';
import { clearAuthSession } from '../../utils/auth';
import {
  createGuestPass,
  deleteGuestPass,
  getExaminerMenu,
  getExaminerOrders,
  getExaminerSession,
  getGuestPasses,
  placeExaminerOrder,
} from '../../services/examinerService';

const parseDateOnlyKey = (dateText) => {
  const match = String(dateText || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return year * 10000 + month * 100 + day;
};

const isPassActiveToday = (guestPass) => {
  const start = parseDateOnlyKey(guestPass?.fromDate);
  const end = parseDateOnlyKey(guestPass?.toDate);
  if (!start || !end) return false;

  const now = new Date();
  const todayKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return todayKey >= start && todayKey <= end;
};

const ExaminerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('menu');
  const [isLoading, setIsLoading] = useState(true);

  const [examinerDetails, setExaminerDetails] = useState({
    name: 'Examiner',
    code: 'PICT-XXXX',
    dept: null,
    type: 'Internal',
    roleLabel: 'Digital Pass',
  });

  const [categorySettings, setCategorySettings] = useState({});
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({});
  const [myOrders, setMyOrders] = useState([]);
  const [guestVouchers, setGuestVouchers] = useState([]);
  const [selectedGuestPassForOrder, setSelectedGuestPassForOrder] = useState(null);

  const [guestForm, setGuestForm] = useState({
    name: '',
    phone: '',
    email: '',
    fromDate: '',
    toDate: '',
  });

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

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sessionData, menuData, orderData, guestData] = await Promise.all([
        getExaminerSession(),
        getExaminerMenu(),
        getExaminerOrders(),
        getGuestPasses(),
      ]);

      setExaminerDetails(sessionData.examiner);
      syncMenuState(menuData);
      setMyOrders(orderData.orders || []);
      setGuestVouchers(guestData.guestPasses || []);
    } catch {
      alert('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
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
    if (cartTotal === 0) return;

    const itemsPayload = Object.entries(cart).map(([menuItemId, qty]) => ({ menuItemId, qty }));

    try {
      const response = await placeExaminerOrder(itemsPayload, selectedGuestPassForOrder?.id);
      setMyOrders((prev) => [response.order, ...prev]);
      setCart({});

      if (response?.placedForGuest) {
        alert(`Order placed for ${selectedGuestPassForOrder?.name || 'guest'} and will appear on the guest dashboard.`);
        setSelectedGuestPassForOrder(null);
      }

      setActiveTab('orders');
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to place order.');
    }
  };

  const categories = Object.keys(categorySettings);

  const handleGenerateGuest = async () => {
    if (!guestForm.name || !guestForm.phone || !guestForm.fromDate || !guestForm.toDate) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const response = await createGuestPass(guestForm);
      setGuestVouchers((prev) => [response.guestPass, ...prev]);
      setGuestForm({ name: '', phone: '', email: '', fromDate: '', toDate: '' });
      setActiveTab('passes');
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to create guest pass.');
    }
  };

  const handleDeleteGuest = async (idToRemove) => {
    if (window.confirm('Revoke this guest pass?')) {
      try {
        await deleteGuestPass(idToRemove);
        setGuestVouchers((prev) => prev.filter((v) => v.id !== idToRemove));
        setSelectedGuestPassForOrder((prev) => (prev?.id === idToRemove ? null : prev));
      } catch (error) {
        alert(error?.response?.data?.message || 'Failed to delete guest pass.');
      }
    }
  };

  const handleStartOrderForGuest = (guest) => {
    if (!isPassActiveToday(guest)) {
      alert('This guest pass is not active for today.');
      return;
    }

    setSelectedGuestPassForOrder(guest);
    setActiveTab('menu');
  };

  const handleWhatsApp = (guest) => {
    const msg = encodeURIComponent(
      `Hello ${guest.name}, your PICT Guest Canteen Code is: *${guest.code}*. Valid from ${guest.fromDate} to ${guest.toDate}. Added by ${examinerDetails.name}.`
    );
    window.open(`https://wa.me/${guest.phone}?text=${msg}`, '_blank');
  };

  const renderMenuView = () => (
    <div className="animate-in fade-in duration-300 pb-24 md:pb-0">
      {totalItemsInCart > 0 && (
        <div className="md:hidden fixed bottom-[80px] left-4 right-4 bg-pict-blue text-white rounded-2xl p-4 shadow-2xl z-40 flex justify-between items-center border border-blue-400">
          <div>
            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">{totalItemsInCart} Items Selected</p>
            <p className="text-xl font-black">Rs{cartTotal}</p>
          </div>
          <button onClick={handlePlaceOrder} className="bg-white text-pict-blue px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform cursor-pointer shadow-lg">Place Order</button>
        </div>
      )}

      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-black text-pict-text uppercase tracking-tight">Canteen Menu</h2>
        <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Ordering is subject to category timings.</p>
        {selectedGuestPassForOrder && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-pict-blue">
              Ordering For Guest: {selectedGuestPassForOrder.name} ({selectedGuestPassForOrder.code})
            </p>
            <button
              onClick={() => setSelectedGuestPassForOrder(null)}
              className="px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-[10px] font-black uppercase tracking-widest text-pict-blue cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        <div className="flex-1 space-y-6">
          {categories.map((category) => {
            const categoryItems = menuItems.filter((item) => item.category === category);
            const setting = categorySettings[category] || { status: true, slot: 'N/A' };
            const isAvailable = setting.status;

            if (categoryItems.length === 0) return null;

            return (
              <div key={category} className={`bg-white rounded-[24px] shadow-sm border transition-all overflow-hidden ${isAvailable ? 'border-slate-200' : 'border-slate-100 opacity-75'}`}>
                <div className={`px-5 py-3 border-b flex justify-between items-center ${isAvailable ? 'bg-slate-50 border-slate-100' : 'bg-slate-100/50 border-slate-100'}`}>
                  <div>
                    <h3 className={`text-[11px] font-black uppercase tracking-widest ${isAvailable ? 'text-pict-blue' : 'text-slate-400'}`}>{category}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-400">
                      <Clock size={10} />
                      <span className="text-[9px] font-bold uppercase">{setting.slot}</span>
                    </div>
                  </div>
                  {!isAvailable && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-red-500">
                      <Lock size={10} />
                      <span className="text-[9px] font-black uppercase">Closed</span>
                    </div>
                  )}
                </div>
                <div className={`divide-y divide-slate-50 ${!isAvailable ? 'grayscale pointer-events-none' : ''}`}>
                  {categoryItems.map((item) => (
                    <div key={item._id} className="p-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <p className="text-sm font-black text-pict-text">{item.name}</p>
                        <p className="text-xs font-bold text-emerald-600 mt-1">Rs{item.price}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1 border border-slate-200 shadow-inner">
                        <button onClick={() => updateCart(item._id, -1, isAvailable)} className="p-2.5 text-slate-500 hover:text-pict-blue bg-white rounded-lg shadow-sm active:scale-95 transition-all"><Minus size={14} strokeWidth={3} /></button>
                        <span className="w-5 text-center text-xs font-black text-pict-text">{cart[item._id] || 0}</span>
                        <button onClick={() => updateCart(item._id, 1, isAvailable)} className="p-2.5 text-slate-500 hover:text-pict-blue bg-white rounded-lg shadow-sm active:scale-95 transition-all"><Plus size={14} strokeWidth={3} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden xl:block xl:w-96 shrink-0">
          <div className="bg-pict-blue rounded-[2rem] shadow-xl p-8 sticky top-10 text-white">
            <h3 className="text-sm font-black uppercase tracking-widest text-blue-200 mb-6 flex items-center gap-3"><ShoppingBag size={18} /> Order Summary</h3>
            {selectedGuestPassForOrder && (
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-4">
                Guest: {selectedGuestPassForOrder.name}
              </p>
            )}
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
            <button disabled={cartTotal === 0} onClick={handlePlaceOrder} className="w-full bg-white text-pict-blue py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              Generate Order Token
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOrdersView = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-24 md:pb-0">
      <div className="mb-6 md:mb-8 flex justify-between items-end text-left">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-pict-text uppercase tracking-tight">My Tokens</h2>
          <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Show these digital tokens at the canteen counter.</p>
        </div>
      </div>
      {myOrders.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-[2rem] p-10 text-center flex flex-col items-center justify-center">
          <Receipt size={40} className="text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-6">You have no active tokens.</p>
          <button onClick={() => setActiveTab('menu')} className="bg-pict-blue text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-lg transition-all">Browse Menu</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {myOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-3xl shadow-md border border-slate-200 relative overflow-hidden flex flex-col">
              <div className={`p-5 flex justify-between items-center ${order.status === 'Pending' ? 'bg-orange-50/50' : 'bg-slate-50'}`}>
                <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Order ID</p><p className="font-mono text-lg font-black text-pict-blue tracking-tighter">{order.id}</p></div>
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${order.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{order.status}</div>
              </div>
              <div className="relative flex items-center"><div className="absolute -left-3 w-6 h-6 bg-[#F0F2F5] rounded-full border-r border-slate-200"></div><div className="w-full border-t-2 border-dashed border-slate-200"></div><div className="absolute -right-3 w-6 h-6 bg-[#F0F2F5] rounded-full border-l border-slate-200"></div></div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1"><Clock size={10} className="inline mr-1" /> {order.time}</p><p className="text-sm font-bold text-slate-700 leading-relaxed">{order.items}</p></div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-end"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Value</p><p className="text-xl font-black text-emerald-600">Rs{order.amount}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAddGuestView = () => (
    <div className="animate-in fade-in duration-300 pb-24 md:pb-0">
      <div className="mb-6 md:mb-8 text-left">
        <h2 className="text-2xl md:text-3xl font-black text-pict-text uppercase tracking-tight">Add Guest</h2>
        <p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Generate a external guest pass (G-XXX).</p>
      </div>
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl text-left">
        <div className="space-y-5">
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Full Name *</label><input type="text" value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} className="w-full mt-1.5 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">From *</label><input type="date" value={guestForm.fromDate} onChange={(e) => setGuestForm({ ...guestForm, fromDate: e.target.value })} className="w-full mt-1.5 p-4 bg-slate-50 border rounded-2xl text-[11px]" /></div>
            <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">To *</label><input type="date" value={guestForm.toDate} onChange={(e) => setGuestForm({ ...guestForm, toDate: e.target.value })} className="w-full mt-1.5 p-4 bg-slate-50 border rounded-2xl text-[11px]" /></div>
          </div>
          <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Phone *</label><input type="tel" value={guestForm.phone} onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })} className="w-full mt-1.5 p-4 bg-slate-50 border rounded-2xl text-sm font-bold" /></div>
          <button onClick={handleGenerateGuest} className="w-full bg-slate-900 text-white py-4.5 rounded-2xl font-black text-xs uppercase shadow-xl mt-4 cursor-pointer">Generate Guest Code</button>
        </div>
      </div>
    </div>
  );

  const renderPassesView = () => (
    <div className="animate-in fade-in duration-300 pb-24 md:pb-0">
      <div className="mb-6 md:mb-8 flex justify-between items-end text-left">
        <div><h2 className="text-2xl md:text-3xl font-black text-pict-text uppercase tracking-tight">Guest Passes</h2><p className="text-slate-500 text-xs md:text-sm font-medium mt-1">Manage your generated codes.</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {guestVouchers.map((guest) => (
          <div key={guest.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col text-left">
            <div className="h-2 w-full bg-pict-blue"></div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Guest</p><h4 className="font-black text-lg text-pict-text tracking-tight mt-1">{guest.name}</h4></div>
                <div className="bg-blue-50 text-pict-blue px-3 py-1.5 rounded-lg border border-blue-100 font-mono font-black text-sm">{guest.code}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-5 flex justify-between text-[11px] font-bold text-slate-700"><span>{guest.fromDate}</span><span className="text-slate-300">{'->'}</span><span>{guest.toDate}</span></div>
              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button onClick={() => handleWhatsApp(guest)} className="flex justify-center items-center gap-2 bg-emerald-50 text-emerald-600 py-2.5 rounded-xl font-black text-[10px] uppercase cursor-pointer"><MessageCircle size={14} /> Send</button>
                <button onClick={() => handleStartOrderForGuest(guest)} className="flex justify-center items-center gap-2 bg-blue-50 text-pict-blue py-2.5 rounded-xl font-black text-[10px] uppercase cursor-pointer"><ShoppingBag size={14} /> Order</button>
                <button onClick={() => handleDeleteGuest(guest.id)} className="col-span-2 flex justify-center items-center gap-2 bg-red-50 text-red-600 py-2.5 rounded-xl font-black text-[10px] uppercase cursor-pointer"><Trash2 size={14} /> Revoke</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <p className="font-bold text-slate-600">Loading examiner dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] font-sans relative">
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-72 bg-pict-blue text-white flex-col shadow-2xl">
        <div className="p-8 border-b border-white/10">
          <div className="bg-white p-3 rounded-xl shadow-lg inline-block mb-6"><img src={LogoImg} className="h-8 w-auto" alt="PICT" /></div>
          <div className="space-y-1 text-left">
            <h2 className="text-[10px] font-black text-blue-300 uppercase">{examinerDetails.roleLabel}</h2>
            <div className="font-mono text-2xl font-black text-white tracking-tighter bg-white/10 px-4 py-2 rounded-xl border border-white/20 mt-1">{examinerDetails.code}</div>
            <p className="text-[11px] font-bold mt-2 text-white/70">{examinerDetails.name}</p>
          </div>
        </div>
        <nav className="flex-1 p-6 space-y-3 text-left">
          <button onClick={() => setActiveTab('menu')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'menu' ? 'bg-white/10 border-l-4 border-blue-400' : 'text-white/60'}`}><UtensilsCrossed size={18} /> Order Food</button>
          <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-white/10 border-l-4 border-emerald-400' : 'text-white/60'}`}><Receipt size={18} /> My Tokens</button>
          <button onClick={() => setActiveTab('add_guest')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'add_guest' ? 'bg-white/10 border-l-4 border-orange-400' : 'text-white/60'}`}><UserPlus size={18} /> Add Guest</button>
          <button onClick={() => setActiveTab('passes')} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'passes' ? 'bg-white/10 border-l-4 border-purple-400' : 'text-white/60'}`}><Ticket size={18} /> Guest Passes</button>
        </nav>
        <div className="p-6 border-t border-white/10 text-left">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 bg-red-500/10 text-red-400 rounded-xl text-xs font-black transition-all cursor-pointer"><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 w-full z-30 bg-pict-blue text-white px-6 py-4 rounded-b-3xl shadow-lg border-b border-blue-800">
        <div className="flex justify-between items-start mb-3"><img src={LogoImg} className="h-6 w-auto brightness-0 invert opacity-90" alt="PICT" /><button onClick={handleSignOut} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase active:scale-95"><LogOut size={12} /> Exit</button></div>
        <div className="text-left"><p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">My Digital Pass</p><p className="font-mono text-2xl font-black tracking-tighter mt-0.5">{examinerDetails.code}</p></div>
      </div>

      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 z-50 flex justify-around items-center px-2 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button onClick={() => setActiveTab('menu')} className={`flex flex-col items-center p-2 ${activeTab === 'menu' ? 'text-pict-blue' : 'text-slate-400'}`}><UtensilsCrossed size={20} /><span className="text-[9px] uppercase mt-1">Menu</span></button>
        <button onClick={() => setActiveTab('orders')} className={`relative flex flex-col items-center p-2 ${activeTab === 'orders' ? 'text-pict-blue' : 'text-slate-400'}`}><Receipt size={20} /><span className="text-[9px] uppercase mt-1">Tokens</span>{myOrders.length > 0 && <span className="absolute top-1 right-4 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white"></span>}</button>
        <button onClick={() => setActiveTab('add_guest')} className={`flex flex-col items-center p-2 ${activeTab === 'add_guest' ? 'text-pict-blue' : 'text-slate-400'}`}><UserPlus size={20} /><span className="text-[9px] uppercase mt-1">Guest</span></button>
        <button onClick={() => setActiveTab('passes')} className={`flex flex-col items-center p-2 ${activeTab === 'passes' ? 'text-pict-blue' : 'text-slate-400'}`}><Ticket size={20} /><span className="text-[9px] uppercase mt-1">Passes</span></button>
      </div>

      <main className="flex-1 w-full md:max-w-[calc(100%-18rem)] md:ml-72 pt-28 md:pt-0 min-h-screen">
        <div className="p-4 md:p-10 lg:p-14 h-full w-full max-w-7xl mx-auto">
          {activeTab === 'menu' && renderMenuView()}
          {activeTab === 'orders' && renderOrdersView()}
          {activeTab === 'add_guest' && renderAddGuestView()}
          {activeTab === 'passes' && renderPassesView()}
        </div>
      </main>
    </div>
  );
};

export default ExaminerDashboard;
