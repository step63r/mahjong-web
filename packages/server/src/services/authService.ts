import type { PrismaClient } from "@prisma/client";

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async findOrCreateUser(firebaseUid: string, displayName: string, photoUrl: string | null) {
    return this.prisma.user.upsert({
      where: { firebaseUid },
      update: { displayName, photoUrl },
      create: { firebaseUid, displayName, photoUrl },
    });
  }

  async findUserByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
    });
  }
}
