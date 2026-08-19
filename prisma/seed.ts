import { PrismaClient } from '@prisma/client';
import { membersData } from './membersData';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function seedMembers() {
    const passwordHash = await hash('password', 10);

    for (const member of membersData) {
        await prisma.user.upsert({
            where: { email: member.email },
            update: {},
            create: {
                email: member.email,
                emailVerified: new Date(),
                name: member.name,
                passwordHash,
                image: member.image,
                profileComplete: true,
                member: {
                    create: {
                        dateOfBirth: new Date(member.dateOfBirth),
                        gender: member.gender,
                        name: member.name,
                        created: new Date(member.created),
                        updated: new Date(member.lastActive),
                        description: member.description,
                        city: member.city,
                        country: member.country,
                        image: member.image,
                        photos: {
                            create: {
                                url: member.image,
                                isApproved: true
                            }
                        }
                    }
                }
            }
        });
    }
}

async function seedAdmin() {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';
    const passwordHash = await hash(adminPassword, 10);
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            role: 'ADMIN',
            passwordHash,
        },
        create: {
            email: adminEmail,
            emailVerified: new Date(),
            name: 'Admin',
            passwordHash,
            role: 'ADMIN',
            profileComplete: true
        }
    });
}

async function main() {
    await seedMembers();
    await seedAdmin();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
})