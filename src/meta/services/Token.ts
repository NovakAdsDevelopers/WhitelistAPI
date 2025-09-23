import axios from "axios";
import { prisma } from "../../database";

export async function fetchFacebookToken(
  clientId: string,
  clientSecret: string,
  title: string
) {
  try {
    console.log(`🔑 Iniciando busca do token para perfil: ${title}`);
    console.log(`📌 Client ID: ${clientId}`);

    // pega o token anterior (sempre existe)
    const lastTokenRecord = await prisma.token.findUnique({
      where: { client_id: clientId },
      select: { token: true },
    });

    if (!lastTokenRecord) {
      throw new Error(`Token anterior não encontrado para client_id: ${clientId}`);
    }

    console.log("🔹 Token anterior encontrado:", lastTokenRecord.token);

    // URL para renovar token
    const url = `https://graph.facebook.com/v23.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${lastTokenRecord.token}`;
    console.log("🌐 URL de requisição do token:", url);

    const { data } = await axios.get(url);

    console.log("📥 Resposta da API do Facebook:", data);

    const tokenValue = data.access_token;
    const expiresIn = data.expires_in;
    console.log("🔹 Novo token gerado:", tokenValue);
    console.log("⏳ Expira em (segundos):", expiresIn);

    // Atualiza apenas (sem create)
    const savedToken = await prisma.token.update({
      where: { client_id: clientId },
      data: {
        last_token: lastTokenRecord.token, // certeza que existe
        token: tokenValue,
      },
    });

    console.log(`✅ Token atualizado com sucesso no banco para: ${title}`);
    console.log("📦 Registro atualizado:", savedToken);

    return savedToken;
  } catch (error) {
    console.error(`❌ Erro ao buscar token do perfil ${title}:`, error);
    throw error;
  }
}
