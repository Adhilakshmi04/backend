import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
    id:{type:String,required:true,unique: true},
    name:{type:String,required:true},
    email: { type: String, required: true, unique: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    department:{type:String,required:true}
});

export default mongoose.model("Student", studentSchema);
