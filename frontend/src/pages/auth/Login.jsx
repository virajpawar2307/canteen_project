import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, User, Lock, ShieldCheck, CheckCircle, Eye, EyeOff } from 'lucide-react';
import LogoImg from '../../assets/image.png';
import { loginStaff, loginWithVoucher } from '../../services/authService';
import { clearAuthSession } from '../../utils/auth';

const Login = () => {
  const [loginType, setLoginType] = useState('voucher');
  const [voucherCode, setVoucherCode] = useState('');
  const [staffCredentials, setStaffCredentials] = useState({ username: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleVoucherLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Voucher code is required.');
      setIsLoading(false);
      return;
    }

    try {
      const data = await loginWithVoucher({ voucherCode: code });
      clearAuthSession();
      localStorage.setItem('canteen_voucher_token', data.token);
      localStorage.setItem('canteen_voucher_session', JSON.stringify(data.voucher));
      navigate(data.redirectPath || '/examiner');
    } catch (error) {
      const message = error?.response?.data?.message || 'Voucher validation failed.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const data = await loginStaff(staffCredentials);
      clearAuthSession();
      localStorage.setItem('canteen_auth_token', data.token);
      localStorage.setItem('canteen_auth_user', JSON.stringify(data.user));
      navigate(data.redirectPath || '/');
    } catch (error) {
      const message = error?.response?.data?.message || 'Login failed. Please check your credentials.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabSwitch = (nextType) => {
    setLoginType(nextType);
    setErrorMessage('');
    setShowPassword(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden px-4 py-8 sm:px-6 md:py-10 lg:py-12 flex items-center justify-center">
      <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-pict-blue/8 blur-3xl" />
      <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-pict-blue/10 blur-3xl" />

      <div className="relative w-full max-w-5xl rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_30px_80px_rgba(45,62,139,0.14)] overflow-hidden grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden lg:flex bg-pict-blue p-10 xl:p-12 flex-col justify-between relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_55%)]" />
          <div className="relative">
            <div className="bg-white/95 p-3 rounded-xl inline-flex items-center shadow-lg mb-10">
              <img src={LogoImg} className="h-10 w-auto" alt="PICT" />
            </div>

            <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight tracking-tight">
              Canteen Management
              <br />
              Smart Platform
            </h1>
            <p className="text-blue-100/80 text-sm mt-5 max-w-sm leading-relaxed font-medium">
              Secure access portal for hospitality operations, voucher control, and examination support workflows.
            </p>

            <div className="mt-10 space-y-4">
              {['Faculty Hospitality', 'Real-time Reporting', 'Secure Vouchers'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-white/90 text-xs font-semibold uppercase tracking-wider">
                  <CheckCircle size={14} className="text-blue-200" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative pt-6 border-t border-white/15">
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-[0.2em]">SCTR's PICT Pune • 2026</p>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 md:p-10 lg:p-12 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <img src={LogoImg} className="h-11 w-auto" alt="PICT" />
              </div>
            </div>

            <div className="mb-7 text-center lg:text-left">
              <h2 className="text-2xl md:text-[28px] font-black text-pict-text leading-tight">Welcome Back</h2>
              <p className="text-slate-500 text-sm mt-1.5 font-medium">Sign in to continue to your dashboard.</p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
              <button
                onClick={() => handleTabSwitch('voucher')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${loginType === 'voucher' ? 'bg-white text-pict-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Voucher Entry
              </button>
              <button
                onClick={() => handleTabSwitch('staff')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${loginType === 'staff' ? 'bg-white text-pict-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Staff Portal
              </button>
            </div>

            {errorMessage && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 animate-in fade-in duration-300">
                {errorMessage}
              </div>
            )}

            <div className="space-y-6">
              {loginType === 'voucher' ? (
                <form className="space-y-5" onSubmit={handleVoucherLogin}>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Enter Voucher Code</label>
                    <div className="group relative">
                      <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pict-blue transition-colors" size={18} />
                      <input
                        type="text"
                        required
                        value={voucherCode}
                        onChange={(e) => setVoucherCode(e.target.value)}
                        placeholder="e.g. PICT-CE-123"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-pict-blue focus:ring-2 focus:ring-pict-blue/20 outline-none text-slate-900 font-medium transition-all duration-300"
                      />
                    </div>
                  </div>

                  <button
                    disabled={isLoading}
                    type="submit"
                    className="w-full bg-pict-blue text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_12px_24px_rgba(45,62,139,0.3)] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(45,62,139,0.34)] active:translate-y-0 active:scale-[0.99] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? 'Validating Voucher...' : 'Continue to Dashboard'}
                  </button>
                </form>
              ) : (
                <form className="space-y-5" onSubmit={handleStaffLogin}>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Username</label>
                    <div className="group relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pict-blue transition-colors" size={18} />
                      <input
                        type="text"
                        required
                        value={staffCredentials.username}
                        onChange={(e) => setStaffCredentials((prev) => ({ ...prev, username: e.target.value }))}
                        placeholder="Registered username"
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-pict-blue focus:ring-2 focus:ring-pict-blue/20 outline-none text-slate-900 font-medium transition-all duration-300"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Password</label>
                    <div className="group relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-pict-blue transition-colors" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={staffCredentials.password}
                        onChange={(e) => setStaffCredentials((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-pict-blue focus:ring-2 focus:ring-pict-blue/20 outline-none text-slate-900 font-medium transition-all duration-300"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pict-blue transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    disabled={isLoading}
                    type="submit"
                    className="w-full bg-pict-blue text-white py-3.5 rounded-xl font-bold text-sm shadow-[0_12px_24px_rgba(45,62,139,0.3)] hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(45,62,139,0.34)] active:translate-y-0 active:scale-[0.99] transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-2.5">
              <ShieldCheck className="text-emerald-600" size={16} />
              <p className="text-[11px] text-slate-500 font-medium">Authorized access only. Security logs are active.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;