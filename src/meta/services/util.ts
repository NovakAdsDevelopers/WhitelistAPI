import { prisma } from "../../database";

export async function getTokenForAdAccount(adAccountId: string): Promise<string | null> {
  const adAccount = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
    include: { BM: { include: { token: true } } },
  });

  if (!adAccount || !adAccount.BM || !adAccount.BM.token) return null;
  return adAccount.BM.token.token;
}
