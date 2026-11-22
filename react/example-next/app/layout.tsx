export const metadata = { title: 'jhigu-patro-react in Next.js' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', margin: 24 }}>{children}</body>
    </html>
  );
}
