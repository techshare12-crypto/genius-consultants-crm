import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.candidate.findMany({
    select: { id: true, candidateCode: true, fullName: true, normalizedPhone: true }
  });

  const phoneMap = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const list = phoneMap.get(c.normalizedPhone) || [];
    list.push(c);
    phoneMap.set(c.normalizedPhone, list);
  }

  const duplicates = [];
  for (const [phone, list] of phoneMap.entries()) {
    if (list.length > 1) {
      duplicates.push({ phone, count: list.length, candidates: list });
    }
  }

  console.log(`Total Candidates Checked: ${candidates.length}`);
  console.log(`Duplicate Phone Groups Found: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('Duplicates:', JSON.stringify(duplicates, null, 2));
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
