import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gearbox — Load-Aware Reverse Proxy & Tier Engine',
  description: 'Real-time SSE load-testing dashboard and dynamic architecture topology'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
