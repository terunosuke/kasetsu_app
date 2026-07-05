import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "アルバトロス 3D組立シミュレーター",
  description: "次世代足場の3D配置シミュレーションと数量拾い出し",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full overflow-hidden font-sans antialiased">{children}</body>
    </html>
  );
}
