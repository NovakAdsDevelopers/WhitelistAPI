import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import dotenv from 'dotenv';

import {
  fetchAllAdAccounts,
  fetchAdAccountsByIds
} from './meta/services/AdAccounts';
import {
  ajusteDiarioLimitesAlerta,
  autoDisparoAlertas
} from './meta/services/limite';
import { registrarExecucao, tempoRestanteMs } from './lib/cronTimer';
import { recalcularGastosDiarios } from './meta/services/gastoDiario';

// Configurações iniciais
dotenv.config();
const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

const TOKEN1 = process.env.TOKEN_ACCESS_META!;
const TOKEN2 = process.env.TOKEN_ACCESS_META2!;
const API_URL = `${process.env.META_MARKETING_API_URL}/me/adaccounts`;

// Tempo restante para próxima execução
app.get('/tempo-restante-sync', (req, res) => {
  const restanteMs = tempoRestanteMs();
  const minutos = Math.floor(restanteMs / 60000);
  const segundos = Math.floor((restanteMs % 60000) / 1000);
  res.json({ minutos, segundos, totalMs: restanteMs });
});

// Rota manual para sincronização geral
app.get('/sync-ads', async (req, res) => {
  try {
    console.log('🔄 Sincronização geral iniciada');
    const resToken1 = await fetchAllAdAccounts(API_URL, TOKEN1, 'BM1');
    const resToken2 = await fetchAllAdAccounts(API_URL, TOKEN2, 'BM2');
    res.status(200).json({ message: '✅ Sincronização concluída.', result: { token1: resToken1, token2: resToken2 } });
  } catch (error: any) {
    console.error('❌ Erro na sincronização:', error);
    res.status(500).json({ error: error.message || 'Erro na sincronização.' });
  }
});

// Rota para sincronização de conta individual
app.get('/sync-ads/:ad_account_id', async (req, res) => {
  const { ad_account_id } = req.params;
  if (!ad_account_id) return res.status(400).json({ error: 'ID inválido.' });

  try {
    await Promise.all([
      fetchAdAccountsByIds([ad_account_id], TOKEN1, 'BM1'),
      fetchAdAccountsByIds([ad_account_id], TOKEN2, 'BM2')
    ]);
    res.status(200).json({ message: `✅ Conta ${ad_account_id} sincronizada.` });
  } catch (error: any) {
    console.error(`❌ Erro na conta ${ad_account_id}:`, error);
    res.status(500).json({ error: error.message || 'Erro na sincronização.' });
  }
});

// Rota para sincronizar múltiplas contas
app.post('/sync-ads-by-ids', async (req, res) => {
  const { account_ids } = req.body;
  if (!Array.isArray(account_ids) || !account_ids.length) {
    return res.status(400).json({ error: 'IDs inválidos.' });
  }

  const cleanIds = account_ids.map((id: string) => id.replace(/^act_/, ''));

  try {
    await Promise.all([
      fetchAdAccountsByIds(cleanIds, TOKEN1, 'BM1'),
      fetchAdAccountsByIds(cleanIds, TOKEN2, 'BM2')
    ]);
    res.status(200).json({ message: '✅ Contas sincronizadas.', synchronized_accounts: cleanIds });
  } catch (error: any) {
    console.error('❌ Erro ao sincronizar contas:', error);
    res.status(500).json({ error: error.message || 'Erro na sincronização.' });
  }
});

// CRON: Sincronização de contas a cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log('🔄 CRON: Sincronizando contas de 30 em 30 minutos...');
    await Promise.all([
      fetchAllAdAccounts(API_URL, TOKEN1, 'BM1'),
      fetchAllAdAccounts(API_URL, TOKEN2, 'BM2')
    ]);
    registrarExecucao();
  } catch (error) {
    console.error('❌ CRON erro ao sincronizar contas:', error);
  }
});

// CRON: Ajuste de alertas a cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
  try {
    console.log('⚠️ CRON: Disparando alertas automáticos...');
    await autoDisparoAlertas();
  } catch (error) {
    console.error('❌ CRON erro ao disparar alertas:', error);
  }
});

// CRON: Tarefa às 9h para ajustes diários
cron.schedule('0 9 * * *', async () => {
  console.log('☀️ CRON: Ajuste de limites diários...');
  try {
    await Promise.all([
      ajusteDiarioLimitesAlerta(TOKEN1, 'BM1'),
      ajusteDiarioLimitesAlerta(TOKEN2, 'BM2')
    ]);
  } catch (error) {
    console.error('❌ CRON erro no ajuste de limites:', error);
  }
});

// CRON: Recalcular gastos diariamente às 0h
cron.schedule('0 0 * * *', async () => {
  try {
    if (TOKEN1 && TOKEN2) {
      await recalcularGastosDiarios(TOKEN1, TOKEN2);
      console.log('📊 CRON: Recalculo de gastos concluído.');
    }
  } catch (error) {
    console.error('❌ CRON erro ao recalcular gastos:', error);
  }
});

// Inicialização da API
(async () => {
  console.log('🚀 Meta API Scheduler iniciada');
  registrarExecucao();
})();

export { app as metaSync };