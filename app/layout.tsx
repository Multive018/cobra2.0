import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Optimization: Using the single variable font file ([wght]) avoids 
// loading multiple static files, reducing fetch time and network overhead.
const geistSans = localFont({
  src: "./fonts/Geist[wght].woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

// Remove this block if you do not have the Mono font file
const geistMono = localFont({
  src: "./fonts/Geist[wght].woff2", // Ensure this file exists in your fonts folder
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}