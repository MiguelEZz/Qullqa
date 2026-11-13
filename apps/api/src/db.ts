import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL no está definida (revisa .env)');

export const sql = postgres(url, { max: 10, onnotice: () => {} });
