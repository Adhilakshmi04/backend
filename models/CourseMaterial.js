import mongoose from "mongoose";

const courseMaterialSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  materials: [
    {
      CO: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      description: {
        type: String,
      },
      fileUrl: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      }
    }
  ]
}, { timestamps: true });

const CourseMaterial = mongoose.model("CourseMaterial", courseMaterialSchema);

export default CourseMaterial;