const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const PDFDocument = require("pdfkit");
const Submission = require("../models/Submission");
const {
  authenticateToken,
  requireAdmin,
  requirePatient,
} = require("../middleware/auth");

const router = express.Router();
const uploadDir = path.join(os.tmpdir(), "images");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only JPEG, JPG, and PNG images are allowed"));
    }
  },
});

router.post(
  "/upload",
  authenticateToken,
  requirePatient,
  upload.array("images", 3),
  async (req, res) => {
    try {
      const { patientName, mobileNumber, email, note } = req.body;

      if (!patientName || !mobileNumber || !email) {
        return res.status(400).json({
          message: "Patient name, mobile number, and email are required",
          missingFields: {
            patientName: !patientName,
            mobileNumber: !mobileNumber,
            email: !email,
          },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res
          .status(400)
          .json({ message: "Please provide a valid email address" });
      }

      const mobileRegex = /^[0-9]{10,15}$/;
      if (!mobileRegex.test(mobileNumber.replace(/[\s\-\+\(\)]/g, ""))) {
        return res
          .status(400)
          .json({ message: "Please provide a valid mobile number" });
      }

      if (!req.files || req.files.length !== 3) {
        return res.status(400).json({
          message:
            "Exactly 3 images are required in order: 1) Upper teeth, 2) Front teeth, 3) Lower teeth",
          currentCount: req.files ? req.files.length : 0,
          requiredCount: 3,
        });
      }

      const originalImagePaths = req.files.map((file) => file.path);

      const submission = new Submission({
        patientName,
        mobileNumber,
        email,
        note: note || "",
        userId: req.user._id,
        originalImagePaths,
        uploadedAt: new Date(),
      });

      await submission.save();

      res.status(201).json({
        message: "Submission uploaded successfully",
        submission: {
          _id: submission._id,
          patientName: submission.patientName,
          mobileNumber: submission.mobileNumber,
          patientId: submission.mobileNumber,
          email: submission.email,
          note: submission.note,
          status: submission.status,
          uploadedAt: submission.uploadedAt,
          originalImagePaths: submission.originalImagePaths.map(
            (imagePath) => `/uploads/images/${path.basename(imagePath)}`
          ),
          imageCount: 3,
          imageOrder: ["Upper Teeth", "Front Teeth", "Lower Teeth"],
        },
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Server error during upload" });
    }
  }
);

router.get(
  "/my-submissions",
  authenticateToken,
  requirePatient,
  async (req, res) => {
    try {
      const submissions = await Submission.find({ userId: req.user._id }).sort({
        uploadedAt: -1,
      });

      const submissionsWithUrls = submissions.map((submission) => {
        const originalPaths =
          submission.originalImagePaths &&
          submission.originalImagePaths.length > 0
            ? submission.originalImagePaths
            : submission.originalImagePath
            ? [submission.originalImagePath]
            : [];

        const annotatedPaths =
          submission.annotatedImagePaths &&
          submission.annotatedImagePaths.length > 0
            ? submission.annotatedImagePaths
            : submission.annotatedImagePath
            ? [submission.annotatedImagePath]
            : [];

        return {
          _id: submission._id,
          patientName: submission.patientName,
          mobileNumber: submission.mobileNumber,
          patientId: submission.mobileNumber,
          email: submission.email,
          note: submission.note,
          status: submission.status,
          uploadedAt: submission.uploadedAt,
          annotatedAt: submission.annotatedAt,
          reportGeneratedAt: submission.reportGeneratedAt,
          originalImagePaths: originalPaths
            .filter(Boolean)
            .map((imagePath) => `/uploads/images/${path.basename(imagePath)}`),
          annotatedImagePaths: annotatedPaths
            .filter(Boolean)
            .map(
              (imagePath) =>
                `/uploads/annotated-images/${path.basename(imagePath)}`
            ),
          reportPath: submission.reportPath
            ? `/uploads/reports/${path.basename(submission.reportPath)}`
            : null,
          treatmentRecommendations: submission.treatmentRecommendations,
          imageCount: originalPaths.filter(Boolean).length,
        };
      });

      res.json({ submissions: submissionsWithUrls });
    } catch (error) {
      console.error("Error fetching user submissions:", error);
      res.status(500).json({ message: "Server error fetching submissions" });
    }
  }
);

router.get("/all", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const submissions = await Submission.find()
      .populate("userId", "name email")
      .populate("annotatedBy", "name email")
      .sort({ uploadedAt: -1 });

    const submissionsWithUrls = submissions.map((submission) => {
      const originalPaths =
        submission.originalImagePaths &&
        submission.originalImagePaths.length > 0
          ? submission.originalImagePaths
          : submission.originalImagePath
          ? [submission.originalImagePath]
          : [];

      const annotatedPaths =
        submission.annotatedImagePaths &&
        submission.annotatedImagePaths.length > 0
          ? submission.annotatedImagePaths
          : submission.annotatedImagePath
          ? [submission.annotatedImagePath]
          : [];

      return {
        _id: submission._id,
        patientName: submission.patientName,
        mobileNumber: submission.mobileNumber,
        patientId: submission.mobileNumber,
        email: submission.email,
        note: submission.note,
        status: submission.status,
        uploadedAt: submission.uploadedAt,
        annotatedAt: submission.annotatedAt,
        reportGeneratedAt: submission.reportGeneratedAt,
        originalImagePaths: originalPaths
          .filter(Boolean)
          .map((imagePath) => `/uploads/images/${path.basename(imagePath)}`),
        annotatedImagePaths: annotatedPaths
          .filter(Boolean)
          .map(
            (imagePath) =>
              `/uploads/annotated-images/${path.basename(imagePath)}`
          ),
        reportPath: submission.reportPath
          ? `/uploads/reports/${path.basename(submission.reportPath)}`
          : null,
        treatmentRecommendations: submission.treatmentRecommendations,
        userId: submission.userId,
        annotatedBy: submission.annotatedBy,
        imageCount: originalPaths.filter(Boolean).length,
      };
    });

    res.json({ submissions: submissionsWithUrls });
  } catch (error) {
    console.error("Error fetching all submissions:", error);
    res.status(500).json({ message: "Server error fetching submissions" });
  }
});

router.get("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate("userId", "name email")
      .populate("annotatedBy", "name email");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Handle both old (single image) and new (multiple images) formats
    const originalPaths =
      submission.originalImagePaths && submission.originalImagePaths.length > 0
        ? submission.originalImagePaths
        : submission.originalImagePath
        ? [submission.originalImagePath]
        : [];

    const annotatedPaths =
      submission.annotatedImagePaths &&
      submission.annotatedImagePaths.length > 0
        ? submission.annotatedImagePaths
        : submission.annotatedImagePath
        ? [submission.annotatedImagePath]
        : [];

    const submissionWithUrls = {
      _id: submission._id,
      patientName: submission.patientName,
      mobileNumber: submission.mobileNumber,
      patientId: submission.mobileNumber,
      email: submission.email,
      note: submission.note,
      status: submission.status,
      uploadedAt: submission.uploadedAt,
      annotatedAt: submission.annotatedAt,
      reportGeneratedAt: submission.reportGeneratedAt,
      originalImagePaths: originalPaths
        .filter(Boolean)
        .map((imagePath) => `/uploads/images/${path.basename(imagePath)}`),
      annotatedImagePaths: annotatedPaths
        .filter(Boolean)
        .map(
          (imagePath) => `/uploads/annotated-images/${path.basename(imagePath)}`
        ),
      reportPath: submission.reportPath
        ? `/uploads/reports/${path.basename(submission.reportPath)}`
        : null,
      treatmentRecommendations: submission.treatmentRecommendations,
      annotationData: submission.annotationData,
      userId: submission.userId,
      annotatedBy: submission.annotatedBy,
      imageCount: originalPaths.filter(Boolean).length,
      originalImagePath:
        originalPaths.length > 0
          ? `/uploads/images/${path.basename(originalPaths[0])}`
          : null,
      annotatedImagePath:
        annotatedPaths.length > 0
          ? `/uploads/annotated-images/${path.basename(annotatedPaths[0])}`
          : null,
    };

    res.json({ submission: submissionWithUrls });
  } catch (error) {
    console.error("Error fetching submission:", error);
    res.status(500).json({ message: "Server error fetching submission" });
  }
});

router.post(
  "/:id/annotate",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        annotationData,
        treatmentRecommendations,
        annotatedImageDataUrl,
        annotatedImageIndex,
      } = req.body;

      const submission = await Submission.findById(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      const existingAnnotatedImagePaths = submission.annotatedImagePaths || [];
      const updatedAnnotatedImagePaths = [...existingAnnotatedImagePaths];
      const outDir = path.join(os.tmpdir(), "annotated-images");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const idx = Number(annotatedImageIndex);
      if (annotatedImageDataUrl && Number.isFinite(idx)) {
        const base64Data = annotatedImageDataUrl.replace(
          /^data:image\/png;base64,/,
          ""
        );
        const filename = `annotated-${Date.now()}-${idx}-${Math.round(
          Math.random() * 1e9
        )}.png`;
        const filepath = path.join(outDir, filename);
        while (updatedAnnotatedImagePaths.length <= idx) {
          updatedAnnotatedImagePaths.push(null);
        }
        fs.writeFileSync(filepath, base64Data, "base64");
        updatedAnnotatedImagePaths[idx] = filepath;
      } else if (annotatedImageDataUrl) {
        const base64Data = annotatedImageDataUrl.replace(
          /^data:image\/png;base64,/,
          ""
        );
        const filename = `annotated-${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}.png`;
        const filepath = path.join(outDir, filename);
        fs.writeFileSync(filepath, base64Data, "base64");
        updatedAnnotatedImagePaths.push(filepath);
      }

      submission.annotationData = Array.isArray(annotationData)
        ? annotationData
        : [];
      submission.annotatedImagePaths = updatedAnnotatedImagePaths;
      if (updatedAnnotatedImagePaths.length > 0) {
        submission.annotatedImagePath = updatedAnnotatedImagePaths[0];
      }
      submission.treatmentRecommendations = treatmentRecommendations;
      submission.status = "annotated";
      submission.annotatedAt = new Date();
      submission.annotatedBy = req.user._id;

      await submission.save();

      res.json({
        message: "Annotation saved successfully",
        submission: {
          _id: submission._id,
          status: submission.status,
          annotatedAt: submission.annotatedAt,
          annotatedImagePaths: updatedAnnotatedImagePaths
            .filter(Boolean)
            .map(
              (filepath) =>
                `/uploads/annotated-images/${path.basename(filepath)}`
            ),
          treatmentRecommendations: submission.treatmentRecommendations,
          imageCount: updatedAnnotatedImagePaths.filter(Boolean).length,
        },
      });
    } catch (error) {
      console.error("Error saving annotation:", error);
      res.status(500).json({ message: "Server error saving annotation" });
    }
  }
);

router.post(
  "/:id/generate-report",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const submission = await Submission.findById(req.params.id).populate(
        "annotatedBy",
        "name email"
      );

      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      if (submission.status !== "annotated") {
        return res
          .status(400)
          .json({
            message: "Submission must be annotated before generating report",
          });
      }

      const annotatedPaths = (
        submission.annotatedImagePaths && submission.annotatedImagePaths.length
          ? submission.annotatedImagePaths
          : []
      )
        .filter(Boolean)
        .slice(0, 3);
      if (annotatedPaths.length < 3) {
        return res
          .status(400)
          .json({
            message:
              "Annotated images are required to generate the report (all three views).",
          });
      }

      const reportsDir = path.join(os.tmpdir(), "reports");
      if (!fs.existsSync(reportsDir))
        fs.mkdirSync(reportsDir, { recursive: true });

      const filename = `report-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}.pdf`;
      const filepath = path.join(reportsDir, filename);

      const doc = new PDFDocument({
        size: "A4",
        margin: 24,
        compress: true,
        bufferPages: false,
      });
      const outStream = fs.createWriteStream(filepath);
      doc.pipe(outStream);

      const COLORS = {
        purple: "#7C3AED",
        lightSection: "#F3F4F6",
        text: "#111827",
        muted: "#6B7280",
        border: "#E5E7EB",
        orange: "#F59E0B",
        red: "#DC2626",
        amber: "#D97706",
      };

      const drawRoundedRect = (x, y, w, h, r, fill, stroke) => {
        doc.save();
        doc.roundedRect(x, y, w, h, r);
        if (fill) doc.fill(fill);
        else doc.stroke(stroke || COLORS.border);
        doc.restore();
      };

      const drawPill = (x, y, w, h, color, label) => {
        doc.save();
        doc.roundedRect(x, y, w, h, h / 2).fill(color);
        doc
          .fillColor("white")
          .fontSize(10)
          .text(label, x, y + (h - 12) / 2, { width: w, align: "center" });
        doc.restore();
      };

      doc.rect(0, 0, doc.page.width, 120).fill(COLORS.purple);
      doc.fillColor("white");
      doc
        .fontSize(26)
        .text("Oral Health Screening", 0, 30, { align: "center" });
      doc.fontSize(22).text("Report", 0, 64, { align: "center" });

      doc.fillColor(COLORS.text).fontSize(10);
      const infoY = 135;
      doc.text(`Name:  ${submission.patientName || "-"}`, 28, infoY);
      doc.text(
        `Phone: ${submission.mobileNumber || submission.patientId || "-"}`,
        220,
        infoY
      );
      doc.text(`Date:  ${new Date().toLocaleDateString("en-GB")}`, 420, infoY);

      const cardX = 18;
      const cardY = 158;
      const cardW = doc.page.width - cardX * 2;
      const cardH = 255;
      drawRoundedRect(cardX, cardY, cardW, cardH, 8, COLORS.lightSection);

      doc
        .fontSize(11)
        .fillColor(COLORS.text)
        .text("SCREENING REPORT:", cardX + 14, cardY + 12);

      const slotY = cardY + 34;
      const slotH = 120;
      const slotW = 165;
      const gap = 24;
      const firstX = (doc.page.width - (slotW * 3 + gap * 2)) / 2;

      const sources = [0, 1, 2].map((i) =>
        annotatedPaths[i] && fs.existsSync(annotatedPaths[i])
          ? annotatedPaths[i]
          : null
      );

      const labels = ["Upper Teeth", "Front Teeth", "Lower Teeth"];
      const labelColors = [COLORS.red, COLORS.amber, COLORS.red];

      for (let i = 0; i < 3; i++) {
        const x = firstX + i * (slotW + gap);
        drawRoundedRect(x, slotY, slotW, slotH, 8, "white", COLORS.border);
        const img = sources[i];
        if (img) {
          try {
            doc.image(img, x + 6, slotY + 6, {
              fit: [slotW - 12, slotH - 12],
              align: "center",
              valign: "center",
            });
          } catch (e) {
            doc
              .fontSize(9)
              .fillColor(COLORS.muted)
              .text("Image not available", x, slotY + slotH / 2 - 5, {
                width: slotW,
                align: "center",
              });
          }
        } else {
          doc
            .fontSize(9)
            .fillColor(COLORS.muted)
            .text("Image not available", x, slotY + slotH / 2 - 5, {
              width: slotW,
              align: "center",
            });
        }
        drawPill(
          x + (slotW - 92) / 2,
          slotY + slotH + 10,
          92,
          20,
          labelColors[i],
          labels[i]
        );
      }

      const legendY = slotY + slotH + 44;
      const legendItems = [
        ["#4B275A", "Inflamed / Red gums"],
        ["#F6C33B", "Misaligned"],
        ["#71B17C", "Receded gums"],
        ["#E65050", "Stains"],
        ["#2AB6C9", "Attrition"],
        ["#E23C83", "Crowns"],
      ];

      const legendStartX = cardX + 20;
      const availableWidth = cardW - 40;
      const legendGap = availableWidth / 6;

      for (let i = 0; i < legendItems.length; i++) {
        const lx = legendStartX + i * legendGap;
        doc.rect(lx, legendY + 2, 10, 10).fill(legendItems[i][0]);
        doc
          .fillColor(COLORS.muted)
          .fontSize(8)
          .text(legendItems[i][1], lx + 16, legendY, { width: legendGap - 20 });
      }

      doc.rect(cardX, cardY + cardH - 6, cardW, 6).fill(COLORS.orange);

      const trTitleY = cardY + cardH + 18;
      doc
        .fillColor("#0F3B62")
        .fontSize(11)
        .text("TREATMENT RECOMMENDATIONS:", cardX + 12, trTitleY);

      const listY = trTitleY + 20;
      const rows = [
        ["#4B275A", "Inflamed or Red\ngums", "Scaling."],
        ["#F6C33B", "Misaligned", "Braces or Clear Aligner"],
        ["#71B17C", "Receded gums", "Gum Surgery."],
        ["#E65050", "Stains", "Teeth cleaning and polishing."],
        ["#2AB6C9", "Attrition", "Filling/ Night Guard."],
        [
          "#E23C83",
          "Crowns",
          "If the crown is loose or broken, better get it checked. Teeth coloured caps are the best ones.",
        ],
      ];

      let y = listY;
      for (const [color, condition, recommendation] of rows) {
        doc.rect(cardX + 12, y + 3, 10, 10).fill(color);
        doc
          .fillColor(COLORS.text)
          .fontSize(8)
          .text(condition, cardX + 30, y, { width: 90 });
        doc.text(":", cardX + 130, y);
        doc
          .fontSize(9)
          .fillColor(COLORS.text)
          .text(recommendation, cardX + 145, y, {
            width: doc.page.width - (cardX + 145) - 20,
          });
        y += 22;
      }

      doc
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Report generated by: ${
            submission.annotatedBy?.name || "Healthcare Professional"
          } | ${new Date().toLocaleString()}`,
          cardX + 12,
          doc.page.height - 34,
          { width: doc.page.width - 2 * (cardX + 12) }
        );

      doc.end();

      await new Promise((resolve, reject) => {
        outStream.on("finish", resolve);
        outStream.on("error", reject);
      });

      submission.reportPath = filepath;
      submission.reportUrl = `/uploads/reports/${filename}`;
      submission.status = "reported";
      submission.reportGeneratedAt = new Date();
      await submission.save();

      res.json({
        message: "Report generated successfully",
        reportUrl: submission.reportUrl,
        submission: {
          _id: submission._id,
          status: submission.status,
          reportGeneratedAt: submission.reportGeneratedAt,
          reportUrl: submission.reportUrl,
        },
      });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ message: "Server error generating report" });
    }
  }
);

module.exports = router;
