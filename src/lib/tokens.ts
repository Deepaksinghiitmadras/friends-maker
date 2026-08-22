import { TokenType } from '@prisma/client';
import { prisma } from './prisma';

export async function getTokenByEmail(email: string) {
    try {
        return prisma.token.findFirst({
            where: { email }
        })
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getTokenByToken(token: string) {
    try {
        return prisma.token.findFirst({
            where: { token }
        })
    } catch (error) {
        console.log(error);
        throw error;
    }
}

/** Generate a long random hex token (24-hour expiry). */
export async function generateToken(email: string, type: TokenType) {
    const token = getLongToken();
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); //  Expires in 24 hours

    await prisma.token.deleteMany({
        where: { email, type }
    });

    return prisma.token.create({
        data: {
            email,
            token,
            expires,
            type
        }
    })
}

/** Generate a 6-digit numeric OTP for email verification (10-minute expiry). */
export async function generateOTP(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 100000–999999
    const expires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    await prisma.token.deleteMany({
        where: { email, type: TokenType.VERIFICATION }
    });

    await prisma.token.create({
        data: {
            email,
            token: otp,
            expires,
            type: TokenType.VERIFICATION,
        }
    });

    return otp;
}

/** Generate a 6-digit numeric OTP for password reset (10-minute expiry). */
export async function generateResetPasswordOTP(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 100000–999999
    const expires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes

    await prisma.token.deleteMany({
        where: { email, type: TokenType.PASSWORD_RESET }
    });

    await prisma.token.create({
        data: {
            email,
            token: otp,
            expires,
            type: TokenType.PASSWORD_RESET,
        }
    });

    return otp;
}

function getLongToken() {
    const arrayBuffer = new Uint8Array(48);
    crypto.getRandomValues(arrayBuffer);
    return Array.from(arrayBuffer, byte => byte.toString(16).padStart(2, '0')).join('');
}