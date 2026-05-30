import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '未闲漫步',
  description: '一个记录阅读、技术、生活观察和长期问题的中文笔记库。'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
