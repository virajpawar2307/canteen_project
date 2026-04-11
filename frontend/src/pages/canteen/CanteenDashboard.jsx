import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LogOut,
  Menu,
  Search,
  Download,
  Coffee,
  Clock,
  FileBarChart,
  Receipt,
  Printer,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LogoImg from '../../assets/image.png';
import { clearAuthSession } from '../../utils/auth';
import {
  createCanteenMenuItem,
  deleteCanteenMenuItem,
  getCanteenMenuData,
  getCanteenOrders,
  getCanteenReportData,
  processCanteenOrder,
  updateCanteenMenuItem,
  updateCanteenCategorySettings,
} from '../../services/canteenService';

const CanteenDashboard = () => {
  const LIVE_ORDERS_REFRESH_MS = 5000;
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [isLoading, setIsLoading] = useState(true);

  const [categorySettings, setCategorySettings] = useState({});
  const [liveOrders, setLiveOrders] = useState([]);
  const [processedOrders, setProcessedOrders] = useState([]);
  const [processingOrderId, setProcessingOrderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [priceLimits, setPriceLimits] = useState({
    Breakfast: 50,
    Lunch: 100,
    Beverage: 30,
    Snacks: 30,
  });

  const [newMenuData, setNewMenuData] = useState({ name: '', category: 'Lunch', price: '' });
  const [editingMenuId, setEditingMenuId] = useState('');
  const [editingMenuData, setEditingMenuData] = useState({ name: '', category: 'Lunch', price: '' });
  const [menuActionLoadingId, setMenuActionLoadingId] = useState('');
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    department: 'All Departments',
    category: 'All Categories',
    examinerType: 'Both (Internal & External)',
  });
  const [reportData, setReportData] = useState({
    orders: [],
    internal: [],
    external: [],
    internalTotal: 0,
    externalTotal: 0,
    grandTotal: 0,
    totalOrders: 0,
  });
  const [clockTick, setClockTick] = useState(Date.now());
  const [isSavingCategoryKey, setIsSavingCategoryKey] = useState('');
  const [isAddingMenuItem, setIsAddingMenuItem] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [reportCategoryOptions, setReportCategoryOptions] = useState(['All Categories']);

  const toMinutes = (hhmm = '') => {
    const [hour, minute] = String(hhmm).split(':').map((n) => Number(n));
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  };

  const isCategoryOpenNow = (setting) => {
    void clockTick;
    if (!setting || setting.status === false) return false;
    const from = toMinutes(setting.fromTime);
    const to = toMinutes(setting.toTime);
    if (from === null || to === null) return false;

    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    if (from <= to) return current >= from && current <= to;
    return current >= from || current <= to;
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  const handleSignOut = () => {
    clearAuthSession();
    navigate('/', { replace: true });
  };

  const loadOrders = useCallback(async () => {
    const [pendingData, processedData] = await Promise.all([
      getCanteenOrders('Pending'),
      getCanteenOrders('Processed'),
    ]);
    setLiveOrders(pendingData.orders || []);
    setProcessedOrders(processedData.orders || []);
  }, []);

  const loadMenu = useCallback(async () => {
    const data = await getCanteenMenuData();
    setCategorySettings(data.categorySettings || {});
    setMenuItems(data.menuItems || []);
    setPriceLimits((prev) => data.priceLimits || prev);
    const categories = Array.isArray(data.voucherCategories) ? data.voucherCategories.filter(Boolean) : [];
    setReportCategoryOptions(['All Categories', ...new Set(categories)]);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadOrders(), loadMenu()]);
      } catch {
        alert('Failed to load canteen dashboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, [loadMenu, loadOrders]);

  const refreshOrdersSilently = useCallback(async () => {
    try {
      await loadOrders();
    } catch {
      // Silent live refresh to keep order feed updating without noisy popups.
    }
  }, [loadOrders]);

  useEffect(() => {
    if (activeTab !== 'orders') return undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshOrdersSilently();
      }
    };

    refreshWhenVisible();
    const timer = setInterval(refreshWhenVisible, LIVE_ORDERS_REFRESH_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [activeTab, refreshOrdersSilently]);

  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleTimeChange = async (cat, field, value) => {
    const actionKey = `${cat}-${field}`;
    setIsSavingCategoryKey(actionKey);
    const updated = { ...categorySettings, [cat]: { ...categorySettings[cat], [field]: value } };
    setCategorySettings(updated);
    try {
      await updateCanteenCategorySettings(updated);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to save category timing.');
    } finally {
      setIsSavingCategoryKey('');
    }
  };

  const toggleCategoryStatus = async (cat) => {
    const actionKey = `${cat}-status`;
    setIsSavingCategoryKey(actionKey);
    const updated = { ...categorySettings, [cat]: { ...categorySettings[cat], status: !categorySettings[cat].status } };
    setCategorySettings(updated);
    try {
      await updateCanteenCategorySettings(updated);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to update category status.');
    } finally {
      setIsSavingCategoryKey('');
    }
  };

  const handleAddMenuItem = async () => {
    const price = parseInt(newMenuData.price, 10);
    const category = newMenuData.category;

    if (!newMenuData.name.trim() || !newMenuData.price) {
      alert('Please fill all fields.');
      return;
    }

    if (price > priceLimits[category]) {
      alert(`Price limit exceeded. Max for ${category} is Rs${priceLimits[category]}.`);
      return;
    }

    setIsAddingMenuItem(true);
    try {
      const data = await createCanteenMenuItem({
        name: newMenuData.name,
        category,
        price,
      });
      setMenuItems((prev) => [data.menuItem, ...prev]);
      setNewMenuData({ name: '', category: 'Lunch', price: '' });
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to add menu item.');
    } finally {
      setIsAddingMenuItem(false);
    }
  };

  const handleStartMenuEdit = (item) => {
    setEditingMenuId(item._id);
    setEditingMenuData({
      name: item.name,
      category: item.category,
      price: String(item.price),
    });
  };

  const handleCancelMenuEdit = () => {
    setEditingMenuId('');
    setEditingMenuData({ name: '', category: 'Lunch', price: '' });
  };

  const handleUpdateMenuItem = async (itemId) => {
    const price = parseInt(editingMenuData.price, 10);
    const category = editingMenuData.category;

    if (!editingMenuData.name.trim() || !editingMenuData.price) {
      alert('Please fill all fields before saving.');
      return;
    }

    if (price > priceLimits[category]) {
      alert(`Price limit exceeded. Max for ${category} is Rs${priceLimits[category]}.`);
      return;
    }

    setMenuActionLoadingId(itemId);
    try {
      const data = await updateCanteenMenuItem(itemId, {
        name: editingMenuData.name,
        category,
        price,
      });

      setMenuItems((prev) => prev.map((item) => (item._id === itemId ? data.menuItem : item)));
      handleCancelMenuEdit();
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to update menu item.');
    } finally {
      setMenuActionLoadingId('');
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    const shouldDelete = window.confirm('Are you sure you want to delete this menu item?');
    if (!shouldDelete) return;

    setMenuActionLoadingId(itemId);
    try {
      await deleteCanteenMenuItem(itemId);
      setMenuItems((prev) => prev.filter((item) => item._id !== itemId));
      if (editingMenuId === itemId) {
        handleCancelMenuEdit();
      }
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to delete menu item.');
    } finally {
      setMenuActionLoadingId('');
    }
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const printTokenReceipt = (order) => {
    const receiptWindow = window.open('', '_blank', 'width=360,height=620');
    if (!receiptWindow) {
      throw new Error('Please allow popups to print token receipt.');
    }

    receiptWindow.document.write(`
      <html>
        <head>
          <title>Meal Token - ${order.id}</title>
          <style>
            @page { size: 80mm auto; margin: 6mm; }
            body { font-family: monospace; margin: 0; padding: 6mm; color: #111; }
            .center { text-align: center; }
            .head { font-weight: 700; text-transform: uppercase; margin-bottom: 4px; font-size: 14px; }
            .sub { font-size: 11px; margin-bottom: 8px; }
            .line { border-top: 1px dashed #111; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0; }
            .token { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
            .items { font-size: 12px; line-height: 1.5; margin: 6px 0; }
            .note { font-size: 10px; text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="head">PICT Canteen</div>
            <div class="sub">Token Receipt</div>
            <div class="token">${order.id}</div>
          </div>
          <div class="line"></div>
          <div class="row"><span>Name</span><span>${order.name}</span></div>
          <div class="row"><span>Type</span><span>${order.type}</span></div>
          <div class="row"><span>Date</span><span>${order.date}</span></div>
          <div class="row"><span>Time</span><span>${order.time}</span></div>
          <div class="line"></div>
          <div class="items"><strong>Items:</strong><br/>${order.items}</div>
          <div class="line"></div>
          <div class="row"><strong>Total</strong><strong>Rs ${order.amount}</strong></div>
          <div class="line"></div>
          <div class="note">Submit this token at the counter to collect meal.</div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.focus();
      receiptWindow.print();
      receiptWindow.close();
    }, 250);
  };

  const handlePrintAndProcessOrder = async (order) => {
    setProcessingOrderId(order.id);
    try {
      printTokenReceipt(order);
      await processCanteenOrder(order.id);
      setLiveOrders((prev) => prev.filter((o) => o.id !== order.id));
      setProcessedOrders((prev) => [{ ...order, status: 'Processed' }, ...prev]);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to process order.');
    } finally {
      setProcessingOrderId('');
    }
  };

  const handleDownloadReport = async () => {
    if (!reportFilters.startDate || !reportFilters.endDate) {
      alert('Please select both Start and End Dates.');
      return;
    }

    setIsDownloadingReport(true);
    try {
      const reportData = await getCanteenReportData(reportFilters);
      setReportData(reportData);
      const { internal, external, internalTotal, externalTotal, grandTotal } = reportData;
      const generatedAt = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Canteen_Billing_Report</title>
            <style>
              @page { size: A4; margin: 10mm; }
              body { font-family: Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.35; margin: 0; }
              .sheet { position: relative; border: 1px solid #2f2f2f; padding: 14px 14px 56px; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; min-height: 100vh; }
              .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
              .watermark img { width: 390px; opacity: 0.07; }
              .content { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; }
              .header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
              .logo { width: 52px; height: 52px; object-fit: contain; }
              .inst h1 { font-size: 20px; margin: 0; font-weight: 900; letter-spacing: 0.1px; color: #000; }
              .inst p { font-size: 12px; margin: 2px 0 0; font-weight: 700; }
              .title { border: 3px solid #000; background: #000; text-align: center; font-size: 14px; font-weight: 900; color: #fff; padding: 8px 10px; margin: 10px auto 14px; width: 65%; letter-spacing: 0.5px; }
              .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-weight: 800; color: #101010; font-size: 11px; }
              .field-label { font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.25px; }
              .dept-line { margin: 0 0 10px; font-weight: 800; font-size: 11px; color: #101010; }
              .section { margin-top: 10px; }
              .section-head { background: #1f3b78; color: #fff; font-weight: 900; padding: 5px 7px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.25px; }
              table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              th, td { border: 1px solid #565656; padding: 6px 6px; vertical-align: top; }
              th { background: #2a4f96; color: #fff; font-size: 10px; font-weight: 900; }
              td { font-size: 10px; }
              thead { display: table-header-group; }
              tr { page-break-inside: avoid; break-inside: avoid-page; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .date-cell { white-space: nowrap; }
              .name-cell small { font-size: 8px; color: #4b5563; }
              .subject-cell { word-break: break-word; }
              .items-cell { word-break: break-word; }
              .subtotal { text-align: right; font-size: 14px; font-weight: 800; margin: 6px 0 12px; }
              .grand-wrap { display: flex; justify-content: flex-end; margin: 6px 0 0; }
              .grand-box { border: 2px solid #222; min-width: 220px; display: flex; justify-content: space-between; padding: 6px 10px; font-weight: 800; font-size: 15px; }
              .signatures { padding-top: 14px; border-top: 1px solid #b4b4b4; page-break-inside: avoid; break-inside: avoid-page; margin-top: auto; padding-bottom: 10px; }
              .sign-grid-3 { margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; page-break-inside: avoid; break-inside: avoid-page; }
              .sign-grid-2 { margin-top: 18px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 48px; max-width: 72%; margin-left: auto; margin-right: auto; page-break-inside: avoid; break-inside: avoid-page; }
              .sign { text-align: center; min-height: 70px; display: flex; flex-direction: column; justify-content: flex-end; }
              .sign-line { border-top: 2px solid #4a4a4a; margin-bottom: 8px; }
              .sign label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2px; }
              .footer { position: fixed; left: 12mm; right: 12mm; bottom: 6mm; background: #fff; border-top: 1px solid #8a8a8a; padding-top: 5px; text-align: center; font-size: 8px; font-weight: 800; text-transform: uppercase; }
              @media print {
                .sheet { page-break-after: auto; }
              }
            </style>
          </head>
          <body>
            <div class="sheet">
              <div class="watermark"><img src="${LogoImg}" alt="PICT Watermark" /></div>
              <div class="content">
                <div class="header">
                  <img class="logo" src="${LogoImg}" alt="PICT Logo" />
                  <div class="inst">
                    <h1>SCTR'S PUNE INSTITUTE OF COMPUTER TECHNOLOGY</h1>
                    <p>Office of the Mess & Canteen Section</p>
                  </div>
                </div>

                <div class="title">DEPARTMENT-WISE BILLING REPORT</div>

                <div class="meta">
                  <div><span class="field-label">Ref No:</span> PICT/CNTN/2026/042/01/ALL-01</div>
                  <div><span class="field-label">Date:</span> ${formatDateForDisplay(reportFilters.startDate)} to ${formatDateForDisplay(reportFilters.endDate)}</div>
                </div>
                <p class="dept-line"><span class="field-label">Category:</span> ${reportFilters.category || 'All Categories'} | <span class="field-label">Department:</span> ${reportFilters.department}</p>

                <div class="section">
                  <div class="section-head">SECTION A: FACULTY CONSUMPTION</div>
                  <table>
                    <thead>
                      <tr>
                        <th class="text-center">Sr</th>
                        <th>Date</th>
                        <th>Faculty Name</th>
                        <th>Year &amp; Specific Subject</th>
                        <th>Items Consumed</th>
                        <th class="text-right">Total (Rs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${internal.length > 0 ? internal.map((o, i) => `<tr><td class="text-center">${i + 1}</td><td class="date-cell">${formatDateForDisplay(o.date)}<br/>${o.time || ''}</td><td class="name-cell">${o.name}<br/><small>ID: ${o.id}</small></td><td class="subject-cell">${o.subjectName || 'N/A'}${o.dept ? `<br/><small>${o.dept}</small>` : ''}</td><td class="items-cell">${o.items}</td><td class="text-right">Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="6" class="text-center">No Records</td></tr>'}
                    </tbody>
                  </table>
                  <div class="subtotal">Sub-Total (Faculty): Rs. ${internalTotal}/-</div>
                </div>

                <div class="section">
                  <div class="section-head">SECTION B: GUEST/EXTERNAL CONSUMPTION</div>
                  <table>
                    <thead>
                      <tr>
                        <th class="text-center">Sr</th>
                        <th>Date</th>
                        <th>Guest Name</th>
                        <th>Year &amp; Specific Subject</th>
                        <th>Items Consumed</th>
                        <th class="text-right">Total (Rs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${external.length > 0 ? external.map((o, i) => `<tr><td class="text-center">${i + 1}</td><td class="date-cell">${formatDateForDisplay(o.date)}<br/>${o.time || ''}</td><td class="name-cell">${o.name}<br/><small>ID: ${o.id}</small></td><td class="subject-cell">${o.subjectName || 'N/A'}${o.dept ? `<br/><small>${o.dept}</small>` : ''}</td><td class="items-cell">${o.items}</td><td class="text-right">Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="6" class="text-center">No Records</td></tr>'}
                    </tbody>
                  </table>
                  <div class="subtotal">Sub-Total (Guest): Rs. ${externalTotal}/-</div>
                </div>

                <div class="grand-wrap">
                  <div class="grand-box">
                    <span>GRAND TOTAL</span>
                    <span>Rs. ${grandTotal}</span>
                  </div>
                </div>

                <div class="signatures">
                  <div class="sign-grid-3">
                    <div class="sign"><div class="sign-line"></div><label>Mess Manager</label></div>
                    <div class="sign"><div class="sign-line"></div><label>Practical Coordinator</label></div>
                    <div class="sign"><div class="sign-line"></div><label>Head of Department</label></div>
                  </div>
                  <div class="sign-grid-2">
                    <div class="sign"><div class="sign-line"></div><label>CEO</label></div>
                    <div class="sign"><div class="sign-line"></div><label>Principal</label></div>
                  </div>
                </div>

                <div class="footer">System Generated Report | PICT Canteen & Mess Section | Downloaded: ${generatedAt}</div>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to build report.');
      setIsDownloadingReport(false);
      return;
    }

    setIsDownloadingReport(false);
  };

  const handleGenerateReport = async () => {
    if (!reportFilters.startDate || !reportFilters.endDate) {
      alert('Please select both Start and End Dates.');
      return;
    }

    setIsGeneratingReport(true);
    try {
      const data = await getCanteenReportData(reportFilters);
      setReportData(data);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to generate report data.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const filteredLiveOrders = useMemo(
    () =>
      liveOrders.filter(
        (o) =>
          o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.id.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [liveOrders, searchQuery]
  );

  const orderedMenuItems = useMemo(() => {
    const categoryOrder = { Breakfast: 1, Lunch: 2, Beverage: 3, Snacks: 4 };
    return [...menuItems].sort((a, b) => {
      const categoryDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
      if (categoryDiff !== 0) return categoryDiff;
      return a.name.localeCompare(b.name);
    });
  }, [menuItems]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <p className="text-slate-600 font-bold">Loading canteen dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F0F2F5] font-sans">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={toggleSidebar} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-pict-blue text-white flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 shadow-2xl overflow-hidden`}>
        <div className="p-8 border-b border-white/10 text-left">
          <div className="bg-white p-3 rounded-xl shadow-lg inline-block mb-4"><img src={LogoImg} className="h-8 w-auto" alt="PICT" /></div>
          <h2 className="text-sm font-black text-blue-100 uppercase">Canteen Portal</h2>
        </div>
        <nav className="flex-1 p-6 space-y-3 text-left overflow-y-auto">
          <button onClick={() => { setActiveTab('orders'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'orders' ? 'bg-white/10 border-l-4 border-emerald-400 text-white' : 'text-white/60 hover:text-white'}`}><Receipt size={18} /> Daily Orders</button>
          <button onClick={() => { setActiveTab('menu'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'menu' ? 'bg-white/10 border-l-4 border-blue-400 text-white' : 'text-white/60 hover:text-white'}`}><Coffee size={18} /> Menu Setup</button>
          <button onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-bold transition-all ${activeTab === 'reports' ? 'bg-white/10 border-l-4 border-purple-400 text-white' : 'text-white/60 hover:text-white'}`}><FileBarChart size={18} /> View Reports</button>
        </nav>
        <div className="mt-auto p-6 border-t border-white/10"><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 bg-red-500/10 text-red-400 rounded-xl text-xs font-black"><LogOut size={18} /> Sign Out</button></div>
      </aside>

      <main className="flex-1 w-full lg:ml-72 h-screen overflow-y-auto">
        <div className="lg:hidden flex items-center justify-between bg-white px-6 py-4 border-b sticky top-0 z-30 shadow-sm"><img src={LogoImg} className="h-8 w-auto" alt="PICT" /><button onClick={toggleSidebar} className="p-2 bg-pict-blue text-white rounded-lg"><Menu size={24} /></button></div>

        <div className="p-4 sm:p-6 md:p-10 lg:p-14 text-left">
          {activeTab === 'orders' && (
            <div className="animate-in fade-in">
              <h2 className="text-2xl font-black text-pict-text uppercase mb-8">Order Feed</h2>
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b bg-slate-50/50">
                  <div className="relative w-full max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Orders..." className="w-full pl-12 pr-4 py-3 border rounded-xl text-sm font-bold outline-none" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-160">
                    <thead><tr className="border-b text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5">Order ID</th><th className="px-8">Examiner</th><th className="px-8 text-right">Amount</th><th className="px-8 text-center">Action</th></tr></thead>
                    <tbody>
                      {filteredLiveOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50 border-b border-slate-50">
                          <td className="px-8 py-6 font-mono text-sm font-black text-pict-blue">{order.id}</td>
                          <td className="px-8 text-sm font-black">{order.name}</td>
                          <td className="px-8 text-right font-black text-emerald-600">Rs{order.amount}</td>
                          <td className="px-8 text-center">
                            <button
                              onClick={() => handlePrintAndProcessOrder(order)}
                              disabled={processingOrderId === order.id}
                              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-1 disabled:opacity-60"
                            >
                              <Printer size={12} /> {processingOrderId === order.id ? 'Printing...' : 'Print Receipt'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredLiveOrders.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-8 py-8 text-center text-xs font-bold text-slate-500">
                            No pending orders found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden mt-8">
                <div className="px-8 py-5 border-b bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest">Processed Orders</h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase">{processedOrders.length} Orders</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-160">
                    <thead>
                      <tr className="border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-4">Order ID</th>
                        <th className="px-8">Examiner</th>
                        <th className="px-8">Processed Date</th>
                        <th className="px-8 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedOrders.map((order) => (
                        <tr key={order.id} className="border-b border-slate-50">
                          <td className="px-8 py-4 font-mono text-xs font-black text-slate-700">{order.id}</td>
                          <td className="px-8 text-xs font-bold text-slate-700">{order.name}</td>
                          <td className="px-8 text-xs font-bold text-slate-500">{order.date}</td>
                          <td className="px-8 text-right text-xs font-black text-emerald-700">Rs{order.amount}</td>
                        </tr>
                      ))}
                      {processedOrders.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-8 py-8 text-center text-xs font-bold text-slate-500">
                            No processed orders yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="animate-in fade-in">
              <h2 className="text-2xl font-black text-pict-text uppercase mb-8">Menu Setup</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {Object.keys(categorySettings).map((cat) => (
                  <div key={cat} className={`bg-white p-5 rounded-3xl border-2 transition-all ${isCategoryOpenNow(categorySettings[cat]) ? 'border-emerald-500' : 'border-slate-200 opacity-80'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <Clock size={18} />
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-2 py-1 rounded-full ${isCategoryOpenNow(categorySettings[cat]) ? 'bg-emerald-500 text-white' : 'bg-red-100 text-red-600'}`}>
                          {isCategoryOpenNow(categorySettings[cat]) ? 'OPEN NOW' : 'CLOSED NOW'}
                        </span>
                        <button disabled={Boolean(isSavingCategoryKey)} onClick={() => toggleCategoryStatus(cat)} className={`text-[9px] font-black px-2 py-1 rounded-full ${categorySettings[cat].status ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'} disabled:opacity-60 disabled:cursor-not-allowed`}>
                          {categorySettings[cat].status ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-2">{cat}</p>
                    <div className="flex gap-1"><input disabled={Boolean(isSavingCategoryKey)} type="time" value={categorySettings[cat].fromTime} onChange={(e) => handleTimeChange(cat, 'fromTime', e.target.value)} className="w-full text-[10px] border rounded p-1 disabled:opacity-60 disabled:cursor-not-allowed" /><input disabled={Boolean(isSavingCategoryKey)} type="time" value={categorySettings[cat].toTime} onChange={(e) => handleTimeChange(cat, 'toTime', e.target.value)} className="w-full text-[10px] border rounded p-1 disabled:opacity-60 disabled:cursor-not-allowed" /></div>
                  </div>
                ))}
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div><label className="text-[10px] font-black uppercase">Item Name</label><input type="text" value={newMenuData.name} onChange={(e) => setNewMenuData({ ...newMenuData, name: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl mt-1 text-sm font-bold" /></div>
                  <div><label className="text-[10px] font-black uppercase">Category</label><select value={newMenuData.category} onChange={(e) => setNewMenuData({ ...newMenuData, category: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl mt-1 text-sm font-bold"><option value="Breakfast">Breakfast (Max Rs50)</option><option value="Lunch">Lunch (Max Rs100)</option><option value="Beverage">Beverage (Max Rs30)</option><option value="Snacks">Snacks (Max Rs30)</option></select></div>
                  <div><label className="text-[10px] font-black uppercase">Price</label><input type="number" value={newMenuData.price} onChange={(e) => setNewMenuData({ ...newMenuData, price: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl mt-1 text-sm font-black" /></div>
                </div>
                <button disabled={isAddingMenuItem} onClick={handleAddMenuItem} className="mt-6 bg-pict-blue text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl disabled:opacity-60 disabled:cursor-not-allowed">{isAddingMenuItem ? 'Saving...' : 'Save Item'}</button>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-5 border-b bg-slate-50/60 flex items-center justify-between">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest">Existing Menu Items</h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase">{orderedMenuItems.length} Items</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-4 text-left">Item Name</th>
                        <th className="px-8 py-4 text-left">Category</th>
                        <th className="px-8 py-4 text-right">Price</th>
                        <th className="px-8 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderedMenuItems.map((item) => {
                        const isEditing = editingMenuId === item._id;
                        const isLoading = menuActionLoadingId === item._id;

                        return (
                          <tr key={item._id} className="border-b border-slate-50 last:border-b-0 align-top">
                            <td className="px-8 py-4">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingMenuData.name}
                                  onChange={(e) => setEditingMenuData({ ...editingMenuData, name: e.target.value })}
                                  className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                                />
                              ) : (
                                <p className="text-sm font-bold text-slate-700">{item.name}</p>
                              )}
                            </td>
                            <td className="px-8 py-4">
                              {isEditing ? (
                                <select
                                  value={editingMenuData.category}
                                  onChange={(e) => setEditingMenuData({ ...editingMenuData, category: e.target.value })}
                                  className="w-full p-3 bg-slate-50 border rounded-xl text-sm font-bold"
                                >
                                  <option value="Breakfast">Breakfast (Max Rs50)</option>
                                  <option value="Lunch">Lunch (Max Rs100)</option>
                                  <option value="Beverage">Beverage (Max Rs30)</option>
                                  <option value="Snacks">Snacks (Max Rs30)</option>
                                </select>
                              ) : (
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600">{item.category}</span>
                              )}
                            </td>
                            <td className="px-8 py-4 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editingMenuData.price}
                                  onChange={(e) => setEditingMenuData({ ...editingMenuData, price: e.target.value })}
                                  className="w-28 p-3 bg-slate-50 border rounded-xl text-sm font-black text-right"
                                />
                              ) : (
                                <span className="text-sm font-black text-emerald-700">Rs{item.price}</span>
                              )}
                            </td>
                            <td className="px-8 py-4">
                              <div className="flex items-center justify-center gap-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateMenuItem(item._id)}
                                      disabled={isLoading}
                                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-emerald-600 text-white disabled:opacity-60"
                                    >
                                      <Save size={12} /> {isLoading ? 'Saving' : 'Save'}
                                    </button>
                                    <button
                                      onClick={handleCancelMenuEdit}
                                      disabled={isLoading}
                                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-200 text-slate-700 disabled:opacity-60"
                                    >
                                      <X size={12} /> Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleStartMenuEdit(item)}
                                    disabled={isLoading || !!editingMenuId}
                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-blue-100 text-blue-700 disabled:opacity-60"
                                  >
                                    <Pencil size={12} /> Edit
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteMenuItem(item._id)}
                                  disabled={isLoading}
                                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase bg-red-100 text-red-700 disabled:opacity-60"
                                >
                                  <Trash2 size={12} /> {isLoading ? 'Deleting' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {orderedMenuItems.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-8 py-8 text-center text-xs font-bold text-slate-500">
                            No menu items found. Add an item to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="animate-in fade-in">
              <h2 className="text-2xl font-black text-pict-text uppercase tracking-tight mb-8">Reports Panel</h2>
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8 text-left">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label><input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</label><input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label><select value={reportFilters.category} onChange={(e) => setReportFilters({ ...reportFilters, category: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold">{reportCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</label><select value={reportFilters.department} onChange={(e) => setReportFilters({ ...reportFilters, department: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold"><option value="All Departments">All Departments</option><option value="Computer Engineering (CE)">Computer Engineering (CE)</option><option value="Information Technology (IT)">Information Technology (IT)</option><option value="Artificial Intelligence and Data Science (AIDS)">Artificial Intelligence and Data Science (AIDS)</option><option value="Electronics and Computer Engineering (ECE)">Electronics and Computer Engineering (ECE)</option><option value="Electronics and Telecommunication (ENTC)">Electronics and Telecommunication (ENTC)</option></select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label><select value={reportFilters.examinerType} onChange={(e) => setReportFilters({ ...reportFilters, examinerType: e.target.value })} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold"><option>Both (Internal & External)</option><option>Internal</option><option>External</option></select></div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button disabled={isGeneratingReport} onClick={handleGenerateReport} className="flex-1 border border-pict-blue text-pict-blue py-5 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed">{isGeneratingReport ? 'Generating...' : 'Generate Detailed Report'}</button>
                  <button disabled={isDownloadingReport} onClick={handleDownloadReport} className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl hover:bg-pict-blue transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
                    <Download size={18} /> {isDownloadingReport ? 'Downloading...' : 'Download PICT Billing Report (PDF)'}
                  </button>
                </div>

                <div className="mt-8">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Report Preview</h3>
                    <span className="text-[10px] font-black text-slate-500 uppercase">{reportData.totalOrders || 0} Orders</span>
                  </div>
                  <div className="overflow-x-auto border rounded-2xl">
                    <table className="w-full min-w-[980px]">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 border-b bg-slate-50">
                          <th className="px-4 py-3 text-left">Order ID</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Type</th>
                          <th className="px-4 py-3 text-left">Department</th>
                          <th className="px-4 py-3 text-left">Subject</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Time</th>
                          <th className="px-4 py-3 text-left">Items</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportData.orders || []).map((order) => (
                          <tr key={`${order.id}-${order.createdAt || order.date}`} className="border-b last:border-b-0 text-xs">
                            <td className="px-4 py-3 font-mono font-black text-pict-blue">{order.id}</td>
                            <td className="px-4 py-3 font-bold text-slate-700">{order.name}</td>
                            <td className="px-4 py-3">{order.type}</td>
                            <td className="px-4 py-3">{order.dept}</td>
                            <td className="px-4 py-3 max-w-[220px] break-words">{order.subjectName || 'N/A'}</td>
                            <td className="px-4 py-3">{order.date}</td>
                            <td className="px-4 py-3">{order.time}</td>
                            <td className="px-4 py-3">{order.items}</td>
                            <td className="px-4 py-3 text-right font-black text-emerald-700">Rs{order.amount}</td>
                            <td className="px-4 py-3">{order.status}</td>
                          </tr>
                        ))}
                        {(reportData.orders || []).length === 0 && (
                          <tr>
                            <td colSpan="10" className="px-4 py-6 text-center text-xs font-bold text-slate-500">No report rows found for selected filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-black uppercase">
                    <div className="bg-slate-50 rounded-xl px-4 py-3">Internal Total: <span className="text-emerald-700">Rs{reportData.internalTotal || 0}</span></div>
                    <div className="bg-slate-50 rounded-xl px-4 py-3">External Total: <span className="text-emerald-700">Rs{reportData.externalTotal || 0}</span></div>
                    <div className="bg-slate-900 text-white rounded-xl px-4 py-3">Grand Total: Rs{reportData.grandTotal || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CanteenDashboard;
