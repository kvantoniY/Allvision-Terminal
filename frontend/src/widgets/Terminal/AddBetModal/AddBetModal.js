'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/shared/ui/Modal/Modal';
import Spinner from '@/shared/ui/Spinner/Spinner';
import Button from '@/shared/ui/Button/Button';
import styles from './AddBetModal.module.css';

import { useRecommendMutation, useCreateBetMutation } from '@/shared/lib/api/terminalApi';

const games = [
  { value: 'DOTA2', label: 'Dota 2' },
  { value: 'CS2', label: 'CS 2' },
];

const betTypes = [
  { value: 'MATCH_WIN', label: 'Победа в матче' },
  { value: 'MAP_WIN', label: 'Победа на карте' },
  { value: 'HANDICAP', label: 'Фора' },
];

const bos = [1, 2, 3, 5];
const tiers = [1, 2, 3];
const risks = [1, 2, 3, 4, 5];

export default function AddBetModal({ isOpen, onClose, sessionId }) {
  const [form, setForm] = useState({
    game: 'DOTA2',
    betType: 'MATCH_WIN',
    bo: 3,
    tier: 2,
    risk: 3,
    odds: '',
    tournament: '',
    team1: '',
    team2: '',
    pickTeam: '',
    stake: '',
  });

  const [recommend, recommendState] = useRecommendMutation();
  const [createBet, createState] = useCreateBetMutation();

  const oddsNum = useMemo(() => Number(form.odds), [form.odds]);
  const canRecommend = Number.isFinite(oddsNum) && oddsNum > 1.01;

  useEffect(() => {
    if (!isOpen) return;
    // не сбрасываем форму при открытии, чтобы не терять ввод
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const t = setTimeout(async () => {
      if (!canRecommend) return;
      try {
        await recommend({
          sessionId,
          odds: oddsNum,
          bo: Number(form.bo),
          tier: Number(form.tier),
          risk: Number(form.risk),
        }).unwrap();
      } catch (_) {}
    }, 350);

    return () => clearTimeout(t);
  }, [isOpen, canRecommend, oddsNum, form.bo, form.tier, form.risk, recommend, sessionId]);

  const rec = recommendState.data || null;

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const onAutofillStake = () => {
    if (!rec?.recommendedStake) return;
    set('stake', String(Math.round(Number(rec.recommendedStake) * 100) / 100));
  };

  const onSubmit = async () => {
    const stakeNum = Number(form.stake);
    if (!Number.isFinite(oddsNum) || oddsNum <= 1.01) return;
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) return;
    if (!form.team1.trim() || !form.team2.trim()) return;

    await createBet({
      sessionId,
      game: form.game,
      betType: form.betType,
      bo: Number(form.bo),
      tier: Number(form.tier),
      risk: Number(form.risk),
      odds: oddsNum,
      tournament: form.tournament.trim(),
      team1: form.team1.trim(),
      team2: form.team2.trim(),
      pickTeam: form.pickTeam.trim() || null,
      stake: stakeNum,
    }).unwrap();

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Добавить ставку">
      <div className={styles.wrap}>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <div className={styles.label}>Игра</div>
            <select className={styles.select} value={form.game} onChange={(e) => set('game', e.target.value)}>
              {games.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Тип ставки</div>
            <select className={styles.select} value={form.betType} onChange={(e) => set('betType', e.target.value)}>
              {betTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>BO</div>
            <select className={styles.select} value={form.bo} onChange={(e) => set('bo', e.target.value)}>
              {bos.map((b) => <option key={b} value={b}>BO{b}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Tier</div>
            <select className={styles.select} value={form.tier} onChange={(e) => set('tier', e.target.value)}>
              {tiers.map((t) => <option key={t} value={t}>Tier {t}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Риск (1–5)</div>
            <select className={styles.select} value={form.risk} onChange={(e) => set('risk', e.target.value)}>
              {risks.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Коэффициент</div>
            <input
              className={styles.input}
              value={form.odds}
              onChange={(e) => set('odds', e.target.value)}
              placeholder="например 1.53"
              inputMode="decimal"
            />
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <div className={styles.label}>Турнир</div>
            <input
              className={styles.input}
              value={form.tournament}
              onChange={(e) => set('tournament', e.target.value)}
              placeholder="Название турнира"
            />
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Команда 1</div>
            <input className={styles.input} value={form.team1} onChange={(e) => set('team1', e.target.value)} placeholder="Например Team Spirit" />
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Команда 2</div>
            <input className={styles.input} value={form.team2} onChange={(e) => set('team2', e.target.value)} placeholder="Например G2" />
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <div className={styles.label}>Победитель / pickTeam (опционально)</div>
            <input className={styles.input} value={form.pickTeam} onChange={(e) => set('pickTeam', e.target.value)} placeholder="Укажи команду победителя при необходимости" />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Рекомендация {recommendState.isLoading ? <Spinner size={14} /> : null}
          </div>

          {rec ? (
            <>
              <div className={styles.recRow}>
                <div>Процент: <b>{rec.recommendedPct != null ? `${Math.round(rec.recommendedPct * 10000) / 100}%` : '—'}</b></div>
                <div>Сумма: <b>{rec.recommendedStake != null ? (Math.round(Number(rec.recommendedStake) * 100) / 100) : '—'}</b></div>
                <div>Модель: <b>{rec.stakingModel || '—'}</b></div>
              </div>
              <div className={styles.recSmall}>
                Можно подставить рекомендованную сумму в поле “Сумма ставки”.
              </div>
            </>
          ) : (
            <div className={styles.recSmall}>
              Укажи коэффициент (например 1.50+), чтобы получить рекомендацию.
            </div>
          )}

          <div className={styles.stakeRow}>
            <div className={styles.field}>
              <div className={styles.label}>Сумма ставки</div>
              <input className={styles.input} value={form.stake} onChange={(e) => set('stake', e.target.value)} placeholder="stake" inputMode="decimal" />
            </div>

            <button className={styles.btnGhost} type="button" onClick={onAutofillStake} disabled={!rec?.recommendedStake}>
              Подставить
            </button>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={onSubmit} disabled={createState.isLoading}>
            {createState.isLoading ? <Spinner size={16} /> : null}
            Добавить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
