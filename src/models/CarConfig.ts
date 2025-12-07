import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PriceAdjustmentSchema = new Schema(
  {
    attribute: { type: String, required: true },
    options: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const CarConfigSchema = new Schema(
  {
    brand: { type: String, required: true },
    model: { type: String, required: true },
    variant: { type: String, required: true },
    fuel_type: { type: String, enum: ["Petrol", "Diesel", "Hybrid", "EV"], required: true },
    transmission_type: { type: String, enum: ["Manual", "Automatic", "CVT", "DCT"], required: true },
    exterior_color: { type: String, required: true },
    wheel_size_inch: { type: Number },
    roof_type: { type: String, enum: ["None", "Sunroof", "Panoramic"] },
    upholstery_material: { type: String, enum: ["Fabric", "Leatherette", "Leather"] },
    infotainment_screen_size: { type: Number },
    speaker_count: { type: Number },
    airbags_count: { type: Number },
    ADAS_package: { type: String, enum: ["None", "Basic", "Advanced"], default: "None" },
    ex_showroom_price: { type: Number },
    on_road_price: { type: Number },
    price_adjustments: { type: [PriceAdjustmentSchema], default: [] },
  },
  { timestamps: true }
);

export type PriceAdjustment = InferSchemaType<typeof PriceAdjustmentSchema>;
export type CarConfigDocument = InferSchemaType<typeof CarConfigSchema>;

export const CarConfig: Model<CarConfigDocument> =
  mongoose.models.CarConfig || mongoose.model<CarConfigDocument>("CarConfig", CarConfigSchema);
