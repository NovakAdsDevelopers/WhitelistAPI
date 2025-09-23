import axios from "axios";
import { prisma } from "../../database";

export async function createORupdateBMs(token: string, tokenId: number) {
  try {
    // URL para buscar as BMs do usuário
    const url = `https://graph.facebook.com/v23.0/me/businesses?access_token=${token}&fields=id,name`;

    const { data } = await axios.get(url);

    if (!data || !data.data) {
      console.log("Nenhuma BM encontrada.");
      return [];
    }

    const results = [];
    // Percorre cada BM retornada
    for (const bm of data.data) {
      const existingBM = await prisma.bM.findUnique({
        where: { BMId: bm.id },
      });

      if (existingBM) {
        // Verifica se houve alteração no nome ou se o tokenId mudou
        if (existingBM.nome !== bm.name || existingBM.tokenId !== tokenId) {
          const updatedBM = await prisma.bM.update({
            where: { BMId: bm.id },
            data: {
              nome: bm.name,
              tokenId, // associa ao token correto
            },
          });
          results.push(updatedBM);
        } else {
          results.push(existingBM);
        }
      } else {
        // Cria nova BM associada ao token
        const newBM = await prisma.bM.create({
          data: {
            BMId: bm.id,
            nome: bm.name,
            tokenId, // associa ao token correto
          },
        });
        results.push(newBM);
      }
    }

    console.error("✅ Sucesso ao atualizar:", results);
    return results;

  } catch (error) {
    console.error("❌ Erro ao buscar ou salvar BMs:", error);
    throw error;
  }
}


export async function associateBMsTOAdAccounts(BMId: string, token: string) {
  // Coletor das contas não associadas (id + name)
  const naoAssociadas: Array<{ id: string; name: string }> = [];

  try {
    console.log(`🔹 Buscando Ad Accounts da BM: ${BMId}`);

    let nextUrl: string | null =
      `https://graph.facebook.com/v23.0/${BMId}/owned_ad_accounts?fields=id,name&access_token=${token}`;
    let totalProcessed = 0;

    while (nextUrl) {
      console.log(`📡 Fazendo requisição para: ${nextUrl}`);

      const { data }: any = await axios.get(nextUrl);
      const adAccounts = data.data ?? [];

      console.log(`🔹 Página retornou ${adAccounts.length} Ad Accounts da BM ${BMId}`);

      for (const ad of adAccounts) {
        // Remove o prefixo "act_" caso exista
        const adAccountId: string = ad.id?.startsWith('act_') ? ad.id.slice(4) : ad.id;
        const adAccountName: string = ad.name ?? '';

        console.log(`🔄 Verificando Ad Account: ${adAccountId} (${adAccountName}) no banco`);

        try {
          // Atualiza a Ad Account associando à BM se ela existir
          const updatedAdAccount = await prisma.adAccount.updateMany({
            where: { id: adAccountId },
            data: { BMId },
          });

          if (updatedAdAccount.count > 0) {
            console.log(`✅ Ad Account ${adAccountId} associada à BM ${BMId}`);
          } else {
            console.log(`⚠️ Ad Account ${adAccountId} não encontrada no banco. Ignorando.`);
            naoAssociadas.push({ id: adAccountId, name: adAccountName });
          }
        } catch (e) {
          console.error(`❌ Erro ao associar ${adAccountId} (${adAccountName}) → BM ${BMId}:`, e);
          naoAssociadas.push({ id: adAccountId, name: adAccountName });
        }
      }

      totalProcessed += adAccounts.length;

      // Pega próxima página
      nextUrl = data.paging?.next || null;
    }

    console.log(
      `🏁 Associação BM ${BMId} concluída. Total processado: ${totalProcessed}. ` +
      `Não associadas: ${naoAssociadas.length}`
    );

    // 🔙 Retorno com o relatório do processamento
    return {
      totalProcessed,
      naoAssociadas, // [{ id, name }, ...]
    };
  } catch (error) {
    console.error(`❌ Erro ao associar BM ${BMId} às Ad Accounts:`, error);
    throw error;
  }
}

