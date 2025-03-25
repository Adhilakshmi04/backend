import mongoose from "mongoose";
import { submissionSchema } from "./Submission.js"; 

export const assignmentSchema = new mongoose.Schema({
    co:{ type: String, required: true},
    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: Date, required: true },
    submissions: [submissionSchema], 
});

const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;