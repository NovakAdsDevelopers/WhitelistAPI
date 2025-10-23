// src/getInterToken.ts
import axios from "axios";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const REQUIRED_SCOPE = "pagamento-pix.write" as const;

const ACCOUNT_HEADER_KEY = "x-conta-corrente" as const;
const ACCOUNT_HEADER_VAL = "180813390" as const;
const DESCRICAO_DEFAULT = "Pagamento via Novak" as const;

// -----------------------------------------------------------------------------
// TOKEN
// -----------------------------------------------------------------------------
type GetInterTokenOptions = {
  clientId: string;
  clientSecret: string;
  scope?: string;
  tokenUrl?: string;
  passphrase?: string;
  rejectUnauthorized?: boolean;
  certPath?: string;
  keyPath?: string;
};

export async function getInterToken({
  clientId,
  clientSecret,
  scope = REQUIRED_SCOPE,
  tokenUrl = "https://cdpj.partners.bancointer.com.br/oauth/v2/token",
  passphrase,
  rejectUnauthorized = true,
  certPath = path.join("src", "inter", "certs", "inter.crt"),
  keyPath = path.join("src", "inter", "certs", "inter.key"),
}: GetInterTokenOptions): Promise<string> {
  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);

  const httpsAgent = new https.Agent({ cert, key, passphrase, rejectUnauthorized });

  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);
  form.set("scope", scope);
  form.set("grant_type", "client_credentials");

  const resp = await axios.post(tokenUrl, form.toString(), {
    httpsAgent,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15_000,
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const token = resp.data?.access_token as string | undefined;
  if (!token) throw new Error("Resposta sem access_token.");
  return token;
}

// -----------------------------------------------------------------------------
// PAGAR PIX COPIA E COLA
// -----------------------------------------------------------------------------
type PagarPixCopiaEColaParams = {
  token: string;
  emv: string;
  valor: number | string;
  descricao?: string;
  contaCorrente?: string;
  diasParaPagamento?: number;
  certPath?: string;
  keyPath?: string;
  passphrase?: string;
  apiBase?: string;
  rejectUnauthorized?: boolean;
};

function formatarDataYYYYMMDD(diasNoFuturo = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + diasNoFuturo);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function pagarPixCopiaECola({
  token,
  emv,
  valor,
  descricao,
  contaCorrente = ACCOUNT_HEADER_VAL,
  diasParaPagamento = 0,
  certPath = path.join("src", "inter", "certs", "inter.crt"),
  keyPath = path.join("src", "inter", "certs", "inter.key"),
  apiBase = "https://cdpj.partners.bancointer.com.br",
  rejectUnauthorized = true,
}: PagarPixCopiaEColaParams) {
  if (!token) throw new Error("Token obrigatório.");
  if (!emv || !emv.trim()) throw new Error("EMV obrigatório.");

  const valorNumber = Number(valor);
  if (!isFinite(valorNumber) || valorNumber <= 0) throw new Error("Valor inválido.");

  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  const httpsAgent = new https.Agent({ cert, key, rejectUnauthorized });

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    [ACCOUNT_HEADER_KEY]: contaCorrente,
  };

  const body = {
    valor: valorNumber,
    dataPagamento: formatarDataYYYYMMDD(diasParaPagamento),
    descricao: descricao ?? DESCRICAO_DEFAULT,
    destinatario: {
      tipo: "PIX_COPIA_E_COLA",
      pixCopiaECola: emv.trim(),
    },
  };

  const url = `${apiBase}/banking/v2/pix`;
  const resp = await axios.post(url, body, {
    httpsAgent,
    headers,
    timeout: 15_000,
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  return resp.data;
}

// -----------------------------------------------------------------------------
// CONSULTAR PIX
// -----------------------------------------------------------------------------
export type PixStatus =
  | "APROVACAO"
  | "APROVADO"
  | "LIQUIDADO"
  | "CANCELADO"
  | "ERRO"
  | string;

type ConsultarPixParams = {
  token: string;
  codigoSolicitacao: string;
  apiBase?: string;
  certPath?: string;
  keyPath?: string;
  passphrase?: string;
  rejectUnauthorized?: boolean;
  contaCorrente?: string;
};

export function isPixPago(status: string | undefined | null): boolean {
  const s = (status ?? "").toUpperCase();
  return s === "APROVADO" || s === "LIQUIDADO";
}

export async function consultarPix({
  token,
  codigoSolicitacao,
  apiBase = "https://cdpj.partners.bancointer.com.br",
  certPath = path.join("src", "inter", "certs", "inter.crt"),
  keyPath = path.join("src", "inter", "certs", "inter.key"),
  passphrase,
  rejectUnauthorized = true,
  contaCorrente = ACCOUNT_HEADER_VAL,
}: ConsultarPixParams) {
  if (!token) throw new Error("Token obrigatório.");
  if (!codigoSolicitacao) throw new Error("codigoSolicitacao obrigatório.");

  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  const httpsAgent = new https.Agent({ cert, key, passphrase, rejectUnauthorized });

  const headers = {
    Authorization: `Bearer ${token}`,
    [ACCOUNT_HEADER_KEY]: contaCorrente,
  };

  const url = `${apiBase}/banking/v2/pix/${codigoSolicitacao}`;
  const resp = await axios.get(url, {
    httpsAgent,
    headers,
    timeout: 15_000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const tx = resp.data?.transacaoPix;
  if (!tx) throw new Error("Campo transacaoPix ausente na resposta.");

  const status: PixStatus = tx.status?.toUpperCase?.() ?? "ERRO";

  return {
    codigoSolicitacao: tx.codigoSolicitacao,
    contaCorrente: tx.contaCorrente,
    valor: tx.valor,
    status,
    endToEnd: tx.endToEnd,
    chave: tx.chave,
    dataHoraSolicitacao: tx.dataHoraSolicitacao,
    dataHoraMovimento: tx.dataHoraMovimento,
    pago: isPixPago(status),
    raw: resp.data,
  };
}

// -----------------------------------------------------------------------------
// CONSULTAR EXTRATO COMPLETO (enriquecido)
// -----------------------------------------------------------------------------
type ConsultarExtratoCompletoParams = {
  token: string;
  dataInicio: string;
  dataFim: string;
  pagina?: number;
  tamanhoPagina?: number;
  tipoOperacao?: "C" | "D"; // Crédito ou Débito
  tipoTransacao?: string;   // Ex: PIX, BOLETO_COBRANCA, etc.
  apiBase?: string;
  certPath?: string;
  keyPath?: string;
  passphrase?: string;
  rejectUnauthorized?: boolean;
  contaCorrente?: string;
};

export async function consultarExtratoCompleto({
  token,
  dataInicio,
  dataFim,
  pagina = 0,
  tamanhoPagina = 1000,
  tipoOperacao,
  tipoTransacao,
  apiBase = "https://cdpj.partners.bancointer.com.br",
  certPath = path.join("src", "inter", "certs", "inter.crt"),
  keyPath = path.join("src", "inter", "certs", "inter.key"),
  passphrase,
  rejectUnauthorized = true,
  contaCorrente = ACCOUNT_HEADER_VAL,
}: ConsultarExtratoCompletoParams) {
  if (!token) throw new Error("Token obrigatório (escopo: extrato.read).");
  if (!dataInicio || !dataFim) throw new Error("Datas de início e fim são obrigatórias.");

  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  const httpsAgent = new https.Agent({ cert, key, passphrase, rejectUnauthorized });

  const headers = {
    Authorization: `Bearer ${token}`,
    [ACCOUNT_HEADER_KEY]: contaCorrente,
  };

  const query = new URLSearchParams({
    dataInicio,
    dataFim,
    pagina: String(pagina),
    tamanhoPagina: String(tamanhoPagina),
  });

  if (tipoOperacao) query.set("tipoOperacao", tipoOperacao);
  if (tipoTransacao) query.set("tipoTransacao", tipoTransacao);

  const url = `${apiBase}/banking/v2/extrato/completo?${query.toString()}`;

  const resp = await axios.get(url, {
    httpsAgent,
    headers,
    timeout: 20_000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  return resp.data;
}

// -----------------------------------------------------------------------------
// CONSULTAR SALDO
// -----------------------------------------------------------------------------
type ConsultarSaldoResponse = {
  disponivel: number;
  bloqueadoCheque?: number;
  bloqueadoJudicialmente?: number;
  bloqueadoAdministrativo?: number;
  limite?: number;
  dataReferencia?: string;
};

type ConsultarSaldoParams = {
  token: string;
  dataSaldo?: string;
  apiBase?: string;
  certPath?: string;
  keyPath?: string;
  passphrase?: string;
  rejectUnauthorized?: boolean;
  contaCorrente?: string;
};

/**
 * Consulta o saldo atual (ou de uma data específica) da conta Inter.
 * Endpoint: GET /banking/v2/saldo
 * Escopo necessário: extrato.read
 */
export async function consultarSaldo({
  token,
  dataSaldo,
  apiBase = "https://cdpj.partners.bancointer.com.br",
  certPath = path.join("src", "inter", "certs", "inter.crt"),
  keyPath = path.join("src", "inter", "certs", "inter.key"),
  passphrase,
  rejectUnauthorized = true,
  contaCorrente = ACCOUNT_HEADER_VAL,
}: ConsultarSaldoParams): Promise<ConsultarSaldoResponse> {
  if (!token) throw new Error("Token obrigatório (escopo: extrato.read).");

  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  const httpsAgent = new https.Agent({ cert, key, passphrase, rejectUnauthorized });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    [ACCOUNT_HEADER_KEY]: contaCorrente,
  };

  const url =
    dataSaldo && dataSaldo.trim()
      ? `${apiBase}/banking/v2/saldo?dataSaldo=${dataSaldo}`
      : `${apiBase}/banking/v2/saldo`;

  const resp = await axios.get(url, {
    httpsAgent,
    headers,
    timeout: 15_000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  return resp.data as ConsultarSaldoResponse;
}
