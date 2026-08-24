'use server';

import { auth, signIn, signOut } from '@/auth';
import { getUserByEmail, getUserById } from './userQueries';
import { sendPasswordResetEmail, sendVerificationEmail } from '@/lib/mail';
import { prisma } from '@/lib/prisma';
import { LoginSchema } from '@/lib/schemas/LoginSchema';
import { combinedRegisterSchema, ProfileSchema, registerSchema, RegisterSchema } from '@/lib/schemas/RegisterSchema';
import { generateToken, generateOTP, generateResetPasswordOTP, getTokenByToken } from '@/lib/tokens';
import { ActionResult } from '@/types';
import { TokenType, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';

export async function signInUser(data: LoginSchema): Promise<ActionResult<string>> {
    try {
        const existingUser = await getUserByEmail(data.email);

        if (!existingUser || !existingUser.email) return { status: 'error', error: 'Invalid credentials' }

        if (!existingUser.emailVerified) {
            const { token, email } = await generateToken(existingUser.email, TokenType.VERIFICATION);

            await sendVerificationEmail(email, token)

            return { status: 'error', error: 'Please verify your email before logging in' }
        }

        await signIn('credentials', {
            email: data.email,
            password: data.password,
            redirect: false
        });

        return { status: 'success', data: 'Logged in' }
    } catch (error: any) {
        console.log('[SIGN IN ERROR]', error);
        if (error?.message?.includes('exceeded the data transfer quota')) {
            return { status: 'error', error: 'Database quota exceeded. Please reset quota in your Neon console.' };
        }
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return { status: 'error', error: 'Invalid credentials' }
                default:
                    return { status: 'error', error: 'Something went wrong' }
            }
        } else {
            throw error;
        }
    }
}

export async function signOutUser() {
    await signOut({ redirectTo: '/' });
}

export async function registerUser(data: RegisterSchema): Promise<ActionResult<User>> {
    try {
        const validated = combinedRegisterSchema.safeParse(data);

        if (!validated.success) {
            return { status: 'error', error: validated.error.errors }
        }

        const { name, email, password, gender, description, city, country, dateOfBirth, } = validated.data;

        const hashedPassword = await bcrypt.hash(password, 10);

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) return { status: 'error', error: 'User already exists' };

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                member: {
                    create: {
                        name,
                        description,
                        city,
                        country,
                        dateOfBirth: new Date(dateOfBirth),
                        gender
                    }
                }
            }
        })

        const otp = await generateOTP(email);
        await sendVerificationEmail(email, otp);

        // Log registration activity (fire-and-forget)
        void prisma.userActivity.create({
            data: {
                userId: user.id,
                userEmail: user.email,
                userName: user.name || 'Unknown',
                category: 'auth',
                action: 'register',
                details: { source: 'credentials' },
            }
        }).catch((e: any) => console.warn('[REGISTER] Activity log failed:', e?.message));

        return { status: 'success', data: user }
    } catch (error: any) {
        console.log('Registration error:', error);
        return { status: 'error', error: error?.message || 'Something went wrong during registration' }
    }

}

export async function verifyEmail(token: string): Promise<ActionResult<string>> {
    try {
        const existingToken = await getTokenByToken(token);

        if (!existingToken) {
            return { status: 'error', error: 'Invalid or expired verification code' }
        }

        const hasExpired = new Date() > existingToken.expires;

        if (hasExpired) {
            return { status: 'error', error: 'Verification code has expired. Please request a new one.' }
        }

        const existingUser = await getUserByEmail(existingToken.email);

        if (!existingUser) {
            return { status: 'error', error: 'User not found' }
        }

        await prisma.user.update({
            where: { id: existingUser.id },
            data: {
                emailVerified: new Date(),
                profileComplete: true,
            }
        });

        await prisma.token.delete({ where: { id: existingToken.id } })

        return { status: 'success', data: 'Success' }

    } catch (error) {
        console.log(error);
        throw error;
    }
}

/** Verify a 6-digit OTP sent to the user's email during registration. */
export async function verifyOTPCode(email: string, otp: string): Promise<ActionResult<string>> {
    try {
        if (!email || !otp || otp.length !== 6) {
            return { status: 'error', error: 'Please enter the 6-digit code from your email' };
        }

        const record = await getTokenByToken(otp.trim());

        if (!record || record.email.toLowerCase() !== email.toLowerCase()) {
            return { status: 'error', error: 'Invalid verification code' };
        }

        if (new Date() > record.expires) {
            return { status: 'error', error: 'Code has expired. Please register again to get a new code.' };
        }

        const user = await getUserByEmail(email);

        if (!user) {
            return { status: 'error', error: 'Account not found for this email' };
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                emailVerified: new Date(),
                profileComplete: true,
            }
        });

        await prisma.token.delete({ where: { id: record.id } });

        return { status: 'success', data: 'Email verified! You can now log in.' };
    } catch (error: any) {
        console.error('[verifyOTPCode]', error);
        return { status: 'error', error: 'Something went wrong. Please try again.' };
    }
}

export async function generateResetPasswordEmail(email: string): Promise<ActionResult<string>> {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await getUserByEmail(normalizedEmail);

        if (!existingUser) {
            return { status: 'error', error: 'Email not found' };
        }

        const otp = await generateResetPasswordOTP(normalizedEmail);

        await sendPasswordResetEmail(normalizedEmail, otp);

        return { status: 'success', data: 'Password reset code has been sent to your email.' };
    } catch (error: any) {
        console.log('[RESET PASSWORD EMAIL ERROR]', error);
        if (error?.message?.includes('exceeded the data transfer quota')) {
            return { status: 'error', error: 'Database quota exceeded. Please reset quota in your Neon console.' };
        }
        return { status: 'error', error: 'Something went wrong sending reset code' };
    }
}

export async function resetPasswordWithOTP(data: {
    email: string;
    otp: string;
    password: string;
}): Promise<ActionResult<string>> {
    try {
        const { email, otp, password } = data;
        const normalizedEmail = email.toLowerCase().trim();

        if (!normalizedEmail || !otp || otp.trim().length !== 6 || !password) {
            return { status: 'error', error: 'Please provide email, 6-digit code, and new password' };
        }

        const record = await getTokenByToken(otp.trim());

        if (!record || record.type !== TokenType.PASSWORD_RESET || record.email.toLowerCase() !== normalizedEmail) {
            return { status: 'error', error: 'Invalid or incorrect reset code' };
        }

        if (new Date() > record.expires) {
            return { status: 'error', error: 'Reset code has expired. Please request a new one.' };
        }

        const existingUser = await getUserByEmail(normalizedEmail);

        if (!existingUser) {
            return { status: 'error', error: 'User not found' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: existingUser.id },
            data: { passwordHash: hashedPassword }
        });

        await prisma.token.delete({
            where: { id: record.id }
        });

        return { status: 'success', data: 'Password updated successfully! Please log in.' };
    } catch (error) {
        console.log(error);
        return { status: 'error', error: 'Something went wrong resetting password' };
    }
}

export async function completeSocialLoginProfile(data: ProfileSchema):
    Promise<ActionResult<string>> {

    const session = await auth();

    if (!session?.user) return { status: 'error', error: 'User not found' };

    try {
        const user = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                profileComplete: true,
                member: {
                    upsert: {
                        create: {
                            name: session.user.name as string,
                            image: session.user.image,
                            gender: data.gender,
                            dateOfBirth: new Date(data.dateOfBirth),
                            description: data.description,
                            city: data.city,
                            country: data.country
                        },
                        update: {
                            name: session.user.name as string,
                            image: session.user.image,
                            gender: data.gender,
                            dateOfBirth: new Date(data.dateOfBirth),
                            description: data.description,
                            city: data.city,
                            country: data.country
                        }
                    }
                }
            },
            select: {
                accounts: {
                    select: {
                        provider: true
                    }
                }
            }
        })

        // For email/password users the accounts array is empty; redirect to members directly
        return { status: 'success', data: user.accounts[0]?.provider ?? 'credentials' }
    } catch (error) {
        console.log(error);
        return { status: 'error', error: 'Something went wrong completing your profile' }
    }
}

export async function getAuthUserId() {
    const session = await auth();
    const userId = session?.user?.id;
    const sessionToken = session?.user?.sessionToken;

    if (!userId) throw new Error('Unauthorized');

    if (sessionToken) {
        const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { sessionToken: true, isBlocked: true }
        });
        if (dbUser?.isBlocked || (dbUser?.sessionToken && dbUser.sessionToken !== sessionToken)) {
            throw new Error('Logged in from another device. Please log in again.');
        }
    }

    return userId;
}

export async function getUserRole() {
    const session = await auth();

    const role = session?.user.role;

    if (!role) throw new Error('Not in role');

    return role;
}