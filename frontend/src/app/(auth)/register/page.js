'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/shared/ui/Card/Card';
import Input from '@/shared/ui/Input/Input';
import Button from '@/shared/ui/Button/Button';
import Link from 'next/link';
import { useRegisterMutation } from '@/shared/lib/api/authApi';
import { setToken } from '@/shared/lib/auth/authCookie';
import { useDispatch } from 'react-redux';
import { setAuth } from '@/shared/lib/auth/authSlice';
import styles from './page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [register, { isLoading }] = useRegisterMutation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await register({ username, password }).unwrap();
      setToken(res.token);
      dispatch(setAuth({ token: res.token, user: res.user }));
      router.replace('/feed');
    } catch (err) {
      setError(err?.data?.message || 'Ошибка регистрации');
    }
  };

  return (
    <Card className={styles.card}>
      <h1 className={styles.title}>Регистрация</h1>
      <form className={styles.form} onSubmit={onSubmit}>
        <Input
          label="Логин"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Имя пользователя"
          autoComplete="Имя пользователя"
        />
        <Input
          label="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          type="password"
          autoComplete="new-password"
        />

        {error ? <div className={styles.error}>{error}</div> : null}

        <Button type="submit" disabled={isLoading}>
          Создать аккаунт
        </Button>

        <div className={styles.hint}>
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </div>
      </form>
    </Card>
  );
}
