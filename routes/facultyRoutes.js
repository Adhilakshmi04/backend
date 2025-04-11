import express from "express";
import { verifyRole } from "../middlewares/verifyRole.js";
import { transporter } from "../config/nodemailer.js";
import Course from "../models/Course.js";
import User from "../models/User.js"; 
import CourseMaterial from "../models/CourseMaterial.js";
import multer from "multer";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import { request } from "http";
import Student from "../models/Student.js";
dotenv.config();


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  // Accept all file types
});

const uploadToCloudinary = (fileBuffer, originalFilename) => {
  // Extract file extension to preserve it in Cloudinary
  const fileExtension = path.extname(originalFilename);
  const publicId = `file_uploads/${Date.now()}_${path.basename(originalFilename, fileExtension)}`;
  
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto", // Allow any file type detection
        folder: "file_uploads",
        public_id: publicId,
        use_filename: true,
        unique_filename: true,
        format: fileExtension.replace('.', ''), // Preserve file extension
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary Upload Error:", error);
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            originalFilename,
            format: fileExtension,
            resource_type: result.resource_type
          });
        }
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};


const router = express.Router();
const CO_PATTERN = /^CO-\d+$/;

router.post("/create-course", verifyRole("faculty"), async (req, res) => {
  const { title, description, department } = req.body;
  const facultyId = req.user.id;

  try {
    if (!title || !description || !department) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    const course = new Course({
      title,
      description,
      department,
      faculty: facultyId,
    });

    await course.save();
    res.status(201).json({ success: true, message: "Course created successfully.", course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to create course.", error: error.message });
  }
});

router.get("/my-courses", verifyRole("faculty"), async (req, res) => {
  try {
    const courses = await Course.find({ faculty: req.user.id });
    res.status(200).json({ success: true, courses });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: "Failed to fetch courses.", error: error.message });
  }
});


router.get("/course/:courseId", verifyRole("faculty"), async (req, res) => {
  const { courseId } = req.params;

  try {
    const course = await Course.findById(courseId).populate("students", "name email");
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    if (course.faculty.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized access to the course" });
    }

    res.status(200).json({ success: true, course });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch course details", error: error.message });
  }
});

router.post("/course/:courseId/add-student", verifyRole("faculty"), async (req, res) => {
  const { courseId } = req.params;
  const { email } = req.body; 
  const errors = [];
  const addedStudents = [];

  for (const e of email) {
    try {
      const student = await User.findOne({ email: e.trim() });
      if (!student || student.role !== "student") {
        errors.push({ email: e, message: "Student not found or invalid role" });
        continue;
      }

      const course = await Course.findById(courseId);
      if (!course) {
        errors.push({ email: e, message: "Course not found" });
        continue;
      }

      if (course.students.includes(student._id)) {
        errors.push({ email: e, message: "Student is already enrolled in this course" });
        continue;
      }

      // Add student to course
      course.students.push(student._id);
      await course.save();

      const faculty = await User.findById(req.user.id);

      // Email options
      const mailOptions = {
        from: process.env.EMAIL,
        to: student.email,
        subject: `Welcome to ${course.title}!`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #444; font-weight: bold; text-align: center;">Welcome to ${course.title}!</h2>
            <p><strong>Dear ${student.name},</strong></p>
            <p><strong>You have been successfully enrolled in the course <span style="color: #007BFF;">"${course.title}"</span> by your faculty member <span style="color: #007BFF;">${faculty.name}</span>.</strong></p>
            <p><strong>This course is designed to help you excel and grow in your learning journey. Please log in to your EduSpace account to access the course materials, assignments, and more.</strong></p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://eduspace-portal.com/courses/${course._id}" style="display: inline-block; padding: 10px 20px; font-size: 16px; font-weight: bold; color: #fff; background-color: #007BFF; text-decoration: none; border-radius: 4px;">Access Course</a>
            </div>
            <p style="font-weight: bold;">If the button above doesn’t work, use the link below:</p>
            <p style="word-wrap: break-word; font-weight: bold; color: #007BFF;">https://eduspace-portal.com/courses/${course._id}</p>
            <p><strong>We’re excited to have you onboard, and we wish you great success in your studies!</strong></p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="font-size: 14px; color: #666;"><strong>Please do not reply to this email, as this mailbox is not monitored.</strong></p>
            <p style="font-size: 14px; color: #666;"><strong>Thank you,<br>EduSpace Team</strong></p>
          </div>
        `,
      };
      

      await transporter.sendMail(mailOptions);

      addedStudents.push({
        email: student.email,
        message: `Student ${student.name} (${student.email}) added successfully.`,
        student: { _id: student._id, name: student.name, email: student.email },
      });
    } catch (error) {
      console.error(`Error processing email ${e}:`, error.message);
      errors.push({ email: e, message: error.message });
    }
  }

  res.json({
    success: addedStudents.length > 0,
    addedStudents,
    errors,
  });
});


router.post("/add-materials", upload.single("fileUrl"), async (req, res) => {
  try {
    const { courseId, CO, title, description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: "File is required." });
    }
    
    // Check if all required fields are present
    if (!courseId || !CO || !title) {
      return res.status(400).json({ success: false, message: "Course ID, CO, and title are required." });
    }
    if (!CO_PATTERN.test(CO)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Course Outcome (CO) format. Use CO-1, CO-2, etc.",
      });
    }

    // Upload file to Cloudinary
    const fileUploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    console.log("File uploaded to Cloudinary:", fileUploadResult);
    
    // Find or create course material document
    let courseMaterial = await CourseMaterial.findOne({ courseId });
    
    //Prepare the material object with ALL required fields
    const materialObject = { 
      CO, 
      title, 
      description: description || "", // Default to empty string if not provided
      fileUrl: fileUploadResult.url
    };
    
    if (!courseMaterial) {
    //Create new course material document
      courseMaterial = new CourseMaterial({
        courseId,
        materials: [materialObject]
      });
    } else {
     // Add to existing course material document
      courseMaterial.materials.push(materialObject);
    }
    
     await courseMaterial.save();
    
     // Log successful save
    console.log("Course material saved successfully:", {
      courseId,
      CO,
      title,
    });
    
    res.status(201).json({ success: true, message: "Course material added successfully!" , material:materialObject });
  } catch (error) {
    console.error("Error adding course material:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error adding course material", 
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        path: key,
        message: error.errors[key].message
      })) : null
    });
  }
});


// Add a route to download files
router.get("/course-materials/:courseId", async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // Validate courseId
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid course ID format" 
      });
    }
    
    // Find course materials
    const courseMaterial = await CourseMaterial.findOne({ courseId });
    
    if (!courseMaterial) {
      return res.status(200).json({ 
        success: true, 
        message: "No materials found for this course", 
        materials: [] 
      });
    }
    
    // Return the materials array
    res.status(200).json({ 
      success: true, 
      materials: courseMaterial.materials 
    });
    
  } catch (error) {
    console.error("Error fetching course materials:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching course materials", 
      error: error.message 
    });
  }
});


router.delete("/delete-material/:courseId/:materialId", async (req, res) => {
  try {
    const { courseId, materialId } = req.params;
    
    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(materialId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid ID format" 
      });
    }
    
    const courseMaterial = await CourseMaterial.findOne({ courseId });
    
    if (!courseMaterial) {
      return res.status(404).json({ 
        success: false, 
        message: "Course material not found" 
      });
    }
    
    const materialIndex = courseMaterial.materials.findIndex(
      material => material._id.toString() === materialId
    );
    
    if (materialIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Material not found in this course" 
      });
    }
    const fileUrl = courseMaterial.materials[materialIndex].fileUrl;
    courseMaterial.materials.splice(materialIndex, 1);
    await courseMaterial.save();
    res.status(200).json({ 
      success: true, 
      message: "Material deleted successfully" 
    });
    
  } catch (error) {
    console.error("Error deleting course material:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error deleting course material", 
      error: error.message 
    });
  }
});


router.post("/add-assignments", async (req, res) => {
  try {
    const { courseId, co, title, description, dueDate } = req.body;

    if (!courseId || !co || !title || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "courseId, co, title, and dueDate are required.",
      });
    }

    if (!CO_PATTERN.test(co)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Course Outcome (CO) format. Use CO-1, CO-2, etc.",
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    const assignment = {
      co,
      title,
      description,
      dueDate,
      submissions: [],
    };

    course.assignments.push(assignment);
    await course.save();

    return res.status(201).json({
      success: true,
      message: "Assignment added successfully.",
      assignment,
    });
  } catch (error) {
    console.error("Error adding assignment:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while adding the assignment.",
      error: error.message,
    });
  }
});


router.get("/course-assignments/:courseId", async (req, res) => {
  try{
    const {courseId}=req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid course ID format" 
      });
    }
    const course=await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: "Course not found" 
      });
    }
    res.status(200).json({
      success: true,
      assignments: course.assignments
    });
  }
  catch(error){
    console.error("Error fetching assignments:",error);
    res.status(500).json({
      success:false,
      message: "Error fetching assignments", 
      error: error.message 
    })
  }
});


router.delete("/delete-assignment/:courseId/:assignmentId", async (req, res) => {
  try {
    const { courseId, assignmentId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    // Find the assignment within the course
    const assignmentIndex = course.assignments.findIndex(
      (assignment) => assignment._id.toString() === assignmentId
    );
    if (assignmentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found in this course",
      });
    }

    // Remove the assignment
    course.assignments.splice(assignmentIndex, 1);
    await course.save();

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting course assignment:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting assignment",
      error: error.message,
    });
  }
});

router.delete('/course/:courseId/remove-student/:studentId', async (req, res) => {
  const { courseId, studentId } = req.params;

  try {
    // Check if courseId is valid
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID format' });
    }

    // Check if studentId is valid
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format' });
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if the student is in the course
    if (!course.students.includes(studentId)) {
      return res.status(400).json({ success: false, message: 'Student not enrolled in this course' });
    }

    // Remove the student from the course
    course.students = course.students.filter(id => id.toString() !== studentId);
    await course.save();

    return res.status(200).json({ success: true, message: 'Student removed from course successfully' });
  } catch (error) {
    console.error('Error removing student from course:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


export default router;