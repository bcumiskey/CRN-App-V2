export const metadata = {
  title: "CRN API",
  description: "Clean Right Now V2 API",
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
