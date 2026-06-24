import prisma from '../src/config/db';

async function main() {
  console.log("=== DB STATS ===");
  try {
    const userCount = await prisma.user.count();
    const contactCount = await prisma.userContact.count();
    const vesselCount = await prisma.vessel.count();
    const docCount = await prisma.vesselDocument.count();
    const taskCount = await prisma.task.count();
    const commentCount = await prisma.taskComment.count();
    const msgCount = await prisma.botMessage.count();
    const sessionCount = await prisma.botSession.count();

    console.log(`Users: ${userCount}`);
    console.log(`Contacts: ${contactCount}`);
    console.log(`Vessels: ${vesselCount}`);
    console.log(`Documents: ${docCount}`);
    console.log(`Tasks: ${taskCount}`);
    console.log(`Comments: ${commentCount}`);
    console.log(`BotMessages: ${msgCount}`);
    console.log(`BotSessions: ${sessionCount}`);
  } catch (err: any) {
    console.error("Error reading stats:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
