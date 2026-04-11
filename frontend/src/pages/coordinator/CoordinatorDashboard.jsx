import React, { useEffect, useState } from 'react';
import { 
  Upload, Mail, MessageCircle, Trash2, 
  FileSpreadsheet, Users, Ticket, LayoutDashboard, 
  FileText, LogOut, Menu, X, User, ChevronRight, Hash, Search,
  Download, Eraser, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx'; 
import LogoImg from '../../assets/image.png';
import { clearAuthSession } from '../../utils/auth';
import {
  bulkCreateCoordinatorVouchers,
  clearCoordinatorVouchers,
  clearCoordinatorExternalVouchers,
  createCoordinatorVoucher,
  deleteCoordinatorExternalVoucher,
  deleteCoordinatorVoucher,
  getCoordinatorExternalVouchers,
  getCoordinatorVouchers,
  getCoordinatorReportData,
} from '../../services/coordinatorService';

const getTodayLocalDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const toDateKey = (dateText = '') => {
  const match = String(dateText || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return year * 10000 + month * 100 + day;
};

const OTHER_CATEGORY_VALUE = 'Other';

const EXAM_CATEGORY_OPTIONS = [
  '1st Year - Regular',
  '2nd Year - Regular',
  '3rd Year - Regular',
  '4th Year - Regular',
  '1st Year - Backlog',
  '2nd Year - Backlog',
  '3rd Year - Backlog',
  '4th Year - Backlog',
  'M.E./M.Tech - Regular',
  'M.E./M.Tech - Backlog',
  'Ph.D.',
  OTHER_CATEGORY_VALUE,
];

const CoordinatorDashboard = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [examYear, setExamYear] = useState('');
  const [customExamCategory, setCustomExamCategory] = useState('');
  const [dept, setDept] = useState('Department'); 
  const [deptCode, setDeptCode] = useState('CE');
  const [excelFile, setExcelFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 1. Data State (Shared for Voucher Management and Report Preview)
  const [examiners, setExaminers] = useState([]);
  const [externalVouchers, setExternalVouchers] = useState([]);
  const [voucherSearch, setVoucherSearch] = useState('');
  const [externalVoucherSearch, setExternalVoucherSearch] = useState('');

  // 2. Manual Entry State
  const [manualEntry, setManualEntry] = useState({ 
    name: '', email: '', phone: '', fromDate: '', toDate: '' 
  });

  // 3. Report Filter States
  const [reportFilters, setReportFilters] = useState({
    startDate: getTodayLocalDate(),
    endDate: getTodayLocalDate(),
    department: 'CE',
    examinerType: 'Both (Internal & External)',
  });
  const [reportData, setReportData] = useState({
    internal: [],
    external: [],
    internalTotal: 0,
    externalTotal: 0,
    grandTotal: 0,
  });

  const loadCoordinatorData = async () => {
    setIsLoading(true);
    try {
      const response = await getCoordinatorVouchers();
      setDept(response.departmentLabel);
      setDeptCode((response.department || 'ce').toUpperCase());
      setReportFilters((prev) => ({
        ...prev,
        department: (response.department || 'ce').toUpperCase(),
      }));
      setExaminers(response.vouchers || []);
    } catch {
      alert('Failed to load vouchers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCoordinatorData();
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      handleGenerateReport();
    }
    if (activeTab === 'external-vouchers') {
      loadExternalVouchers();
    }
  }, [activeTab]);

  const loadExternalVouchers = async () => {
    try {
      const response = await getCoordinatorExternalVouchers();
      setExternalVouchers(response.externalVouchers || []);
    } catch {
      alert('Failed to load external vouchers. Please try again.');
    }
  };

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  const getValueByHeaders = (row, headers) => {
    const rowKeys = Object.keys(row || {});
    for (const header of headers) {
      const key = rowKeys.find((k) => k.toLowerCase().trim() === header.toLowerCase().trim());
      if (key && row[key] !== undefined && row[key] !== null && `${row[key]}`.trim() !== '') {
        return row[key];
      }
    }
    return '';
  };

  const toSafeDateString = (value) => {
    if (!value && value !== 0) return '';
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return '';
      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${month}-${day}`;
    }

    const text = String(value).trim();
    const jsDate = new Date(text);
    if (!Number.isNaN(jsDate.getTime())) {
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      const day = String(jsDate.getDate()).padStart(2, '0');
      return `${jsDate.getFullYear()}-${month}-${day}`;
    }

    // Keep source text if it cannot be parsed; backend accepts string dates.
    return text;
  };

  // --- LOGIC FUNCTIONS ---
  const getVoucherStatus = (fromDate, toDate) => {
    const todayKey = toDateKey(getTodayLocalDate());
    const startKey = toDateKey(fromDate);
    const endKey = toDateKey(toDate);
    if (!todayKey || !startKey || !endKey) return 'Inactive';
    return todayKey >= startKey && todayKey <= endKey ? 'Active' : 'Inactive';
  };

  const handleDelete = async (idToRemove) => {
    if(window.confirm("Delete this examiner entry?")) {
      try {
        await deleteCoordinatorVoucher(idToRemove);
        setExaminers((prev) => prev.filter((exam) => exam._id !== idToRemove));
      } catch (error) {
        alert(error?.response?.data?.message || 'Failed to delete voucher from database.');
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to delete ALL generated vouchers? This cannot be undone.")) {
      try {
        await clearCoordinatorVouchers();
        await loadCoordinatorData();
      } catch (error) {
        alert(error?.response?.data?.message || 'Failed to clear vouchers from database.');
      }
    }
  };

  const handleDeleteExternalVoucher = async (voucherId) => {
    if (!window.confirm('Delete this external voucher?')) return;

    try {
      await deleteCoordinatorExternalVoucher(voucherId);
      setExternalVouchers((prev) => prev.filter((voucher) => voucher._id !== voucherId));
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to delete external voucher.');
    }
  };

  const handleClearAllExternalVouchers = async () => {
    if (!window.confirm('Delete ALL external vouchers for your department? This cannot be undone.')) return;

    try {
      await clearCoordinatorExternalVouchers();
      setExternalVouchers([]);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to clear external vouchers.');
    }
  };

  const handleSignOut = () => {
    clearAuthSession();
    navigate('/', { replace: true });
  };

  const handleDownloadExcel = () => {
    if (examiners.length === 0) return alert("No data available.");
    const dataToExport = examiners.map(ex => ({
      "Faculty Name": ex.name,
      "Email": ex.email,
      "Phone": ex.phone,
      "Access Code": ex.code,
      "Valid From": ex.fromDate,
      "Valid To": ex.toDate,
      "Status": getVoucherStatus(ex.fromDate, ex.toDate)
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");
    XLSX.writeFile(workbook, `PICT_Vouchers_${deptCode}.xlsx`);
  };

  const handleExcelUpload = () => {
    if (!excelFile) return alert("Please attach an Excel file first.");

    const selectedCategory = examYear === OTHER_CATEGORY_VALUE ? customExamCategory.trim() : examYear.trim();
    if (!selectedCategory) {
      alert('Please select a category/year before generating vouchers.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

      const newEntries = jsonData
        .map((row) => {
          const name = getValueByHeaders(row, ['Internal Examiner', 'Name', 'Examiner Name']);
          const phone = getValueByHeaders(row, ['Mobile No.', 'Mobile', 'Phone', 'Phone Number']);
          const subjectNameRaw = getValueByHeaders(row, ['Subject Name', 'Subject', 'Course Name', 'Paper Name']);
          const fromDateRaw = getValueByHeaders(row, ['From Date', 'FromDate', 'Start Date']);
          const toDateRaw = getValueByHeaders(row, ['End Date', 'To Date', 'ToDate']);

          const fromDate = toSafeDateString(fromDateRaw) || reportFilters.startDate;
          const toDate = toSafeDateString(toDateRaw) || reportFilters.endDate;

          return {
            name: String(name || '').trim(),
            email: 'N/A',
            phone: String(phone || 'N/A').trim(),
            fromDate,
            toDate,
            subjectName: String(subjectNameRaw || '').trim() || 'N/A',
            type: 'Internal',
            amount: 0,
            items: 'Pending',
            date: fromDate,
            category: selectedCategory,
          };
        })
        .filter((entry) => entry.name && entry.fromDate && entry.toDate);

      if (newEntries.length === 0) {
        alert('No valid rows found. Please use columns: Internal Examiner, Mobile No., From Date, End Date.');
        return;
      }

      try {
        const response = await bulkCreateCoordinatorVouchers(newEntries);
        setExaminers(response.vouchers || []);
        setExcelFile(null);
        alert(`${response.count || newEntries.length} vouchers generated successfully.`);
      } catch (error) {
        const message = error?.response?.data?.message || 'Bulk upload failed. Please verify sheet format.';
        alert(message);
      }
    };
    reader.readAsBinaryString(excelFile);
  };

  const handleAddManual = async () => {
    if (!manualEntry.name || !manualEntry.email || !manualEntry.phone || !manualEntry.fromDate || !manualEntry.toDate) {
      alert("Please fill all fields.");
      return;
    }
    const created = await createCoordinatorVoucher(manualEntry);
    setExaminers((prev) => {
      const exists = prev.some((voucher) => voucher._id === created._id);
      if (exists) {
        return prev.map((voucher) => (voucher._id === created._id ? created : voucher));
      }
      return [created, ...prev];
    });
    setManualEntry({ name: '', email: '', phone: '', fromDate: '', toDate: '' });
  };

  const handleWhatsApp = (exam) => {
    const msg = encodeURIComponent(`Hello ${exam.name}, your PICT Canteen Voucher Code is: ${exam.code}. Valid: ${exam.fromDate} to ${exam.toDate}.`);
    window.open(`https://wa.me/${exam.phone}?text=${msg}`, '_blank');
  };

  const handleEmail = (person) => {
    const subject = encodeURIComponent("PICT Canteen Voucher Code");
    const body = encodeURIComponent(`Hello ${person.name},\n\nYour Access Code is: ${person.code}\nValidity: ${person.fromDate} to ${person.toDate}`);
    window.open(`mailto:${person.email}?subject=${subject}&body=${body}`, '_self'); 
  };

  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const dashboardStats = [
    { label: 'Generated vouchers', value: examiners.length, tone: 'from-pict-blue to-indigo-500' },
    { label: 'External vouchers', value: externalVouchers.length, tone: 'from-emerald-500 to-teal-500' },
    { label: 'Report rows', value: reportData.internal.length + reportData.external.length, tone: 'from-amber-500 to-orange-500' },
  ];

  const normalizedVoucherSearch = voucherSearch.trim().toLowerCase();
  const filteredExaminers = examiners.filter((exam) => {
    if (!normalizedVoucherSearch) return true;

    return [exam.name, exam.code, exam.phone, exam.fromDate, exam.toDate]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedVoucherSearch));
  });

  const normalizedExternalVoucherSearch = externalVoucherSearch.trim().toLowerCase();
  const filteredExternalVouchers = externalVouchers.filter((voucher) => {
    if (!normalizedExternalVoucherSearch) return true;

    return [voucher.name, voucher.code, voucher.createdByName, voucher.createdByVoucherCode, voucher.phone, voucher.fromDate, voucher.toDate]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedExternalVoucherSearch));
  });

  const handleGenerateReport = async () => {
    if (!reportFilters.startDate || !reportFilters.endDate) {
      alert('Please choose start and end date.');
      return;
    }

    try {
      const data = await getCoordinatorReportData({
        startDate: reportFilters.startDate,
        endDate: reportFilters.endDate,
        examinerType: reportFilters.examinerType,
      });
      setReportData({
        internal: data.internal || [],
        external: data.external || [],
        internalTotal: data.internalTotal || 0,
        externalTotal: data.externalTotal || 0,
        grandTotal: data.grandTotal || 0,
      });
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to generate report.');
    }
  };

  const handleDownloadReport = async () => {
    if (!reportFilters.startDate || !reportFilters.endDate) {
      alert('Please choose start and end date.');
      return;
    }

    let latest = reportData;
    try {
      const data = await getCoordinatorReportData({
        startDate: reportFilters.startDate,
        endDate: reportFilters.endDate,
        examinerType: reportFilters.examinerType,
      });
      latest = {
        internal: data.internal || [],
        external: data.external || [],
        internalTotal: data.internalTotal || 0,
        externalTotal: data.externalTotal || 0,
        grandTotal: data.grandTotal || 0,
      };
      setReportData(latest);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to fetch latest report before export.');
      return;
    }

    const { internal, external, internalTotal, externalTotal, grandTotal } = latest;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Coordinator_Billing_Report</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; line-height: 1.4; margin: 0; padding: 10px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
            .header h1 { font-size: 16pt; margin: 0; font-weight: bold; text-transform: uppercase; }
            .header h2 { font-size: 12pt; margin: 5px 0; }
            .report-title { text-align: center; font-weight: bold; text-decoration: underline; margin: 15px 0; font-size: 13pt; }
            .meta-section { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 11pt; }
            .section-header { font-weight: bold; margin: 20px 0 10px 0; font-size: 11pt; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 10pt; }
            th { background: #eee; font-weight: bold; }
            .subject-cell { min-width: 180px; max-width: 260px; white-space: normal; word-break: break-word; }
            .subtotal { text-align: right; font-weight: bold; padding: 10px; border: 1px solid #000; border-top: none; }
            .grand-total { margin-top: 25px; font-weight: bold; font-size: 13pt; display: flex; justify-content: space-between; padding: 10px; border: 2px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>SCTR'S PUNE INSTITUTE OF COMPUTER TECHNOLOGY</h1>
            <h2>Office of the Mess & Canteen Section</h2>
          </div>

          <div class="report-title">DEPARTMENT-WISE BILLING REPORT</div>

          <div class="meta-section">
            <div>
              Ref No: PICT/CNTN/2026/042<br/>
              Department: ${deptCode}
            </div>
            <div style="text-align: right;">
              Period: ${formatDateForDisplay(reportFilters.startDate)} to ${formatDateForDisplay(reportFilters.endDate)}
            </div>
          </div>

          <div class="section-header">SECTION A: FACULTY CONSUMPTION</div>
          <table>
            <thead><tr><th>Sr</th><th>Order ID</th><th>Faculty Name</th><th>Subject Name</th><th>Date</th><th>Time</th><th>Items Consumed</th><th>Total (Rs)</th></tr></thead>
            <tbody>
              ${internal.length > 0 ? internal.map((o, i) => `<tr><td>${i + 1}</td><td>${o.id}</td><td>${o.name}</td><td class="subject-cell">${o.subjectName || 'N/A'}</td><td>${formatDateForDisplay(o.date)}</td><td>${o.time || ''}</td><td>${o.items}</td><td>Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="8" style="text-align:center">No Records</td></tr>'}
            </tbody>
          </table>
          <div class="subtotal">Sub-Total (Faculty): Rs. ${internalTotal}/-</div>

          <div class="section-header">SECTION B: GUEST/EXTERNAL CONSUMPTION</div>
          <table>
            <thead><tr><th>Sr</th><th>Order ID</th><th>Guest Name</th><th>Subject Name</th><th>Date</th><th>Time</th><th>Items Consumed</th><th>Total (Rs)</th></tr></thead>
            <tbody>
              ${external.length > 0 ? external.map((o, i) => `<tr><td>${i + 1}</td><td>${o.id}</td><td>${o.name}</td><td class="subject-cell">${o.subjectName || 'N/A'}</td><td>${formatDateForDisplay(o.date)}</td><td>${o.time || ''}</td><td>${o.items}</td><td>Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="8" style="text-align:center">No Records</td></tr>'}
            </tbody>
          </table>
          <div class="subtotal">Sub-Total (Guest): Rs. ${externalTotal}/-</div>

          <div class="grand-total">
            <span>GRAND TOTAL</span>
            <span>Rs. ${grandTotal}</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <p className="text-slate-600 font-bold">Loading department dashboard...</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(45,62,139,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_24%),linear-gradient(180deg,_#F8FAFF_0%,_#EEF3FF_100%)] font-sans text-pict-text">
      <div className="pointer-events-none absolute -top-24 right-[-5rem] h-72 w-72 rounded-full bg-pict-blue/10 blur-3xl"></div>
      <div className="pointer-events-none absolute left-[-6rem] top-1/3 h-80 w-80 rounded-full bg-cyan-200/25 blur-3xl"></div>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={toggleSidebar} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-[linear-gradient(180deg,_#2D3E8B_0%,_#1F2B66_100%)] text-white flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static shadow-[18px_0_60px_rgba(18,28,74,0.22)] backdrop-blur-xl border-r border-white/10 overflow-hidden`}>
        <div className="p-8 border-b border-white/10 text-left bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="bg-white p-3 rounded-2xl shadow-lg inline-block mb-4 ring-1 ring-white/15"><img src={LogoImg} className="h-8 w-auto" alt="PICT" /></div>
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-xl bg-white/10 text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-200/80 mb-2">Coordinator View</p>
          <h2 className="text-sm font-black text-white uppercase tracking-wide">{dept}</h2>
        </div>
        <nav className="flex-1 p-6 space-y-3 text-left overflow-y-auto">
          <button onClick={() => {setActiveTab('dashboard'); setSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border ${activeTab === 'dashboard' ? 'bg-white/12 border-white/15 text-white shadow-lg shadow-black/10' : 'border-transparent text-white/65 hover:bg-white/8 hover:text-white'}`}><LayoutDashboard size={18} /> Dashboard</button>
          <button onClick={() => {setActiveTab('external-vouchers'); setSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border ${activeTab === 'external-vouchers' ? 'bg-white/12 border-white/15 text-white shadow-lg shadow-black/10' : 'border-transparent text-white/65 hover:bg-white/8 hover:text-white'}`}><Ticket size={18} /> External Vouchers</button>
          <button onClick={() => {setActiveTab('reports'); setSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all border ${activeTab === 'reports' ? 'bg-white/12 border-white/15 text-white shadow-lg shadow-black/10' : 'border-transparent text-white/65 hover:bg-white/8 hover:text-white'}`}><FileText size={18} /> View Reports</button>
        </nav>
        <div className="mt-auto p-6 border-t border-white/10 text-left bg-white/5"><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 bg-red-500/10 text-red-300 rounded-2xl text-xs font-black transition-all hover:bg-red-500/20"><LogOut size={18} /> Sign Out</button></div>
      </aside>

      <main className="relative flex-1 overflow-y-auto lg:ml-72 h-screen">
        <div className="lg:hidden flex items-center justify-between bg-white/90 backdrop-blur-xl px-4 sm:px-6 py-4 border-b border-white/70 sticky top-0 z-30 shadow-sm">
          <img src={LogoImg} className="h-8 w-auto" alt="PICT" />
          <button onClick={toggleSidebar} className="p-2 bg-pict-blue text-white rounded-xl shadow-lg shadow-pict-blue/20" aria-label="Open menu">
            <Menu size={24} />
          </button>
        </div>

        <div className="p-4 sm:p-6 md:p-10 lg:p-14 text-left">
          <div className="mb-8 rounded-[2rem] border border-white/70 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(45,62,139,0.08)] p-6 sm:p-8 overflow-hidden relative">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(45,62,139,0.05),_transparent_45%,_rgba(14,165,233,0.08))]" />
            <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-pict-blue/70 mb-3">Coordinator Workspace</p>
                <h1 className="text-3xl md:text-4xl font-black text-pict-text uppercase tracking-tight">Voucher Management</h1>
                <p className="mt-3 max-w-2xl text-sm md:text-[15px] leading-6 text-slate-500 font-medium">
                  Manage generated vouchers, review guest access, and track department billing from one polished control panel.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-auto">
                {dashboardStats.map((stat) => (
                  <div key={stat.label} className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm min-w-[160px]">
                    <div className={`inline-flex items-center rounded-full bg-gradient-to-r ${stat.tone} px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm`}>
                      {stat.label}
                    </div>
                    <p className="mt-3 text-3xl font-black text-pict-text">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
                <div className="xl:col-span-2 rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] p-8 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pict-blue via-indigo-400 to-cyan-300"></div>
                  <div className="flex items-center justify-between gap-4 mb-8">
                    <div>
                      <h3 className="text-xs font-black text-pict-text uppercase tracking-[0.24em]">Bulk Import (Excel)</h3>
                      <p className="text-[11px] font-medium text-slate-500 mt-2">Upload a sheet and generate vouchers with a cleaner import experience.</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 rounded-full bg-pict-light-blue px-4 py-2 text-[10px] font-black uppercase tracking-widest text-pict-blue">Fast entry</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-2">
                      <select
                        value={examYear}
                        onChange={(e) => {
                          const value = e.target.value;
                          setExamYear(value);
                          if (value !== OTHER_CATEGORY_VALUE) {
                            setCustomExamCategory('');
                          }
                        }}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold shadow-sm outline-none focus:border-pict-blue focus:bg-white"
                      >
                        <option value="">Select Category...</option>
                        {EXAM_CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      {examYear === OTHER_CATEGORY_VALUE && (
                        <input
                          type="text"
                          value={customExamCategory}
                          onChange={(e) => setCustomExamCategory(e.target.value)}
                          placeholder="Type custom category"
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold shadow-sm outline-none focus:border-pict-blue focus:bg-white"
                        />
                      )}
                    </div>
                    <label className={`flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${excelFile ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-slate-50/70 hover:bg-white'}`}><FileSpreadsheet size={20} className="text-pict-blue" /><span className="text-sm font-bold truncate">{excelFile ? excelFile.name : "Attach Spreadsheet"}</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} /></label>
                  </div>
                  <button onClick={handleExcelUpload} className="w-full bg-[linear-gradient(135deg,_#2D3E8B_0%,_#4157B3_100%)] text-white py-4.5 rounded-3xl font-black text-xs uppercase shadow-[0_18px_40px_rgba(45,62,139,0.25)] transition-transform active:scale-[0.99]">Generate Vouchers</button>
                </div>

                <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] p-8">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-[0.24em] mb-8">Manual Entry</h3>
                  <div className="space-y-4">
                    <input type="text" placeholder="Full Name" value={manualEntry.name} onChange={e => setManualEntry({...manualEntry, name: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-pict-blue" />
                    <input type="email" placeholder="Email Address" value={manualEntry.email} onChange={e => setManualEntry({...manualEntry, email: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-pict-blue" />
                    <input type="text" placeholder="Phone Number" value={manualEntry.phone} onChange={e => setManualEntry({...manualEntry, phone: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-pict-blue" />
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">From</p><input type="date" value={manualEntry.fromDate} onChange={e => setManualEntry({...manualEntry, fromDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:bg-white focus:border-pict-blue" /></div>
                      <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">To</p><input type="date" value={manualEntry.toDate} onChange={e => setManualEntry({...manualEntry, toDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-bold outline-none focus:bg-white focus:border-pict-blue" /></div>
                    </div>
                    <button onClick={handleAddManual} className="w-full border-2 border-pict-blue text-pict-blue py-3.5 rounded-2xl font-black text-[10px] uppercase transition-all hover:bg-pict-blue hover:text-white shadow-sm">Add Entry</button>
                  </div>
                </div>
              </div>

              <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[linear-gradient(180deg,_rgba(248,250,255,0.96),_rgba(255,255,255,0.96))]">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest">Generated Vouchers</h3>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={handleDownloadExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-pict-blue uppercase shadow-sm transition-all hover:shadow-md"><Download size={14} /> Download</button>
                    <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 border border-red-100 rounded-2xl text-[10px] font-black uppercase shadow-sm transition-all hover:bg-red-100"><Eraser size={14} /> Clear Vouchers</button>
                  </div>
                </div>
                <div className="px-8 py-5 border-b border-slate-100 bg-white/80">
                  <div className="relative max-w-md">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={voucherSearch}
                      onChange={(e) => setVoucherSearch(e.target.value)}
                      placeholder="Search by name, code, phone..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue shadow-sm"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-190">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <th className="px-6 py-5">Examiner Name</th>
                        <th className="px-6">Voucher Code</th>
                        <th className="px-6">Phone</th>
                        <th className="px-6 text-center">Valid From</th>
                        <th className="px-6 text-center">Valid To</th>
                        <th className="px-6 text-center">Status</th>
                        <th className="px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredExaminers.map(ex => (
                        <tr key={ex._id} className="hover:bg-slate-50/70 transition-all">
                          <td className="px-6 py-5"><p className="font-bold text-sm text-pict-text">{ex.name}</p></td>
                          <td className="px-6 font-mono font-black text-xs text-pict-blue uppercase"><Hash size={12} className="inline mr-1" />{ex.code}</td>
                          <td className="px-6 text-xs font-bold text-slate-600">{ex.phone || 'N/A'}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{ex.fromDate}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{ex.toDate}</td>
                          <td className="px-6 text-center"><span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${getVoucherStatus(ex.fromDate, ex.toDate) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{getVoucherStatus(ex.fromDate, ex.toDate)}</span></td>
                          <td className="px-6">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleDelete(ex._id)} className="p-2 text-red-500 hover:text-red-600 transition-all" title="Delete voucher"><Trash2 size={16} /></button>
                              <button onClick={() => handleEmail(ex)} className="p-2 text-slate-400 hover:text-pict-blue transition-all"><Mail size={16}/></button>
                              <button onClick={() => handleWhatsApp(ex)} className="p-2 text-slate-400 hover:text-emerald-600 transition-all"><MessageCircle size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredExaminers.length === 0 && (
                        <tr>
                          <td colSpan="7" className="px-6 py-8 text-center text-xs font-bold text-slate-500">
                            {voucherSearch.trim() ? 'No matching vouchers found.' : 'No vouchers generated yet.'}
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
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 mb-8">
                <div><h2 className="text-2xl font-black text-pict-text uppercase tracking-tight">Report Review</h2><p className="text-slate-500 text-sm font-medium italic mt-1">Department-wise records from actual canteen orders.</p></div>
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <button onClick={handleGenerateReport} className="flex items-center gap-2 px-6 py-3 border border-pict-blue text-pict-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">Generate</button>
                  <button onClick={handleDownloadReport} className="flex items-center gap-2 px-6 py-3 bg-pict-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl"><Download size={16} /> Export PDF</button>
                </div>
              </div>

              <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] p-4 sm:p-6 lg:p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Start Date</label><input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">End Date</label><input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Department</label><div className="w-full p-4 bg-pict-light-blue border border-slate-200 rounded-2xl text-sm font-black text-pict-blue">{deptCode}</div></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Type</label><select value={reportFilters.examinerType} onChange={(e) => setReportFilters({...reportFilters, examinerType: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue"><option>Both (Internal & External)</option><option>Internal</option><option>External</option></select></div>
                </div>
              </div>

              <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] p-4 sm:p-8 lg:p-12 max-w-5xl mx-auto overflow-hidden print:shadow-none print:border-none">
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                  <h1 className="text-xl font-black text-slate-900 uppercase">SCTR'S PUNE INSTITUTE OF COMPUTER TECHNOLOGY</h1>
                  <h2 className="text-sm font-bold text-slate-600">Office of the Mess & Canteen Section</h2>
                </div>
                <h3 className="text-center font-black underline mb-6">DEPARTMENT-WISE BILLING REPORT</h3>
                <div className="flex justify-between text-sm font-bold mb-8">
                  <div className="text-left space-y-1"><p>Ref No: PICT/CNTN/2026/042</p><p>Department: {deptCode}</p></div>
                  <div className="text-right"><p>Period: {formatDateForDisplay(reportFilters.startDate)} to {formatDateForDisplay(reportFilters.endDate)}</p></div>
                </div>
                <div className="bg-slate-100 p-2 font-black text-sm border border-slate-900 mb-2 text-left uppercase tracking-wide">SECTION A: FACULTY CONSUMPTION</div>
                <table className="w-full border-collapse border border-slate-900 mb-2 text-xs">
                  <thead className="bg-slate-50"><tr><th className="border border-slate-900 p-2 text-center">Sr</th><th className="border border-slate-900 p-2">Order ID</th><th className="border border-slate-900 p-2">Faculty Name</th><th className="border border-slate-900 p-2">Subject Name</th><th className="border border-slate-900 p-2">Date</th><th className="border border-slate-900 p-2">Time</th><th className="border border-slate-900 p-2">Items Consumed</th><th className="border border-slate-900 p-2 text-right">Total (Rs)</th></tr></thead>
                  <tbody>{reportData.internal.length > 0 ? reportData.internal.map((o, i) => (<tr key={o.id}><td className="border border-slate-900 p-2 text-center">{i+1}</td><td className="border border-slate-900 p-2 font-mono">{o.id}</td><td className="border border-slate-900 p-2 font-bold">{o.name}</td><td className="border border-slate-900 p-2 wrap-break-word max-w-55">{o.subjectName || 'N/A'}</td><td className="border border-slate-900 p-2">{o.date}</td><td className="border border-slate-900 p-2">{o.time || ''}</td><td className="border border-slate-900 p-2">{o.items}</td><td className="border border-slate-900 p-2 font-black text-right">Rs. {o.amount}</td></tr>)) : (<tr><td colSpan="8" className="border border-slate-900 p-4 text-center">No Records.</td></tr>)}</tbody>
                </table>
                <div className="text-right font-black text-sm p-2 border border-slate-900 border-t-0 mb-6 uppercase tracking-wide">Sub-Total (Faculty): Rs. {reportData.internalTotal}/-</div>
                <div className="bg-slate-100 p-2 font-black text-sm border border-slate-900 mb-2 text-left uppercase tracking-wide">SECTION B: GUEST/EXTERNAL CONSUMPTION</div>
                <table className="w-full border-collapse border border-slate-900 mb-2 text-xs">
                  <thead className="bg-slate-50"><tr><th className="border border-slate-900 p-2 text-center">Sr</th><th className="border border-slate-900 p-2">Order ID</th><th className="border border-slate-900 p-2">Guest Name</th><th className="border border-slate-900 p-2">Subject Name</th><th className="border border-slate-900 p-2">Date</th><th className="border border-slate-900 p-2">Time</th><th className="border border-slate-900 p-2">Items Consumed</th><th className="border border-slate-900 p-2 text-right">Total (Rs)</th></tr></thead>
                  <tbody>{reportData.external.length > 0 ? reportData.external.map((o, i) => (<tr key={o.id}><td className="border border-slate-900 p-2 text-center">{i+1}</td><td className="border border-slate-900 p-2 font-mono">{o.id}</td><td className="border border-slate-900 p-2 font-bold">{o.name}</td><td className="border border-slate-900 p-2 wrap-break-word max-w-55">{o.subjectName || 'N/A'}</td><td className="border border-slate-900 p-2">{o.date}</td><td className="border border-slate-900 p-2">{o.time || ''}</td><td className="border border-slate-900 p-2">{o.items}</td><td className="border border-slate-900 p-2 font-black text-right">Rs. {o.amount}</td></tr>)) : (<tr><td colSpan="8" className="border border-slate-900 p-4 text-center">No Records.</td></tr>)}</tbody>
                </table>
                <div className="text-right font-black text-sm p-2 border border-slate-900 border-t-0 mb-6 uppercase tracking-wide">Sub-Total (Guest): Rs. {reportData.externalTotal}/-</div>
                <div className="flex justify-between items-center border-2 border-slate-900 p-4 font-black text-lg tracking-wide rounded-xl bg-white"><span>GRAND TOTAL</span><span>Rs. {reportData.grandTotal}</span></div>
                <div className="flex flex-col sm:flex-row justify-between mt-12 sm:mt-16 px-2 sm:px-10 gap-6 sm:gap-0">
                  <div className="text-center"><div className="w-32 border-t border-slate-900 mb-1 mx-auto"></div><p className="text-[10px] font-black uppercase">MESS MANAGER</p><p className="text-[9px] text-slate-400">Sign & Seal</p></div>
                  <div className="text-center"><div className="w-32 border-t border-slate-900 mb-1 mx-auto"></div><p className="text-[10px] font-black uppercase">HEAD OF DEPARTMENT</p><p className="text-[9px] text-slate-400">Dept. of {deptCode}</p></div>
                </div>
                <div className="mt-10 pt-4 border-t border-slate-200 text-[8px] text-center text-slate-400 font-bold uppercase tracking-[0.2em]">THIS IS A SYSTEM-GENERATED STATEMENT FOR INTERNAL ACCOUNTING AND AUDIT PURPOSES.</div>
              </div>
            </div>
          )}

          {activeTab === 'external-vouchers' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pict-text uppercase tracking-tight">External Vouchers</h2>
                  <p className="text-slate-500 text-sm font-medium italic mt-1">Guest vouchers generated by faculty for {deptCode} department.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button onClick={loadExternalVouchers} className="flex items-center gap-2 px-6 py-3 border border-pict-blue text-pict-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">
                    Refresh
                  </button>
                  <button onClick={handleClearAllExternalVouchers} className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-500 border border-red-100 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">
                    <Eraser size={14} /> Clear Vouchers
                  </button>
                </div>
              </div>

              <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-100 bg-white/80">
                  <div className="relative max-w-md">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={externalVoucherSearch}
                      onChange={(e) => setExternalVoucherSearch(e.target.value)}
                      placeholder="Search by guest name, code, faculty name..."
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue shadow-sm"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-230">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <th className="px-6 py-5">Guest Name</th>
                        <th className="px-6">Guest Voucher</th>
                        <th className="px-6">Faculty Name</th>
                        <th className="px-6">Faculty Voucher</th>
                        <th className="px-6">Phone</th>
                        <th className="px-6 text-center">Valid From</th>
                        <th className="px-6 text-center">Valid To</th>
                        <th className="px-6 text-center">Created On</th>
                        <th className="px-6 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredExternalVouchers.map((voucher) => (
                        <tr key={voucher._id} className="hover:bg-slate-50/70 transition-all">
                          <td className="px-6 py-5"><p className="font-bold text-sm text-pict-text">{voucher.name}</p></td>
                          <td className="px-6 font-mono font-black text-xs text-emerald-700 uppercase"><Hash size={12} className="inline mr-1" />{voucher.code}</td>
                          <td className="px-6 text-xs font-bold text-slate-700">{voucher.createdByName || 'N/A'}</td>
                          <td className="px-6 font-mono text-xs font-black text-pict-blue uppercase"><Hash size={12} className="inline mr-1" />{voucher.createdByVoucherCode || 'N/A'}</td>
                          <td className="px-6 text-xs font-bold text-slate-600">{voucher.phone || 'N/A'}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{voucher.fromDate}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{voucher.toDate}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-6 text-center">
                            <button
                              onClick={() => handleDeleteExternalVoucher(voucher._id)}
                              className="p-2 text-red-500 hover:text-red-600 transition-all"
                              title="Delete external voucher"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredExternalVouchers.length === 0 && (
                        <tr>
                          <td colSpan="9" className="px-6 py-8 text-center text-xs font-bold text-slate-500">
                            {externalVoucherSearch.trim() ? 'No matching external vouchers found.' : 'No external vouchers generated yet.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CoordinatorDashboard;