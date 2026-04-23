import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const institutes = [
  { name: "JIS College of Engineering, Kalyani", shortCode: "JISCE", domain: "jisce.edu.in" },
  { name: "JIS University, Agarpara", shortCode: "JISU", domain: "jisuniversity.ac.in" },
  { name: "Calcutta Institute of Technology, Uluberia", shortCode: "CIT", domain: "calcuttainstituteoftechnology.co.in" },
  { name: "Camellia Institute of Technology", shortCode: "CITK", domain: "camelliait.ac.in" },
  { name: "Camellia School of Business Management", shortCode: "CSBM", domain: null },
  { name: "JIS Institute of Advanced Studies and Research", shortCode: "JISIASR", domain: null },
  { name: "Guru Nanak Institute of Technology", shortCode: "GNIT", domain: "gnit.ac.in" },
  { name: "Guru Nanak Institute of Pharmaceutical Science and Technology", shortCode: "GNIPST", domain: null },
  { name: "JIS School of Polytechnic", shortCode: "JISPOLY", domain: null },
  { name: "JIS Institute of Pharmacy", shortCode: "JISPHARM", domain: null },
  { name: "JIS School of Medical Science and Research", shortCode: "JISMSR", domain: null },
  { name: "JIS Institute of Skills", shortCode: "JISSKILL", domain: null }
];

type SeedUser = {
  fullName: string;
  handle: string;
  email: string;
  rollNumber: string;
  instituteCode: string;
  role?: UserRole;
  verified?: boolean;
};

const users: SeedUser[] = [
  {
    fullName: "Campus Admin",
    handle: "campus_admin",
    email: "admin@jisphere.app",
    rollNumber: "ADMIN001",
    instituteCode: "JISCE",
    role: UserRole.ADMIN,
    verified: true
  },
  {
    fullName: "Priya Sharma",
    handle: "priya_jisce",
    email: "priya.sharma@example.edu",
    rollNumber: "JISCE2024001",
    instituteCode: "JISCE",
    verified: true
  },
  {
    fullName: "Arnab Das",
    handle: "arnab_jisu",
    email: "arnab.das@example.edu",
    rollNumber: "JISU2024012",
    instituteCode: "JISU"
  },
  {
    fullName: "Sneha Roy",
    handle: "sneha_cit",
    email: "sneha.roy@example.edu",
    rollNumber: "CIT2024103",
    instituteCode: "CIT"
  }
];

async function main() {
  const instituteMap = new Map<string, string>();
  for (const institute of institutes) {
    const created = await prisma.institute.upsert({
      where: { shortCode: institute.shortCode },
      update: {
        name: institute.name,
        domain: institute.domain,
        isActive: true
      },
      create: {
        name: institute.name,
        shortCode: institute.shortCode,
        domain: institute.domain,
        isActive: true
      }
    });
    instituteMap.set(institute.shortCode, created.id);
  }

  const defaultPassword = await bcrypt.hash("Password@123", 10);

  const userMap = new Map<string, string>();
  for (const user of users) {
    const instituteId = instituteMap.get(user.instituteCode);
    if (!instituteId) continue;
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        handle: user.handle,
        rollNumber: user.rollNumber,
        instituteId,
        role: user.role ?? UserRole.STUDENT,
        verified: user.verified ?? false
      },
      create: {
        fullName: user.fullName,
        handle: user.handle,
        email: user.email,
        passwordHash: defaultPassword,
        rollNumber: user.rollNumber,
        instituteId,
        role: user.role ?? UserRole.STUDENT,
        verified: user.verified ?? false,
        verificationStatus: (user.verified ?? false) ? "APPROVED" : "PENDING"
      }
    });
    userMap.set(user.handle, created.id);
  }

  const postCount = await prisma.post.count();
  if (postCount === 0) {
    const priyaId = userMap.get("priya_jisce");
    const arnabId = userMap.get("arnab_jisu");
    const snehaId = userMap.get("sneha_cit");
    const adminId = userMap.get("campus_admin");

    if (priyaId) {
      await prisma.post.create({
        data: {
          authorId: priyaId,
          instituteId: instituteMap.get("JISCE"),
          content:
            "Just submitted my final year project. Four years of hard work finally paid off. #FinalYear #JISLife"
        }
      });
    }

    if (arnabId) {
      await prisma.post.create({
        data: {
          authorId: arnabId,
          instituteId: instituteMap.get("JISU"),
          content:
            "Hackathon registrations are open now. 48-hour coding marathon with prizes. #Hackathon #CampusBuild"
        }
      });
    }

    if (snehaId) {
      await prisma.post.create({
        data: {
          authorId: snehaId,
          instituteId: instituteMap.get("CIT"),
          content: "Canteen poll today: best lunch combo at CIT. Share your vote. #CampusFood"
        }
      });
    }

    if (adminId) {
      await prisma.post.create({
        data: {
          authorId: adminId,
          instituteId: instituteMap.get("JISCE"),
          content:
            "Welcome to JISphere. Post, comment, repost, and chat with students across all JIS institutes."
        }
      });
    }
  }

  const priyaId = userMap.get("priya_jisce");
  const arnabId = userMap.get("arnab_jisu");
  const adminId = userMap.get("campus_admin");

  if (priyaId && arnabId) {
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: arnabId, followingId: priyaId } },
      update: {},
      create: { followerId: arnabId, followingId: priyaId }
    });
  }

  if (adminId && arnabId) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: [adminId, arnabId] }
          }
        }
      },
      select: { id: true }
    });

    if (!existing) {
      const conversation = await prisma.conversation.create({
        data: {
          isGroup: false,
          members: {
            create: [{ userId: adminId }, { userId: arnabId }]
          }
        },
        select: { id: true }
      });

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: adminId,
          content: "Welcome to JISphere. Your account setup is complete."
        }
      });
    }
  }

  console.log("Seed completed. Default login password for sample users: Password@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
