import React from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'Genius Consultancy — Internal Recruitment Operations CRM',
  description: 'Internal Operations & Telecalling Platform for Genius Consultancy',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans">
        <AuthProvider>
          <div className="flex-1 flex flex-col min-h-screen">
            <Navbar />
            <div className="flex-1 flex overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-6 bg-slate-50">{children}</main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
