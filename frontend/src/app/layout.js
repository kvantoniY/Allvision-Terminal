import './globals.css';
import Providers from '@/store/providers';

export const metadata = {
  title: 'Allvision Terminal',
  description: 'Capital management terminal for esports betting',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
