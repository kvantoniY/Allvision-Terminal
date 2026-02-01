// backend/src/middlewares/error.js
export function errorMiddleware(err, req, res, next) {
  try {
    const status = err?.status || err?.statusCode || 500;

    // Безопасное логирование — не передаём в console.error "сложные" объекты целиком
    const msg = err?.message ? String(err.message) : String(err);
    const stack = err?.stack ? String(err.stack) : '';

    console.error('[ERROR]', msg);
    if (stack) console.error(stack);

    // Если хочешь видеть контекст запроса — только простые поля
    console.error('[REQ]', req.method, req.originalUrl);

    // В проде не светим stack наружу
    const payload = {
      ok: false,
      message: status === 500 ? 'Ошибка сервера' : msg,
    };

    return res.status(status).json(payload);
  } catch (logErr) {
    // На крайний случай — никогда не падаем в error middleware
    return res.status(500).json({ ok: false, message: 'Ошибка сервера' });
  }
}
