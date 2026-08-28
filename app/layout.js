export const metadata = {
  title: "PromptWars",
  description: "Multi-Agent AI Interview Panel Simulator",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
