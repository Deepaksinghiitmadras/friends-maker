import { z } from 'zod';

export const resetPasswordSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    otp: z.string().length(6, { message: 'OTP must be 6 digits' }),
    password: z.string().min(6, {
        message: 'Password must be at least 6 characters'
    }),
    confirmPassword: z.string().min(6)
}).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
});

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;