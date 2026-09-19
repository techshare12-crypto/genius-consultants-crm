import path from 'path';
const dbPath = path.resolve(process.cwd(), 'prisma/dev.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbPath}`;