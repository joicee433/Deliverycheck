import "./globals.css";

export const metadata = {
  title: "DeliverCheck",
  description: "Check if a task was delivered, using the page it points to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
