import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import Header from "@/components/Header";
import ServiceWorker from "@/components/ServiceWorker";
import { ThemeProvider } from "@/components/ThemeProvider";
import Footer from "@/components/Footer";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "EDUorbit — GATE preparation, in orbit",
  description: "A focused workspace for GATE CSE previous-year papers.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml", sizes: "512x512" }
    ],
    apple: "/icons/icon-192.svg"
  }
};

export const viewport = { themeColor: "#090b12" };

export default async function RootLayout({ children }) {
  const session = await getCurrentUser();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("eduorbit-theme");if(["dark","light","aurora"].includes(t))document.documentElement.dataset.theme=t}catch(e){}` }} /><ThemeProvider><ServiceWorker /><Header session={session} /><main className="min-h-screen">{children}</main><Footer /></ThemeProvider></body>
    </html>
  );
}
