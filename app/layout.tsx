import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DocsBridge Crawler Service',
  description: 'Government document crawler service for DocsBridge',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
