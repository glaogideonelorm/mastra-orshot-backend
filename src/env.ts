export const env = {
  ORSHOT_API_KEY: process.env.ORSHOT_API_KEY ?? "",
  ORSHOT_TEMPLATE_ID_LANDING: process.env.ORSHOT_TEMPLATE_ID_LANDING ?? "",
  ORSHOT_TEMPLATE_ID_SCREENSHOT:
    process.env.ORSHOT_TEMPLATE_ID_SCREENSHOT ?? "",
  PORT: Number(process.env.PORT ?? "3000"),
};

for (const [k, v] of Object.entries(env)) {
  if (!v) console.warn(`[env] ${k} is not set`);
}
