import React from 'react';

const DashboardLayout = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-pict-bg flex flex-col">
      {/* Top Navbar - PICT Navy Blue */}
      <nav className="bg-pict-blue h-16 flex items-center px-6 shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-sm w-8 h-8 flex items-center justify-center font-bold text-pict-blue">
            P
          </div>
          <h1 className="text-white font-bold text-lg tracking-wide uppercase">
            PICT Canteen Portal
          </h1>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-pict-text">{title}</h2>
          <div className="h-1 w-12 bg-pict-blue mt-2 rounded-full"></div>
        </header>
        
        {/* This is where the specific page content will go */}
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-pict-gray text-xs border-t border-gray-200">
        Copyright © 2026 PICT Canteen Management System
      </footer>
    </div>
  );
};

export default DashboardLayout;