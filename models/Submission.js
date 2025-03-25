import mongoose from "mongoose";

export const submissionSchema = new mongoose.Schema({ // Export the schema separately
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submittedAt: { type: Date, default: Date.now },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Graded'], default: 'Pending' },
    grade: { type: Number, min: 0, max: 100 },
    feedback: { type: String }
});

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;