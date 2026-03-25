export const metadata = {
  title: 'TyScore — The Trust Layer for AI Agents',
  description: 'Universal trust scoring for AI agent-to-agent interactions. The Moody\'s of AI Agents. Free, open, A2A-compatible.',
  openGraph: {
    title: 'TyScore — The Trust Layer for AI Agents',
    description: 'Universal trust scoring for AI agent-to-agent interactions.',
    url: 'https://ty-score.com',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
