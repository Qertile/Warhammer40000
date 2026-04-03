import type { Metadata } from "next";
import { Cinzel, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  weight: ["400", "700"],
  subsets: ["latin"], // Note: Noto Serif TC uses different subsets sometimes or doesn't specify, latin is safe for the wrapper.
});

export const metadata: Metadata = {
  title: "戰鎚40K：史詩紀元",
  description: "沉浸式圖文閱讀體驗",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${cinzel.variable} ${notoSerifTC.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
