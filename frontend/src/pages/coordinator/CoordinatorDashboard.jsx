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
  const [selectedVoucherCategory, setSelectedVoucherCategory] = useState('');
  const [isGeneratingVouchers, setIsGeneratingVouchers] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [isClearingVouchers, setIsClearingVouchers] = useState(false);
  const [deletingVoucherId, setDeletingVoucherId] = useState('');
  const [isRefreshingExternalVouchers, setIsRefreshingExternalVouchers] = useState(false);
  const [isClearingExternalVouchers, setIsClearingExternalVouchers] = useState(false);
  const [deletingExternalVoucherId, setDeletingExternalVoucherId] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  // 2. Manual Entry State
  const [manualEntry, setManualEntry] = useState({ 
    name: '', email: '', phone: '', fromDate: '', toDate: '' 
  });

  // 3. Report Filter States
  const [reportFilters, setReportFilters] = useState({
    startDate: getTodayLocalDate(),
    endDate: getTodayLocalDate(),
    department: 'CE',
    category: 'All Categories',
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
    setIsRefreshingExternalVouchers(true);
    try {
      const response = await getCoordinatorExternalVouchers();
      setExternalVouchers(response.externalVouchers || []);
    } catch {
      alert('Failed to load external vouchers. Please try again.');
    } finally {
      setIsRefreshingExternalVouchers(false);
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
      setDeletingVoucherId(idToRemove);
      try {
        await deleteCoordinatorVoucher(idToRemove);
        setExaminers((prev) => prev.filter((exam) => exam._id !== idToRemove));
      } catch (error) {
        alert(error?.response?.data?.message || 'Failed to delete voucher from database.');
      } finally {
        setDeletingVoucherId('');
      }
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to delete ALL generated vouchers? This cannot be undone.")) {
      setIsClearingVouchers(true);
      try {
        await clearCoordinatorVouchers();
        await loadCoordinatorData();
      } catch (error) {
        alert(error?.response?.data?.message || 'Failed to clear vouchers from database.');
      } finally {
        setIsClearingVouchers(false);
      }
    }
  };

  const handleDeleteExternalVoucher = async (voucherId) => {
    if (!window.confirm('Delete this external voucher?')) return;

    setDeletingExternalVoucherId(voucherId);
    try {
      await deleteCoordinatorExternalVoucher(voucherId);
      setExternalVouchers((prev) => prev.filter((voucher) => voucher._id !== voucherId));
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to delete external voucher.');
    } finally {
      setDeletingExternalVoucherId('');
    }
  };

  const handleClearAllExternalVouchers = async () => {
    if (!window.confirm('Delete ALL external vouchers for your department? This cannot be undone.')) return;

    setIsClearingExternalVouchers(true);
    try {
      await clearCoordinatorExternalVouchers();
      setExternalVouchers([]);
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to clear external vouchers.');
    } finally {
      setIsClearingExternalVouchers(false);
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

    setIsGeneratingVouchers(true);
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
        setIsGeneratingVouchers(false);
        return;
      }

      try {
        const response = await bulkCreateCoordinatorVouchers(newEntries);
        setExaminers(response.vouchers || []);
        setSelectedVoucherCategory((currentCategory) => currentCategory || selectedCategory);
        setExcelFile(null);
        const createdCount = Number(response?.createdCount || 0);
        const updatedCount = Number(response?.updatedCount || 0);
        const skippedCount = Number(response?.skippedCount || 0);

        alert(
          `Voucher sync completed. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}.`
        );
      } catch (error) {
        const message = error?.response?.data?.message || 'Bulk upload failed. Please verify sheet format.';
        alert(message);
      } finally {
        setIsGeneratingVouchers(false);
      }
    };
    reader.onerror = () => {
      setIsGeneratingVouchers(false);
      alert('Failed to read the selected file. Please try again.');
    };
    reader.readAsBinaryString(excelFile);
  };

  const handleAddManual = async () => {
    if (!manualEntry.name || !manualEntry.email || !manualEntry.phone || !manualEntry.fromDate || !manualEntry.toDate) {
      alert("Please fill all fields.");
      return;
    }
    setIsAddingEntry(true);
    try {
      const created = await createCoordinatorVoucher(manualEntry);
      setExaminers((prev) => {
        const exists = prev.some((voucher) => voucher._id === created._id);
        if (exists) {
          return prev.map((voucher) => (voucher._id === created._id ? created : voucher));
        }
        return [created, ...prev];
      });
      setManualEntry({ name: '', email: '', phone: '', fromDate: '', toDate: '' });
    } catch (error) {
      alert(error?.response?.data?.message || 'Failed to add entry.');
    } finally {
      setIsAddingEntry(false);
    }
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

  const normalizeCategoryLabel = (categoryText) => String(categoryText || '').trim();
  const discoveredVoucherCategories = [...new Set(examiners.map((exam) => normalizeCategoryLabel(exam.category)).filter(Boolean))];
  const baseCategoryOptions = EXAM_CATEGORY_OPTIONS.filter((option) => option !== OTHER_CATEGORY_VALUE);
  const dynamicCustomCategories = discoveredVoucherCategories.filter((category) => !baseCategoryOptions.includes(category));
  const uploadCategoryOptions = [...baseCategoryOptions, ...dynamicCustomCategories, OTHER_CATEGORY_VALUE];
  const reportCategoryOptions = ['All Categories', ...new Set([...baseCategoryOptions, ...dynamicCustomCategories])];

  const vouchersInSelectedCategory = selectedVoucherCategory
    ? examiners.filter((exam) => normalizeCategoryLabel(exam.category) === selectedVoucherCategory)
    : [];

  const normalizedVoucherSearch = voucherSearch.trim().toLowerCase();
  const filteredExaminers = vouchersInSelectedCategory.filter((exam) => {
    if (!normalizedVoucherSearch) return true;

    return [exam.name, exam.code, exam.phone, exam.fromDate, exam.toDate, exam.category]
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

  useEffect(() => {
    if (selectedVoucherCategory && !discoveredVoucherCategories.includes(selectedVoucherCategory)) {
      setSelectedVoucherCategory('');
    }
  }, [discoveredVoucherCategories, selectedVoucherCategory]);

  const handleGenerateReport = async () => {
    if (!reportFilters.startDate || !reportFilters.endDate) {
      alert('Please choose start and end date.');
      return;
    }

    setIsGeneratingReport(true);
    try {
      const data = await getCoordinatorReportData({
        startDate: reportFilters.startDate,
        endDate: reportFilters.endDate,
        category: reportFilters.category,
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
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!reportFilters.startDate || !reportFilters.endDate) {
      alert('Please choose start and end date.');
      return;
    }

    setIsExportingReport(true);
    let latest = reportData;
    try {
      const data = await getCoordinatorReportData({
        startDate: reportFilters.startDate,
        endDate: reportFilters.endDate,
        category: reportFilters.category,
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
      setIsExportingReport(false);
      return;
    }

    const { internal, external, internalTotal, externalTotal, grandTotal } = latest;
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
          <title>Coordinator_Billing_Report</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.35; margin: 0; }
            .sheet { position: relative; border: 1px solid #2f2f2f; padding: 14px; min-height: calc(297mm - 20mm); box-sizing: border-box; overflow: hidden; }
            .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
            .watermark img { width: 390px; opacity: 0.07; }
            .content { position: relative; z-index: 2; min-height: 100%; display: flex; flex-direction: column; }
            .header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
            .logo { width: 52px; height: 52px; object-fit: contain; }
            .inst h1 { font-size: 20px; margin: 0; font-weight: 800; letter-spacing: 0.1px; }
            .inst p { font-size: 12px; margin: 2px 0 0; font-weight: 600; }
            .title { border: 2px solid #1f1f1f; text-align: center; font-size: 13px; font-weight: 800; padding: 5px 8px; margin: 8px auto 12px; width: 60%; }
            .meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-weight: 700; font-size: 11px; }
            .dept-line { margin: 0 0 10px; font-weight: 700; font-size: 11px; }
            .section { margin-top: 10px; }
            .section-head { background: #2a2a2a; color: #fff; font-weight: 800; padding: 5px 7px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.25px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #565656; padding: 6px 6px; vertical-align: top; }
            th { background: #3c3c3c; color: #fff; font-size: 10px; font-weight: 800; }
            td { font-size: 10px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .date-cell { white-space: nowrap; }
            .name-cell small { font-size: 8px; color: #4b5563; }
            .subject-cell { word-break: break-word; }
            .items-cell { word-break: break-word; }
            .subtotal { text-align: right; font-size: 14px; font-weight: 800; margin: 6px 0 12px; }
            .grand-wrap { display: flex; justify-content: flex-end; margin: 6px 0 0; }
            .grand-box { border: 2px solid #222; min-width: 220px; display: flex; justify-content: space-between; padding: 6px 10px; font-weight: 800; font-size: 15px; }
            .signatures { margin-top: auto; }
            .sign-grid-3 { margin-top: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
            .sign-grid-2 { margin-top: 18px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 46px; max-width: 70%; margin-left: auto; margin-right: auto; }
            .sign { text-align: center; }
            .sign-line { border-top: 2px solid #4a4a4a; margin-bottom: 5px; }
            .sign label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2px; }
            .footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #8a8a8a; text-align: center; font-size: 8px; font-weight: 700; text-transform: uppercase; }
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
                <div>Ref No: PICT/CNTN/2026/042/01/ALL-01</div>
                <div>Date: ${formatDateForDisplay(reportFilters.startDate)} to ${formatDateForDisplay(reportFilters.endDate)}</div>
              </div>
              <p class="dept-line">Category: ${reportFilters.category || 'All Categories'} | Department: ${deptCode}</p>

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
                    ${internal.length > 0 ? internal.map((o, i) => `<tr><td class="text-center">${i + 1}</td><td class="date-cell">${formatDateForDisplay(o.date)}<br/>${o.time || ''}</td><td class="name-cell">${o.name}<br/><small>ID: ${o.id}</small></td><td class="subject-cell">${o.subjectName || 'N/A'}</td><td class="items-cell">${o.items}</td><td class="text-right">Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="6" class="text-center">No Records</td></tr>'}
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
                    ${external.length > 0 ? external.map((o, i) => `<tr><td class="text-center">${i + 1}</td><td class="date-cell">${formatDateForDisplay(o.date)}<br/>${o.time || ''}</td><td class="name-cell">${o.name}<br/><small>ID: ${o.id}</small></td><td class="subject-cell">${o.subjectName || 'N/A'}</td><td class="items-cell">${o.items}</td><td class="text-right">Rs. ${o.amount}</td></tr>`).join('') : '<tr><td colspan="6" class="text-center">No Records</td></tr>'}
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
      setIsExportingReport(false);
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

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-[linear-gradient(180deg,_#2D3E8B_0%,_#1F2B66_100%)] text-white flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 shadow-[18px_0_60px_rgba(18,28,74,0.22)] backdrop-blur-xl border-r border-white/10 overflow-hidden`}>
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
                        {uploadCategoryOptions.map((option) => (
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
                  <button disabled={isGeneratingVouchers} onClick={handleExcelUpload} className="w-full bg-[linear-gradient(135deg,_#2D3E8B_0%,_#4157B3_100%)] text-white py-4.5 rounded-3xl font-black text-xs uppercase shadow-[0_18px_40px_rgba(45,62,139,0.25)] transition-transform active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed">{isGeneratingVouchers ? 'Generating...' : 'Generate Vouchers'}</button>
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
                    <button disabled={isAddingEntry} onClick={handleAddManual} className="w-full border-2 border-pict-blue text-pict-blue py-3.5 rounded-2xl font-black text-[10px] uppercase transition-all hover:bg-pict-blue hover:text-white shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">{isAddingEntry ? 'Adding...' : 'Add Entry'}</button>
                  </div>
                </div>
              </div>

              <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[linear-gradient(180deg,_rgba(248,250,255,0.96),_rgba(255,255,255,0.96))]">
                  <h3 className="text-xs font-black text-pict-text uppercase tracking-widest">Generated Vouchers</h3>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={handleDownloadExcel} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-pict-blue uppercase shadow-sm transition-all hover:shadow-md"><Download size={14} /> Download</button>
                    <button disabled={isClearingVouchers} onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 border border-red-100 rounded-2xl text-[10px] font-black uppercase shadow-sm transition-all hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"><Eraser size={14} /> {isClearingVouchers ? 'Clearing...' : 'Clear Vouchers'}</button>
                  </div>
                </div>
                <div className="px-8 py-5 border-b border-slate-100 bg-white/80 flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
                  <div className="w-full md:max-w-sm">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <select
                      value={selectedVoucherCategory}
                      onChange={(e) => setSelectedVoucherCategory(e.target.value)}
                      className="mt-1.5 w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue shadow-sm"
                    >
                      <option value="">Select category to view vouchers</option>
                      {discoveredVoucherCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full md:max-w-md">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={voucherSearch}
                      onChange={(e) => setVoucherSearch(e.target.value)}
                      placeholder="Search by name, code, phone..."
                      disabled={!selectedVoucherCategory}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                        <th className="px-6">Category</th>
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
                          <td className="px-6 text-xs font-bold text-slate-600">{normalizeCategoryLabel(ex.category) || 'Uncategorized'}</td>
                          <td className="px-6 text-center"><span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${getVoucherStatus(ex.fromDate, ex.toDate) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{getVoucherStatus(ex.fromDate, ex.toDate)}</span></td>
                          <td className="px-6">
                            <div className="flex justify-center gap-2">
                              <button disabled={deletingVoucherId === ex._id} onClick={() => handleDelete(ex._id)} className="p-2 text-red-500 hover:text-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Delete voucher"><Trash2 size={16} /></button>
                              <button onClick={() => handleEmail(ex)} className="p-2 text-slate-400 hover:text-pict-blue transition-all"><Mail size={16}/></button>
                              <button onClick={() => handleWhatsApp(ex)} className="p-2 text-slate-400 hover:text-emerald-600 transition-all"><MessageCircle size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredExaminers.length === 0 && (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-xs font-bold text-slate-500">
                            {!selectedVoucherCategory
                              ? 'Select a category to view vouchers.'
                              : (voucherSearch.trim() ? 'No matching vouchers found for selected category.' : 'No vouchers found for selected category.')}
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
                  <button disabled={isGeneratingReport} onClick={handleGenerateReport} className="flex items-center gap-2 px-6 py-3 border border-pict-blue text-pict-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">{isGeneratingReport ? 'Generating...' : 'Generate'}</button>
                  <button disabled={isExportingReport} onClick={handleDownloadReport} className="flex items-center gap-2 px-6 py-3 bg-pict-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"><Download size={16} /> {isExportingReport ? 'Exporting...' : 'Export PDF'}</button>
                </div>
              </div>

              <div className="rounded-4xl border border-white/70 bg-white/90 backdrop-blur-xl shadow-[0_18px_50px_rgba(45,62,139,0.08)] p-4 sm:p-6 lg:p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 text-left">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Start Date</label><input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">End Date</label><input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue" /></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase">Category</label><select value={reportFilters.category} onChange={(e) => setReportFilters({...reportFilters, category: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-pict-blue">{reportCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
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
                  <div className="text-left space-y-1"><p>Ref No: PICT/CNTN/2026/042</p><p>Category: {reportFilters.category || 'All Categories'}</p><p>Department: {deptCode}</p></div>
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
                  <button disabled={isRefreshingExternalVouchers} onClick={loadExternalVouchers} className="flex items-center gap-2 px-6 py-3 border border-pict-blue text-pict-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                    {isRefreshingExternalVouchers ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button disabled={isClearingExternalVouchers} onClick={handleClearAllExternalVouchers} className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-500 border border-red-100 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
                    <Eraser size={14} /> {isClearingExternalVouchers ? 'Clearing...' : 'Clear Vouchers'}
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
                              disabled={deletingExternalVoucherId === voucher._id}
                              onClick={() => handleDeleteExternalVoucher(voucher._id)}
                              className="p-2 text-red-500 hover:text-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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