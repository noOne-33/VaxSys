
// src/app/signup/actions.ts

'use server'

import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { app } from "@/firebase/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import * as admin from 'firebase-admin';

// Helper to initialize Firebase Admin SDK for cleanup operations
async function initializeFirebaseAdmin() {
    if (admin.apps.length === 0) {
        if (process.env.FIREBASE_ADMIN_KEY) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
            } catch (e) {
                console.error('FIREBASE_ADMIN_KEY is not valid JSON.', e);
                // Try default initialization
                admin.initializeApp();
            }
        } else {
            admin.initializeApp();
        }
    }
    return admin.auth();
}

// No Zod schema needed here. The client validates format, Firebase validates content.
interface SignupFormData {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export async function signup(formData: SignupFormData) {
  const { firstName, lastName, email, password } = formData;
  let firebaseUser: any = null;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Step 1: Connect to database and check if user already exists in MongoDB
    await dbConnect();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        return { success: false, error: "A user with this email already exists." };
    }

    // Step 2: Create the user in Firebase Authentication.
    // Firebase handles password hashing, email validation, and checks for existing users.
    const auth = getAuth(app);
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    firebaseUser = userCredential.user;

    // Step 3: Create a corresponding user profile in your MongoDB.
    // IMPORTANT: DO NOT store the password. The firebaseUid is the link.
    const newUser = new User({
      firebaseUid: firebaseUser.uid,
      email: normalizedEmail, // Use normalized email for consistency
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      displayName: `${firstName.trim()} ${lastName.trim()}`,
      emailVerified: false, // Will be updated later, e.g., via a webhook or custom claims
    });

    await newUser.save();

    // Step 4: Send the verification email using Firebase.
    // Only send after MongoDB save succeeds to ensure consistency
    try {
        const actionCodeSettings = {
            url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9007'}/login`, // URL to redirect to after verification
            handleCodeInApp: true,
        };
        await sendEmailVerification(firebaseUser, actionCodeSettings);
    } catch (emailError: any) {
        // Log but don't fail signup if email sending fails
        console.error("Failed to send verification email:", emailError);
    }

    // Prepare the user object to return to the client (without sensitive data)
    const userObject = newUser.toObject();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, __v, ...userWithoutSensitiveData } = userObject;

    return { success: true, user: JSON.parse(JSON.stringify(userWithoutSensitiveData)) };

  } catch (error: any) {
    console.error("Signup error:", error.code, error.message, error);

    // If Firebase user was created but MongoDB save failed, clean up Firebase user
    if (firebaseUser && firebaseUser.uid) {
        try {
            const adminAuth = await initializeFirebaseAdmin();
            await adminAuth.deleteUser(firebaseUser.uid);
            console.log("Cleaned up orphaned Firebase user:", firebaseUser.uid);
        } catch (cleanupError: any) {
            console.error("Failed to cleanup Firebase user:", cleanupError);
            // If cleanup fails, we should still inform the user
        }
    }

    // Provide user-friendly error messages based on Firebase error codes.
    let errorMessage = "An unexpected error occurred during signup. Please try again.";
    
    if (error.code === 'auth/email-already-in-use') {
        // Check if MongoDB user exists - if not, there's an orphaned Firebase account
        try {
            await dbConnect();
            const mongoUser = await User.findOne({ email: normalizedEmail });
            if (!mongoUser) {
                errorMessage = "An account with this email exists but is incomplete. Please contact support or try logging in.";
            } else {
                errorMessage = "A user with this email already exists.";
            }
        } catch (checkError) {
            errorMessage = "A user with this email already exists.";
        }
    } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password (at least 6 characters).";
    } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The email address is invalid. Please enter a valid email address.";
    } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/password accounts are not enabled. Please contact support.";
    } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection and try again.";
    } else if (error.name === 'MongoServerError' && error.code === 11000) {
        // MongoDB duplicate key error
        if (error.keyPattern?.email) {
            errorMessage = "A user with this email already exists.";
        } else if (error.keyPattern?.firebaseUid) {
            errorMessage = "An account with this ID already exists. Please contact support.";
        } else {
            errorMessage = "A duplicate entry was detected. Please try again.";
        }
    } else if (error.name === 'ValidationError') {
        // Mongoose validation error
        const validationErrors = Object.values(error.errors || {}).map((err: any) => err.message).join(', ');
        errorMessage = `Validation error: ${validationErrors}`;
    } else if (error.message && process.env.NODE_ENV === 'development') {
        // Include more details for debugging in development
        errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}

// The resendVerificationEmail function can remain as it is.
export async function resendVerificationEmail(email: string) {
    try {
        const auth = getAuth(app);
        // To resend a verification email, we need to be authenticated.
        // This action is more complex than it seems, because we need the user's context.
        // A simple approach is to have the user log in again to trigger a state where we can get the currentUser.
        // For this implementation, we will assume this action is called from a context where the user
        // object is available, even if not fully authenticated (e.g., just after signup).
        
        // This is a simplified example. A robust implementation might require
        // looking up the user by email if not currently signed in, which is an admin-level task.
        // However, for resending to the *currently signed-up* user, this can work.
        const user = auth.currentUser;

        if (user && user.email === email) {
            const actionCodeSettings = {
                url: `${process.env.NEXT_PUBLIC_BASE_URL}/login`,
                handleCodeInApp: true,
            };
            await sendEmailVerification(user, actionCodeSettings);
            return { success: true };
        }

        // If we can't find a current user, it's safer to guide them.
        return { success: false, error: "Could not send verification email. Please try logging in again." };

    } catch (error: any) {
        console.error("Resend verification email error:", error);
        return { success: false, error: "Could not resend verification email." };
    }
}
