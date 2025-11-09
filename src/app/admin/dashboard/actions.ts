
'use server';

import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import Center from '@/models/Center';
import { z } from 'zod';
import * as admin from 'firebase-admin';
import { revalidatePath } from 'next/cache';
import Vaccine from '@/models/Vaccine';
import Staff from '@/models/Staff';
import VaccineMovement from '@/models/VaccineMovement';

// Helper to initialize Firebase Admin SDK
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
            }
        } else {
            admin.initializeApp();
        }
    }
    return admin.auth();
}

// Action to get all users
export async function getUsers() {
  try {
    await dbConnect();
    const users = await User.find({}).select('firebaseUid firstName lastName email role').lean();
    return { success: true, users: JSON.parse(JSON.stringify(users)) };
  } catch (error) {
    console.error('Error fetching users:', error);
    return { success: false, error: 'Failed to fetch users.' };
  }
}

// Action to get all centers
export async function getCenters() {
  try {
    await dbConnect();
    const centers = await Center.find({}).select('_id center_name email location verified').lean();
    return { success: true, centers: JSON.parse(JSON.stringify(centers)) };
  } catch (error) {
    console.error('Error fetching centers:', error);
    return { success: false, error: 'Failed to fetch centers.' };
  }
}

// Schema for updating a user's role
const updateUserRoleSchema = z.object({
  targetUserId: z.string(),
  newRole: z.enum(['citizen', 'authority', 'center']),
  adminFirebaseUid: z.string(),
});

// Action to update a user's role
export async function updateUserRole(data: unknown) {
  const validationResult = updateUserRoleSchema.safeParse(data);
  if (!validationResult.success) {
    return { success: false, error: 'Invalid input data.' };
  }

  const { targetUserId, newRole, adminFirebaseUid } = validationResult.data;

  try {
    await dbConnect();

    const adminUser = await User.findOne({ firebaseUid: adminFirebaseUid });
    if (!adminUser || adminUser.role !== 'authority') {
      return { success: false, error: 'Permission denied. Not an administrator.' };
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return { success: false, error: 'Target user not found.' };
    }
    
    if (adminUser.firebaseUid === targetUser.firebaseUid) {
        return { success: false, error: "Administrators cannot change their own role." };
    }

    targetUser.role = newRole;
    await targetUser.save();
    
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: 'An internal error occurred while updating the role.' };
  }
}

// Schema for verifying a center
const verifyCenterSchema = z.object({
  centerId: z.string(),
  adminFirebaseUid: z.string(),
});

// Action to verify a center
export async function verifyCenter(data: unknown) {
    const validationResult = verifyCenterSchema.safeParse(data);
    if (!validationResult.success) {
        return { success: false, error: 'Invalid input data.' };
    }

    const { centerId, adminFirebaseUid } = validationResult.data;
     try {
        await dbConnect();

        const adminUser = await User.findOne({ firebaseUid: adminFirebaseUid });
        if (!adminUser || adminUser.role !== 'authority') {
            return { success: false, error: 'Permission denied. Not an administrator.' };
        }

        const center = await Center.findByIdAndUpdate(centerId, { verified: true }, { new: true });
        if (!center) {
            return { success: false, error: 'Center not found.' };
        }
        
        revalidatePath('/admin/dashboard');
        return { success: true };

    } catch (error) {
        console.error('Error verifying center:', error);
        return { success: false, error: 'An internal error occurred while verifying the center.' };
    }
}

// Schema for rejecting a center
const rejectCenterSchema = z.object({
  centerId: z.string(),
  adminFirebaseUid: z.string(),
});

// Action to reject and delete a center registration
export async function rejectCenter(data: unknown) {
    const validationResult = rejectCenterSchema.safeParse(data);
    if (!validationResult.success) {
        return { success: false, error: 'Invalid input data.' };
    }

    const { centerId, adminFirebaseUid } = validationResult.data;
     try {
        await dbConnect();

        const adminUser = await User.findOne({ firebaseUid: adminFirebaseUid });
        if (!adminUser || adminUser.role !== 'authority') {
            return { success: false, error: 'Permission denied. Not an administrator.' };
        }

        const center = await Center.findById(centerId);
        if (!center) {
            return { success: false, error: 'Center not found.' };
        }

        // Delete the user from Firebase Authentication
        const auth = await initializeFirebaseAdmin();
        try {
            if (center.uid) {
                await auth.deleteUser(center.uid);
            }
        } catch (authError: any) {
            console.warn(`Could not delete Firebase Auth user ${center.uid}:`, authError.message);
        }

        // Delete the center from MongoDB
        await Center.findByIdAndDelete(centerId);
        
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error('Error rejecting center:', error);
        return { success: false, error: 'An internal error occurred while rejecting the center.' };
    }
}

// Get comprehensive center data (stock, staff, capacity)
export async function getCenterManagementData() {
  try {
    await dbConnect();
    
    const centers = await Center.find({ verified: true }).select('_id center_name email location verified daily_capacity').lean();
    const centerIds = centers.map(c => c._id);
    
    // Get all vaccines for verified centers
    const vaccines = await Vaccine.find({ centerId: { $in: centerIds } }).lean();
    
    // Get all staff for verified centers
    const staff = await Staff.find({ centerId: { $in: centerIds } }).lean();
    
    // Get all vaccine movements
    const movements = await VaccineMovement.find({}).sort({ createdAt: -1 }).limit(100).lean();
    
    return { 
      success: true, 
      data: {
        centers: JSON.parse(JSON.stringify(centers)),
        vaccines: JSON.parse(JSON.stringify(vaccines)),
        staff: JSON.parse(JSON.stringify(staff)),
        movements: JSON.parse(JSON.stringify(movements))
      }
    };
  } catch (error) {
    console.error('Error fetching center management data:', error);
    return { success: false, error: 'Failed to fetch center management data.' };
  }
}

// Get wastage statistics and predictions
export async function getWastageData() {
  try {
    await dbConnect();
    
    const vaccines = await Vaccine.find({}).lean();
    
    // Calculate wastage statistics
    const totalWasted = vaccines.reduce((sum, v) => sum + (v.wastedDoses || 0), 0);
    const totalUsed = vaccines.reduce((sum, v) => sum + (v.usedDoses || 0), 0);
    const totalRemaining = vaccines.reduce((sum, v) => sum + (v.remainingStock || 0), 0);
    const totalStock = vaccines.reduce((sum, v) => sum + (v.totalStock || 0), 0);
    
    const wastageRate = totalStock > 0 ? (totalWasted / totalStock) * 100 : 0;
    
    // Simple prediction: average wastage per day over last 7 days
    // This is a simplified model - you can enhance with ML later
    const recentMovements = await VaccineMovement.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    // Group by center and calculate trends
    const centerWastage: Record<string, any> = {};
    vaccines.forEach(v => {
      const centerId = v.centerId.toString();
      if (!centerWastage[centerId]) {
        centerWastage[centerId] = {
          centerId,
          totalWasted: 0,
          totalUsed: 0,
          totalStock: 0,
          wastageRate: 0
        };
      }
      centerWastage[centerId].totalWasted += v.wastedDoses || 0;
      centerWastage[centerId].totalUsed += v.usedDoses || 0;
      centerWastage[centerId].totalStock += v.totalStock || 0;
    });
    
    // Calculate wastage rate per center
    Object.keys(centerWastage).forEach(centerId => {
      const data = centerWastage[centerId];
      data.wastageRate = data.totalStock > 0 ? (data.totalWasted / data.totalStock) * 100 : 0;
    });
    
    // Simple prediction: if wastage rate > 5%, predict high wastage risk
    const highRiskCenters = Object.values(centerWastage)
      .filter((c: any) => c.wastageRate > 5)
      .map((c: any) => ({
        ...c,
        predictedWastage: c.totalStock * 0.1, // Predict 10% of current stock
        riskLevel: 'High'
      }));
    
    return {
      success: true,
      data: {
        totalWasted,
        totalUsed,
        totalRemaining,
        totalStock,
        wastageRate: wastageRate.toFixed(2),
        highRiskCenters,
        centerWastage: Object.values(centerWastage)
      }
    };
  } catch (error) {
    console.error('Error fetching wastage data:', error);
    return { success: false, error: 'Failed to fetch wastage data.' };
  }
}

// Record vaccine movement
export async function recordVaccineMovement(data: unknown) {
  const schema = z.object({
    fromCenterId: z.string().nullable().transform((val) => val === '' ? null : val),
    toCenterId: z.string().min(1, 'Destination center is required'),
    vaccineName: z.string().min(1, 'Vaccine name is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    movementType: z.enum(['hub_to_center', 'center_to_center', 'center_to_hub']),
    reason: z.string().optional(),
    movedBy: z.string().min(1, 'Moved by field is required'),
    temperatureMaintained: z.boolean().default(true),
    expiryDate: z.date().optional(),
    batchNumber: z.string().optional(),
  });
  
  const validationResult = schema.safeParse(data);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => e.message).join(', ');
    console.error('Validation errors:', validationResult.error.errors);
    return { success: false, error: `Validation failed: ${errorMessages}` };
  }
  
  try {
    await dbConnect();
    
    // Convert string IDs to ObjectId if they're strings
    const movementData: any = {
      ...validationResult.data,
      toCenterId: validationResult.data.toCenterId,
      fromCenterId: validationResult.data.fromCenterId || null,
    };

    // Verify the destination center exists
    const toCenter = await Center.findById(movementData.toCenterId);
    if (!toCenter) {
      return { success: false, error: 'Destination center not found.' };
    }

    // Verify the source center exists if provided
    if (movementData.fromCenterId) {
      const fromCenter = await Center.findById(movementData.fromCenterId);
      if (!fromCenter) {
        return { success: false, error: 'Source center not found.' };
      }
    }
    
    const movement = new VaccineMovement(movementData);
    await movement.save();
    
    // Update stock at destination center
    if (movementData.movementType !== 'center_to_hub') {
      const vaccine = await Vaccine.findOne({
        centerId: movementData.toCenterId,
        vaccineName: movementData.vaccineName
      });
      
      if (vaccine) {
        vaccine.remainingStock += movementData.quantity;
        vaccine.totalStock += movementData.quantity;
        await vaccine.save();
      } else {
        // Create new vaccine entry
        const newVaccine = new Vaccine({
          centerId: movementData.toCenterId,
          vaccineName: movementData.vaccineName,
          totalStock: movementData.quantity,
          remainingStock: movementData.quantity,
          usedDoses: 0,
          wastedDoses: 0
        });
        await newVaccine.save();
      }
    }
    
    // Update stock at source center if moving from center
    if (movementData.fromCenterId && movementData.movementType === 'center_to_center') {
      const sourceVaccine = await Vaccine.findOne({
        centerId: movementData.fromCenterId,
        vaccineName: movementData.vaccineName
      });
      
      if (sourceVaccine) {
        if (sourceVaccine.remainingStock >= movementData.quantity) {
          sourceVaccine.remainingStock -= movementData.quantity;
          await sourceVaccine.save();
        } else {
          return { 
            success: false, 
            error: `Insufficient stock at source center. Available: ${sourceVaccine.remainingStock}, Requested: ${movementData.quantity}` 
          };
        }
      } else {
        return { 
          success: false, 
          error: `Vaccine '${movementData.vaccineName}' not found at source center.` 
        };
      }
    }
    
    revalidatePath('/admin/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error recording vaccine movement:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to record vaccine movement.' 
    };
  }
}
