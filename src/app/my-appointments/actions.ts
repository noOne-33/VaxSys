'use server';

import dbConnect from '@/lib/dbConnect';
import Citizen from '@/models/Citizen';
import Appointment from '@/models/Appointment';
import Center from '@/models/Center';
import mongoose from 'mongoose';

export async function getUserAppointments(userEmail: string) {
    try {
        await dbConnect();
        
        // Find citizen by email (contact field)
        const citizen = await Citizen.findOne({ contact: userEmail }).lean();
        
        if (!citizen) {
            // No citizen found with this email - user hasn't registered as citizen yet
            return { success: true, appointments: [], citizen: null };
        }
        
        // Convert citizen._id to ObjectId if it's a string
        const citizenObjectId = typeof citizen._id === 'string' 
            ? new mongoose.Types.ObjectId(citizen._id) 
            : citizen._id;

        // Find all appointments for this citizen
        const appointments = await Appointment.find({ citizenId: citizenObjectId })
            .populate('centerId', 'center_name location phone email')
            .sort({ appointmentDate: 1 }) // Sort by date ascending (earliest first)
            .lean();
        
        return { 
            success: true, 
            appointments: JSON.parse(JSON.stringify(appointments)),
            citizen: JSON.parse(JSON.stringify(citizen))
        };
    } catch (error) {
        console.error('Error fetching user appointments:', error);
        return { success: false, error: 'Failed to fetch appointments.' };
    }
}

