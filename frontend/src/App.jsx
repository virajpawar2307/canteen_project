import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CanteenDashboard from './pages/canteen/CanteenDashboard';
// Page Imports - Ensure these match your actual folder capitalization!
import Login from './pages/auth/Login'; 
import CoordinatorDashboard from './pages/coordinator/CoordinatorDashboard';
import ExaminerDashboard from './pages/examiner/ExaminerDashboard';
import ExternalExaminerDashboard from './pages/examiner/ExternalExaminerDashboard';

const safeParse = (value) => {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
};

const getStaffSession = () => {
  const token = localStorage.getItem('canteen_auth_token');
  const user = safeParse(localStorage.getItem('canteen_auth_user'));
  return { token, user };
};

const getVoucherSession = () => {
  const token = localStorage.getItem('canteen_voucher_token');
  const voucher = safeParse(localStorage.getItem('canteen_voucher_session'));
  return { token, voucher };
};

const getStaffRedirectByRole = (role) => {
  if (role === 'canteen_manager') return '/canteen';
  if (role === 'coordinator') return '/coordinator';
  return '/';
};

const HomeRoute = () => {
  const { token: staffToken, user } = getStaffSession();
  const { token: voucherToken, voucher } = getVoucherSession();

  if (staffToken && user?.role) {
    return <Navigate to={getStaffRedirectByRole(user.role)} replace />;
  }

  if (voucherToken && voucher?.type) {
    return <Navigate to={voucher.type === 'External' ? '/external' : '/examiner'} replace />;
  }

  return <Login />;
};

const StaffProtectedRoute = ({ allowedRoles, children }) => {
  const { token, user } = getStaffSession();
  if (!token || !user?.role) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getStaffRedirectByRole(user.role)} replace />;
  }

  return children;
};

const VoucherProtectedRoute = ({ expectedType, children }) => {
  const { token, voucher } = getVoucherSession();
  if (!token || !voucher?.type) {
    return <Navigate to="/" replace />;
  }

  const currentType = voucher.type;
  if (expectedType && currentType !== expectedType) {
    return <Navigate to={currentType === 'External' ? '/external' : '/examiner'} replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
        <Routes>
          {/* Default Route: Login */}
          <Route path="/" element={<HomeRoute />} />

          {/* Coordinator Route */}
          <Route
            path="/coordinator"
            element={(
              <StaffProtectedRoute allowedRoles={['coordinator']}>
                <CoordinatorDashboard />
              </StaffProtectedRoute>
            )}
          />

          <Route
            path="/canteen"
            element={(
              <StaffProtectedRoute allowedRoles={['canteen_manager']}>
                <CanteenDashboard />
              </StaffProtectedRoute>
            )}
          />

          <Route
            path="/examiner"
            element={(
              <VoucherProtectedRoute expectedType="Internal">
                <ExaminerDashboard />
              </VoucherProtectedRoute>
            )}
          />

          <Route
            path="/external"
            element={(
              <VoucherProtectedRoute expectedType="External">
                <ExternalExaminerDashboard />
              </VoucherProtectedRoute>
            )}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;