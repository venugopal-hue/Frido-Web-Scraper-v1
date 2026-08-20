import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Frido Price Tracker — Self-Healing Scraper',
  description:
    'Live price and stock tracking for the Frido store, powered by a self-healing Bright Data Scraper Studio collector.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
