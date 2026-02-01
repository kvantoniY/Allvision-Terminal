'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './settings.module.css';

import Card from '@/shared/ui/Card/Card';
import Button from '@/shared/ui/Button/Button';
import Input from '@/shared/ui/Input/Input';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Avatar from '@/shared/ui/Avatar/Avatar';

import { useMeQuery } from '@/shared/lib/api/authApi';
import { useUpdateMyProfileMutation, useUploadMyAvatarMutation } from '@/shared/lib/api/userApi';

export default function SettingsPage() {
  const { data: meData } = useMeQuery();
  const me = useMemo(() => meData?.user || meData || null, [meData]);

  const [bio, setBio] = useState('');
  const [updateProfile, updateState] = useUpdateMyProfileMutation();
  const [uploadAvatar, uploadState] = useUploadMyAvatarMutation();

  useEffect(() => {
    setBio(me?.bio || '');
  }, [me?.bio]);

  const busy = updateState.isLoading || uploadState.isLoading;

  const onSaveBio = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({ bio }).unwrap();
    } catch (_) {}
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAvatar(file).unwrap();
      e.target.value = '';
    } catch (_) {}
  };

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <h1 className={styles.h1}>Настройки профиля</h1>

        <div className={styles.row}>
          <div className={styles.avatarBlock}>
            <Avatar size={72} user={me} src={me?.avatarUrl || null} />
            <label className={styles.avatarBtn}>
              <input
                className={styles.file}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onPickAvatar}
                disabled={busy}
              />
              {uploadState.isLoading ? <Spinner size={14} /> : null}
              Сменить аватар
            </label>
          </div>

          <form className={styles.form} onSubmit={onSaveBio}>
            <div className={styles.label}>Описание</div>
            <Input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Напиши пару слов о себе"
              disabled={busy}
            />

            <div className={styles.actions}>
              <Button type="submit" disabled={busy}>
                {updateState.isLoading ? <Spinner size={16} /> : null}
                Сохранить
              </Button>
            </div>
          </form>
        </div>

        {updateState.isError ? <div className={styles.err}>Не удалось сохранить</div> : null}
        {uploadState.isError ? <div className={styles.err}>Не удалось загрузить аватар</div> : null}
      </Card>
    </div>
  );
}
