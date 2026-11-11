import "./globals.css";

export const metadata = {
  title: "Cult Club Gallery",
  description: "Gallery",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}