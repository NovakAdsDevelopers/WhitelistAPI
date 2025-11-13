import express from "express";

export const handleError = (
  res: express.Response,
  error: unknown,
  msg = "Erro interno"
) => {
  console.error("❌", msg, error);
  const errorMsg = (error as any)?.response?.data
    ? JSON.stringify((error as any).response.data)
    : (error as any)?.message || msg;
  return res.status(500).json({ error: errorMsg });
};