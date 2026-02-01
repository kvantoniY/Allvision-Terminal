import { redirect } from 'next/navigation';

export default function HomePage() {
  // Middleware will redirect based on auth.
  redirect('/feed');
}
