import { Router } from 'express';
import { authRequired } from '../../middlewares/auth.js';
import {
  equityChart,
  profitChart,
  stakeDeviationChart,
  winrateChart,
  drawdownChart
} from './charts.controller.js';

export const chartsRouter = Router();
chartsRouter.use(authRequired);

chartsRouter.get('/equity', equityChart);           // рост/падение банка
chartsRouter.get('/profit', profitChart);           // прибыль/убыток
chartsRouter.get('/stake-deviation', stakeDeviationChart); // отклонение stake от recommended
chartsRouter.get('/winrate', winrateChart);         // винрейт по времени (bucket) или rolling
chartsRouter.get('/drawdown', drawdownChart);
