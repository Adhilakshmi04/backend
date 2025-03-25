import express from "express";
import Batch from "../models/Batch.js";
const router=express.Router();
router.get("/students",async(req,res)=>{
    try{
        const Batches=await Batch.find();
        res.status(200).json(Batches);
    }
    catch(error){
        res.status(500).json({success:true,message:"Error fetching batches"});
    }
});


router.get("/emails/:batchName",async(req,res)=>{
    try{
       const {batchName}=req.params;
       const batch = await Batch.findOne({ batchName }, "students.email");
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    const emails = batch.students.map(student => student.email);
    console.log("i am:",emails);
    res.status(200).json({success:true,emails:emails});
  } catch (error) {
    res.status(500).json({ message: "Error fetching emails", error });
  }
});

export default router;