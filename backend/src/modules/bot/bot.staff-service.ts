import prisma from '../../config/db';
import { Role, BotChannel } from '@prisma/client';
import bcrypt from 'bcrypt';

export class BotStaffService {
  /**
   * Helper to normalize phone numbers
   */
  private static normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Add a new staff member to the database
   */
  public static async addStaff(
    senderUserId: string,
    name: string,
    rawPhone: string,
    position: string
  ): Promise<string> {
    // 1. Resolve role and department
    let role: Role = Role.STAFF;
    let department = 'Operations';

    const posLower = position.toLowerCase().trim();
    if (posLower === 'ag' || posLower === 'ag staff') {
      role = Role.STAFF;
      department = 'AG';
    } else if (posLower.includes('owner')) {
      role = Role.OWNER;
      department = 'Management';
    } else if (posLower.includes('fleet manager')) {
      role = Role.FLEET_MANAGER;
      department = 'Fleet';
    } else if (posLower.includes('manager')) {
      role = Role.MANAGER;
      department = 'Management';
    } else if (posLower.includes('account')) {
      role = Role.ACCOUNTS;
      department = 'Accounts';
    } else {
      role = Role.STAFF;
      // Capitalize first letter of each word for the department
      department = position.split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    // 2. Normalize and validate phone number
    const cleanPhone = this.normalizePhone(rawPhone);
    if (!cleanPhone) {
      return `Error: Invalid phone number specified.`;
    }

    // Check if phone number is already registered under WhatsApp channel
    const existingContact = await prisma.userContact.findFirst({
      where: { phoneNumber: cleanPhone, channel: BotChannel.WHATSAPP }
    });
    if (existingContact) {
      const u = await prisma.user.findUnique({ where: { id: existingContact.userId } });
      return `Error: Phone number +${cleanPhone} is already registered to ${u ? u.name : 'another user'}.`;
    }

    // 3. Generate unique email
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!sanitizedName) {
      return `Error: Invalid name specified.`;
    }
    
    let email = `${sanitizedName}@apil.local`;
    let count = 1;
    while (true) {
      const check = await prisma.user.findUnique({ where: { email } });
      if (!check) break;
      email = `${sanitizedName}${count}@apil.local`;
      count++;
    }

    // 4. Hash password and save in a transaction
    try {
      const passwordHash = await bcrypt.hash('Password@123', 12);
      const newUser = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role,
            department,
            isActive: true
          }
        });

        await tx.userContact.create({
          data: {
            userId: user.id,
            phoneNumber: cleanPhone,
            channel: BotChannel.WHATSAPP,
            isVerified: true
          }
        });

        return user;
      });

      // 5. Audit Log
      await prisma.auditLog.create({
        data: {
          userId: senderUserId,
          action: 'BOT_STAFF_ADDED',
          details: `Staff member "${newUser.name}" added with email "${newUser.email}", role "${newUser.role}", phone "${cleanPhone}" by sender user ID "${senderUserId}".`
        }
      });

      return `Staff member "${name.toUpperCase()}" added successfully!\n\nDETAILS:\n- EMAIL: ${email}\n- ROLE: ${role}\n- DEPARTMENT: ${department.toUpperCase()}\n- WHATSAPP: +${cleanPhone}\n- DEFAULT PASSWORD: Password@123\n\nThey are now active and ready for task assignments.`;
    } catch (err: any) {
      console.error('[BotStaffService] Error adding staff:', err);
      return `Error adding staff: ${err.message}`;
    }
  }

  /**
   * List all registered staff members with phone numbers and display the total count (excluding Owners and AG Staff)
   */
  public static async listStaff(): Promise<string> {
    try {
      const users = await prisma.user.findMany({
        where: { 
          isActive: true,
          role: { not: Role.OWNER },
          NOT: { department: 'AG' }
        },
        include: {
          contacts: {
            where: { channel: BotChannel.WHATSAPP, isVerified: true }
          }
        },
        orderBy: { name: 'asc' }
      });

      if (users.length === 0) {
        return `ARVIND PORT & INFRA LIMITED STAFF MEMBERS\n=========================================\nNo active members found.`;
      }

      let response = `ARVIND PORT & INFRA LIMITED STAFF MEMBERS\n=========================================\nTOTAL MEMBERS: ${users.length}\n`;

      users.forEach((u, index) => {
        const phone = u.contacts.length > 0 ? `+${u.contacts[0].phoneNumber}` : 'NO REGISTERED WHATSAPP';
        const dept = u.department ? u.department.toUpperCase() : 'N/A';
        response += `\nSR. NO.: ${index + 1}\nNAME: ${u.name.toUpperCase()}\nROLE: ${u.role}\nDEPARTMENT: ${dept}\nWHATSAPP: ${phone}\n`;
      });

      return response.trim();
    } catch (err: any) {
      console.error('[BotStaffService] Error listing staff:', err);
      return `Error retrieving staff list: ${err.message}`;
    }
  }

  /**
   * List all registered AG staff members with phone numbers
   */
  public static async listAGStaff(): Promise<string> {
    try {
      const users = await prisma.user.findMany({
        where: { 
          isActive: true,
          department: 'AG'
        },
        include: {
          contacts: {
            where: { channel: BotChannel.WHATSAPP, isVerified: true }
          }
        },
        orderBy: { name: 'asc' }
      });

      if (users.length === 0) {
        return `ARVIND PORT & INFRA LIMITED AG STAFF MEMBERS\n=========================================\nNo active AG staff members found.`;
      }

      let response = `ARVIND PORT & INFRA LIMITED AG STAFF MEMBERS\n=========================================\nTOTAL AG STAFF: ${users.length}\n`;

      users.forEach((u, index) => {
        const phone = u.contacts.length > 0 ? `+${u.contacts[0].phoneNumber}` : 'NO REGISTERED WHATSAPP';
        const dept = u.department ? u.department.toUpperCase() : 'N/A';
        response += `\nSR. NO.: ${index + 1}\nNAME: ${u.name.toUpperCase()}\nROLE: ${u.role}\nDEPARTMENT: ${dept}\nWHATSAPP: ${phone}\n`;
      });

      return response.trim();
    } catch (err: any) {
      console.error('[BotStaffService] Error listing AG staff:', err);
      return `Error retrieving AG staff list: ${err.message}`;
    }
  }

  /**
   * List all registered owners with phone numbers
   */
  public static async listOwners(): Promise<string> {
    try {
      const users = await prisma.user.findMany({
        where: { 
          isActive: true,
          role: Role.OWNER
        },
        include: {
          contacts: {
            where: { channel: BotChannel.WHATSAPP, isVerified: true }
          }
        },
        orderBy: { name: 'asc' }
      });

      if (users.length === 0) {
        return `ARVIND PORT & INFRA LIMITED OWNERS\n=========================================\nNo active owners found.`;
      }

      let response = `ARVIND PORT & INFRA LIMITED OWNERS\n=========================================\nTOTAL OWNERS: ${users.length}\n`;

      users.forEach((u, index) => {
        const phone = u.contacts.length > 0 ? `+${u.contacts[0].phoneNumber}` : 'NO REGISTERED WHATSAPP';
        const dept = u.department ? u.department.toUpperCase() : 'N/A';
        response += `\nSR. NO.: ${index + 1}\nNAME: ${u.name.toUpperCase()}\nROLE: ${u.role}\nDEPARTMENT: ${dept}\nWHATSAPP: ${phone}\n`;
      });

      return response.trim();
    } catch (err: any) {
      console.error('[BotStaffService] Error listing owners:', err);
      return `Error retrieving owners list: ${err.message}`;
    }
  }
}
