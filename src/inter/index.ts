// src/getInterToken.ts
import axios from "axios";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const REQUIRED_SCOPE = "pagamento-pix.write" as const;

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
  form.set("scope", scope); // pagamento-pix.write
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

// src/pix/pagarPixCopiaECola.ts
const ACCOUNT_HEADER_KEY = "x-conta-corrente" as const;
const ACCOUNT_HEADER_VAL = "180813390" as const;
const DESCRICAO_DEFAULT  = "Pagamento via Novak" as const;

type PagarPixCopiaEColaParams = {
  /** Bearer token já obtido (escopo pagamento-pix.write) */
  token: string;
  /** String BR Code (Pix Copia e Cola) */
  emv: string;
  /** Valor do pagamento (será convertido para number) */
  valor: number | string;
  /** Descrição opcional (default: "Pagamento via Novak") */
  descricao?: string;
  /** Opcional: sobrescrever conta corrente; default: 180813390 */
  contaCorrente?: string;

  /** mTLS */
  certPath?: string; // default: src/inter/certs/inter.crt
  keyPath?: string;  // default: src/inter/certs/inter.key
  passphrase?: string;

  /** Base da API */
  apiBase?: string; // default: prod
  rejectUnauthorized?: boolean;
};

function hojeYYYYMMDD(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Efetua pagamento PIX via "Copia e Cola".
 * Recebe o token por parâmetro e monta payload/headers conforme especificado.
 */
export async function pagarPixCopiaECola({
  token,
  emv,
  valor,
  descricao,
  contaCorrente = ACCOUNT_HEADER_VAL,
  certPath = path.join("src", "inter", "certs", "inter.crt"),
  keyPath = path.join("src", "inter", "certs", "inter.key"),
  apiBase = "https://cdpj.partners.bancointer.com.br",
  rejectUnauthorized = true,
}: PagarPixCopiaEColaParams) {
  if (!token) throw new Error("Token obrigatório.");
  if (!emv || !emv.trim()) throw new Error("EMV (Pix Copia e Cola) obrigatório.");
  const valorNumber = Number(valor);
  if (!isFinite(valorNumber) || valorNumber <= 0) {
    throw new Error("Valor inválido.");
  }

  // mTLS
  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  const httpsAgent = new https.Agent({ cert, key, rejectUnauthorized });

  // Headers exatamente como solicitado
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    [ACCOUNT_HEADER_KEY]: contaCorrente,
  };

  // Body exatamente como solicitado
  const body = {
    valor: valorNumber,
    dataPagamento: hojeYYYYMMDD(),
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

  return resp.data; // JSON do Inter
}
