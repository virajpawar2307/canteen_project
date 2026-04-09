import React, { useEffect, useState } from 'react';
import { 
  Upload, Mail, MessageCircle, Trash2, 
  FileSpreadsheet, Users, Ticket, LayoutDashboard, 
  FileText, LogOut, Menu, X, User, ChevronRight, Hash,
  Download, Eraser, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx'; 
import LogoImg from '../../assets/image.png';
import { clearAuthSession } from '../../utils/auth';
import {
  bulkCreateCoordinatorVouchers,
  clearCoordinatorVouchers,
  createCoordinatorVoucher,
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

const CoordinatorDashboard = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [examYear, setExamYear] = useState('');
  const [dept, setDept] = useState('Department'); 
  const [deptCode, setDeptCode] = useState('CE');
  const [excelFile, setExcelFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 1. Data State (Shared for Voucher Management and Report Preview)
  const [examiners, setExaminers] = useState([]);
  const [externalVouchers, setExternalVouchers] = useState([]);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(fromDate);
    const end = new Date(toDate);
    return (today >= start && today <= end) ? 'Active' : 'Inactive';
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
    const reader = new FileReader();
    reader.onload = async (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' });
      const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

      const newEntries = jsonData
        .map((row) => {
          const name = getValueByHeaders(row, ['Internal Examiner', 'Name', 'Examiner Name']);
          const phone = getValueByHeaders(row, ['Mobile No.', 'Mobile', 'Phone', 'Phone Number']);
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
            type: 'Internal',
            amount: 0,
            items: getValueByHeaders(row, ['Subject Name', 'Items Consumed']) || 'Pending',
            date: fromDate,
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
            <thead><tr><th>Sr</th><th>Order ID</th><th>Faculty Name</th><th>Date</th><th>Time</th><th>Items Consumed</th><th>Total (Rs)</th></tr></thead>
            <tbody>
              ${internal.length > 0 ? internal.map((o, i) => `<tr><td>${i + 1}</td><td>${o.id}</td><td>${o.name}</td><td>${formatDateForDisplay(o.date)}</td><td>${o.time || ''}</td><td>${o.items}</td><td>Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center">No Records</td></tr>'}
            </tbody>
          </table>
          <div class="subtotal">Sub-Total (Faculty): Rs. ${internalTotal}/-</div>

          <div class="section-header">SECTION B: GUEST/EXTERNAL CONSUMPTION</div>
          <table>
            <thead><tr><th>Sr</th><th>Order ID</th><th>Guest Name</th><th>Date</th><th>Time</th><th>Items Consumed</th><th>Total (Rs)</th></tr></thead>
            <tbody>
              ${external.length > 0 ? external.map((o, i) => `<tr><td>${i + 1}</td><td>${o.id}</td><td>${o.name}</td><td>${formatDateForDisplay(o.date)}</td><td>${o.time || ''}</td><td>${o.items}</td><td>Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center">No Records</td></tr>'}
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
    <div className="flex min-h-screen bg-[#F0F2F5] font-sans">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={toggleSidebar} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-pict-blue text-white flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static shadow-2xl`}>
        <div className="p-8 border-b border-white/10 text-left">
          <div className="bg-white p-3 rounded-xl shadow-lg inline-block mb-4"><img src={LogoImg} className="h-8 w-auto" alt="PICT" /></div>
          <h2 className="text-sm font-black text-blue-100 uppercase">{dept}</h2>
        </div>
        <nav className="flex-1 p-6 space-y-3 text-left">
          <button onClick={() => {setActiveTab('dashboard'); setSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-white/10 border-l-4 border-blue-400 text-white' : 'text-white/60 hover:text-white'}`}><LayoutDashboard size={18} /> Dashboard</button>
          <button onClick={() => {setActiveTab('external-vouchers'); setSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'external-vouchers' ? 'bg-white/10 border-l-4 border-emerald-400 text-white' : 'text-white/60 hover:text-white'}`}><Ticket size={18} /> External Vouchers</button>
          <button onClick={() => {setActiveTab('reports'); setSidebarOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'reports' ? 'bg-white/10 border-l-4 border-purple-400 text-white' : 'text-white/60 hover:text-white'}`}><FileText size={18} /> View Reports</button>
        </nav>
        <div className="p-6 border-t border-white/10 text-left"><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 bg-red-500/10 text-red-400 rounded-xl text-xs font-black"><LogOut size={18} /> Sign Out</button></div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-10 lg:p-14 text-left">
          
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in">
              <h1 className="text-2xl md:text-3xl font-black text-pict-text uppercase mb-8">Voucher Management</h1>
              
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-12">
                <div className="xl:col-span-2 bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest mb-8">Bulk Import (Excel)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <select value={examYear} onChange={(e) => setExamYear(e.target.value)} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm font-bold"><option value="">Select Category...</option><option>2nd Year - Regular</option><option>3rd Year - Regular</option><option>4th Year - Regular</option></select>
                    <label className={`flex items-center justify-center gap-3 p-3.5 border-2 border-dashed rounded-2xl cursor-pointer ${excelFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'}`}><FileSpreadsheet size={20} className="text-pict-blue" /><span className="text-sm font-bold truncate">{excelFile ? excelFile.name : "Attach Spreadsheet"}</span><input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => setExcelFile(e.target.files[0])} /></label>
                  </div>
                  <button onClick={handleExcelUpload} className="w-full bg-pict-blue text-white py-4.5 rounded-2xl font-black text-xs uppercase shadow-xl">Generate Vouchers</button>
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest mb-8">Manual Entry</h3>
                  <div className="space-y-4">
                    <input type="text" placeholder="Full Name" value={manualEntry.name} onChange={e => setManualEntry({...manualEntry, name: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    <input type="email" placeholder="Email Address" value={manualEntry.email} onChange={e => setManualEntry({...manualEntry, email: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    <input type="text" placeholder="Phone Number" value={manualEntry.phone} onChange={e => setManualEntry({...manualEntry, phone: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold" />
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">From</p><input type="date" value={manualEntry.fromDate} onChange={e => setManualEntry({...manualEntry, fromDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold" /></div>
                      <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">To</p><input type="date" value={manualEntry.toDate} onChange={e => setManualEntry({...manualEntry, toDate: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold" /></div>
                    </div>
                    <button onClick={handleAddManual} className="w-full border-2 border-pict-blue text-pict-blue py-3.5 rounded-xl font-black text-[10px] uppercase transition-all hover:bg-pict-blue hover:text-white">Add Entry</button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest">Generated Vouchers</h3>
                  <div className="flex gap-3">
                    <button onClick={handleDownloadExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-pict-blue uppercase shadow-sm"><Download size={14} /> Download</button>
                    <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 border border-red-100 rounded-xl text-[10px] font-black uppercase shadow-sm"><Eraser size={14} /> Clear All</button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[760px]">
                    <thead>
                      <tr className="border-b bg-white text-[10px] font-black text-slate-400 uppercase">
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
                      {examiners.map(ex => (
                        <tr key={ex._id} className="hover:bg-slate-50 transition-all">
                          <td className="px-6 py-5"><p className="font-bold text-sm text-pict-text">{ex.name}</p></td>
                          <td className="px-6 font-mono font-black text-xs text-pict-blue uppercase"><Hash size={12} className="inline mr-1" />{ex.code}</td>
                          <td className="px-6 text-xs font-bold text-slate-600">{ex.phone || 'N/A'}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{ex.fromDate}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{ex.toDate}</td>
                          <td className="px-6 text-center"><span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${getVoucherStatus(ex.fromDate, ex.toDate) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{getVoucherStatus(ex.fromDate, ex.toDate)}</span></td>
                          <td className="px-6">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleEmail(ex)} className="p-2 text-slate-400 hover:text-pict-blue transition-all"><Mail size={16}/></button>
                              <button onClick={() => handleWhatsApp(ex)} className="p-2 text-slate-400 hover:text-emerald-600 transition-all"><MessageCircle size={16}/></button>
                              <button onClick={() => handleDelete(ex._id)} className="p-2 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {examiners.length === 0 && (
                        <tr>
                          <td colSpan="7" className="px-6 py-8 text-center text-xs font-bold text-slate-500">
                            No vouchers generated yet.
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
              <div className="flex justify-between items-end mb-8">
                <div><h2 className="text-2xl font-black text-pict-text uppercase tracking-tight">Report Review</h2><p className="text-slate-500 text-sm font-medium italic mt-1">Department-wise records from actual canteen orders.</p></div>
                <div className="flex gap-3">
                  <button onClick={handleGenerateReport} className="flex items-center gap-2 px-6 py-3 border border-pict-blue text-pict-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">Generate</button>
                  <button onClick={handleDownloadReport} className="flex items-center gap-2 px-6 py-3 bg-pict-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl"><Download size={16} /> Export PDF</button>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Start Date</label><input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">End Date</label><input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Department</label><div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-black text-pict-blue">{deptCode}</div></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Type</label><select value={reportFilters.examinerType} onChange={(e) => setReportFilters({...reportFilters, examinerType: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold"><option>Both (Internal & External)</option><option>Internal</option><option>External</option></select></div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-12 max-w-5xl mx-auto overflow-hidden print:shadow-none print:border-none">
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                  <h1 className="text-xl font-black text-slate-900 uppercase">SCTR'S PUNE INSTITUTE OF COMPUTER TECHNOLOGY</h1>
                  <h2 className="text-sm font-bold text-slate-600">Office of the Mess & Canteen Section</h2>
                </div>
                <h3 className="text-center font-black underline mb-6">DEPARTMENT-WISE BILLING REPORT</h3>
                <div className="flex justify-between text-sm font-bold mb-8">
                  <div className="text-left space-y-1"><p>Ref No: PICT/CNTN/2026/042</p><p>Department: {deptCode}</p></div>
                  <div className="text-right"><p>Period: {formatDateForDisplay(reportFilters.startDate)} to {formatDateForDisplay(reportFilters.endDate)}</p></div>
                </div>
                <div className="bg-slate-100 p-2 font-black text-sm border border-slate-900 mb-2 text-left uppercase">SECTION A: FACULTY CONSUMPTION</div>
                <table className="w-full border-collapse border border-slate-900 mb-2 text-xs">
                  <thead className="bg-slate-50"><tr><th className="border border-slate-900 p-2 text-center">Sr</th><th className="border border-slate-900 p-2">Order ID</th><th className="border border-slate-900 p-2">Faculty Name</th><th className="border border-slate-900 p-2">Date</th><th className="border border-slate-900 p-2">Time</th><th className="border border-slate-900 p-2">Items Consumed</th><th className="border border-slate-900 p-2 text-right">Total (Rs)</th></tr></thead>
                  <tbody>{reportData.internal.length > 0 ? reportData.internal.map((o, i) => (<tr key={o.id}><td className="border border-slate-900 p-2 text-center">{i+1}</td><td className="border border-slate-900 p-2 font-mono">{o.id}</td><td className="border border-slate-900 p-2 font-bold">{o.name}</td><td className="border border-slate-900 p-2">{o.date}</td><td className="border border-slate-900 p-2">{o.time || ''}</td><td className="border border-slate-900 p-2">{o.items}</td><td className="border border-slate-900 p-2 font-black text-right">Rs. {o.amount}</td></tr>)) : (<tr><td colSpan="7" className="border border-slate-900 p-4 text-center">No Records.</td></tr>)}</tbody>
                </table>
                <div className="text-right font-black text-sm p-2 border border-slate-900 border-t-0 mb-6 uppercase">Sub-Total (Faculty): Rs. {reportData.internalTotal}/-</div>
                <div className="bg-slate-100 p-2 font-black text-sm border border-slate-900 mb-2 text-left uppercase">SECTION B: GUEST/EXTERNAL CONSUMPTION</div>
                <table className="w-full border-collapse border border-slate-900 mb-2 text-xs">
                  <thead className="bg-slate-50"><tr><th className="border border-slate-900 p-2 text-center">Sr</th><th className="border border-slate-900 p-2">Order ID</th><th className="border border-slate-900 p-2">Guest Name</th><th className="border border-slate-900 p-2">Date</th><th className="border border-slate-900 p-2">Time</th><th className="border border-slate-900 p-2">Items Consumed</th><th className="border border-slate-900 p-2 text-right">Total (Rs)</th></tr></thead>
                  <tbody>{reportData.external.length > 0 ? reportData.external.map((o, i) => (<tr key={o.id}><td className="border border-slate-900 p-2 text-center">{i+1}</td><td className="border border-slate-900 p-2 font-mono">{o.id}</td><td className="border border-slate-900 p-2 font-bold">{o.name}</td><td className="border border-slate-900 p-2">{o.date}</td><td className="border border-slate-900 p-2">{o.time || ''}</td><td className="border border-slate-900 p-2">{o.items}</td><td className="border border-slate-900 p-2 font-black text-right">Rs. {o.amount}</td></tr>)) : (<tr><td colSpan="7" className="border border-slate-900 p-4 text-center">No Records.</td></tr>)}</tbody>
                </table>
                <div className="text-right font-black text-sm p-2 border border-slate-900 border-t-0 mb-6 uppercase">Sub-Total (Guest): Rs. {reportData.externalTotal}/-</div>
                <div className="flex justify-between items-center border-2 border-slate-900 p-4 font-black text-lg"><span>GRAND TOTAL</span><span>Rs. {reportData.grandTotal}</span></div>
                <div className="flex justify-between mt-16 px-10">
                  <div className="text-center"><div className="w-32 border-t border-slate-900 mb-1 mx-auto"></div><p className="text-[10px] font-black uppercase">MESS MANAGER</p><p className="text-[9px] text-slate-400">Sign & Seal</p></div>
                  <div className="text-center"><div className="w-32 border-t border-slate-900 mb-1 mx-auto"></div><p className="text-[10px] font-black uppercase">HEAD OF DEPARTMENT</p><p className="text-[9px] text-slate-400">Dept. of {deptCode}</p></div>
                </div>
                <div className="mt-10 pt-4 border-t border-slate-200 text-[8px] text-center text-slate-400 font-bold uppercase tracking-tighter">THIS IS A SYSTEM-GENERATED STATEMENT FOR INTERNAL ACCOUNTING AND AUDIT PURPOSES.</div>
              </div>
            </div>
          )}

          {activeTab === 'external-vouchers' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl font-black text-pict-text uppercase tracking-tight">External Vouchers</h2>
                  <p className="text-slate-500 text-sm font-medium italic mt-1">Guest vouchers generated by faculty for {deptCode} department.</p>
                </div>
                <button onClick={loadExternalVouchers} className="flex items-center gap-2 px-6 py-3 border border-pict-blue text-pict-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-sm">
                  Refresh
                </button>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[920px]">
                    <thead>
                      <tr className="border-b bg-white text-[10px] font-black text-slate-400 uppercase">
                        <th className="px-6 py-5">Guest Name</th>
                        <th className="px-6">Guest Voucher</th>
                        <th className="px-6">Faculty Name</th>
                        <th className="px-6">Faculty Voucher</th>
                        <th className="px-6">Phone</th>
                        <th className="px-6 text-center">Valid From</th>
                        <th className="px-6 text-center">Valid To</th>
                        <th className="px-6 text-center">Created On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {externalVouchers.map((voucher) => (
                        <tr key={voucher._id} className="hover:bg-slate-50 transition-all">
                          <td className="px-6 py-5"><p className="font-bold text-sm text-pict-text">{voucher.name}</p></td>
                          <td className="px-6 font-mono font-black text-xs text-emerald-700 uppercase"><Hash size={12} className="inline mr-1" />{voucher.code}</td>
                          <td className="px-6 text-xs font-bold text-slate-700">{voucher.createdByName || 'N/A'}</td>
                          <td className="px-6 font-mono text-xs font-black text-pict-blue uppercase"><Hash size={12} className="inline mr-1" />{voucher.createdByVoucherCode || 'N/A'}</td>
                          <td className="px-6 text-xs font-bold text-slate-600">{voucher.phone || 'N/A'}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{voucher.fromDate}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{voucher.toDate}</td>
                          <td className="px-6 text-center text-xs font-bold text-slate-600">{voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                      {externalVouchers.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-xs font-bold text-slate-500">
                            No external vouchers generated yet.
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