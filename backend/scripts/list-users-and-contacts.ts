import prisma from '../src/config/db';

async function main() {
  const users = await prisma.user.findMany({
    include: {
      contacts: true
    }
  });
  console.log(JSON.stringify(users.map(u => ({ id: u.id, name: u.name, role: u.role, contacts: u.contacts })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
