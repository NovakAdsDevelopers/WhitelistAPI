// utils/metaTokens.ts
export const TOKENS = [
  process.env.TOKEN_ACCESS_META,
  process.env.TOKEN_ACCESS_META2,
].filter(Boolean) as string[];
