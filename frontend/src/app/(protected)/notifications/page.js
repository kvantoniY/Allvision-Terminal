import Card from '@/shared/ui/Card/Card';

export default function NotificationsPage() {
  return (
    <Card>
      <h1 style={{ margin: 0, fontSize: 22 }}>Уведомления</h1>
      <p style={{ color: 'var(--muted)' }}>
        Заготовка. Следующий шаг: GET /notifications?limit&offset + mark read.
      </p>
    </Card>
  );
}
