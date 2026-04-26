"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const scorer_1 = require("../lib/scorer");
const fs = __importStar(require("fs"));
const candidates = JSON.parse(fs.readFileSync(__dirname + "/../data/candidates.json", "utf8"));
const jd = {
    jobTitle: "Senior React Developer",
    requiredSkills: ["React", "TypeScript", "Node.js", "REST APIs"],
    niceToHaveSkills: ["AWS", "Cloud platforms"],
    experienceYearsRequired: 4,
    domain: "",
    educationRequirement: "",
    salaryRange: "18-25 LPA",
    location: "Remote-friendly",
    responsibilities: [],
    seniorityLevel: "Senior",
    rawText: "Sample JD",
};
const results = candidates.map(c => (0, scorer_1.scoreCandidate)(c, jd)).sort((a, b) => b.matchScore - a.matchScore);
console.log("RANKED:");
for (const r of results)
    console.log("  " + String(r.matchScore).padStart(3) + "  " + r.candidate.name + "  (" + r.candidate.title + ")");
console.log("\n--- TOP candidate full object ---");
console.log(JSON.stringify(results[0], null, 2));
