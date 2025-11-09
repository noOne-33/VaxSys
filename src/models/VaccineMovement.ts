import mongoose, { Document, Schema, models, model } from 'mongoose';

export interface IVaccineMovement extends Document {
  fromCenterId: mongoose.Schema.Types.ObjectId | null; // null if from hub
  toCenterId: mongoose.Schema.Types.ObjectId;
  vaccineName: string;
  quantity: number;
  movementType: 'hub_to_center' | 'center_to_center' | 'center_to_hub';
  reason?: string;
  movedBy: string; // Admin or center name
  temperatureMaintained: boolean;
  expiryDate?: Date;
  batchNumber?: string;
}

const VaccineMovementSchema: Schema = new Schema({
  fromCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', default: null },
  toCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Center', required: true },
  vaccineName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  movementType: { 
    type: String, 
    required: true, 
    enum: ['hub_to_center', 'center_to_center', 'center_to_hub'] 
  },
  reason: { type: String },
  movedBy: { type: String, required: true },
  temperatureMaintained: { type: Boolean, default: true },
  expiryDate: { type: Date },
  batchNumber: { type: String },
}, { 
  timestamps: true 
});

export default models.VaccineMovement || model<IVaccineMovement>('VaccineMovement', VaccineMovementSchema);
