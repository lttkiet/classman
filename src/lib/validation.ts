import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional().nullable();

export const resourceSchemas = {
  grades: z.object({
    name: z.string().trim().min(1).max(80),
    description: optionalText,
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  }),
  learners: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().optional().or(z.literal("")),
    phone: z.string().trim().max(40).optional(),
    level: z.string().trim().max(80).optional(),
    goal: optionalText,
    notes: optionalText,
    assignedTeacherId: z.string().optional().nullable(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  }),
  groups: z.object({
    name: z.string().trim().min(2).max(120),
    gradeId: z.string().min(1),
    level: z.string().trim().max(80).optional(),
    description: optionalText,
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  }),
  sessions: z.object({
    title: z.string().trim().min(2).max(160),
    learnerId: z.string().min(1).optional().nullable(),
    groupId: z.string().min(1).optional().nullable(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
    attendance: z.enum(["NOT_MARKED", "PRESENT", "ABSENT", "LATE", "EXCUSED"]).optional(),
    location: z.string().trim().max(160).optional(),
    teacherId: z.string().min(1).optional().nullable(),
  }),
  lessons: z.object({
    title: z.string().trim().min(2).max(160),
    subject: z.string().trim().max(100).optional(),
    level: z.string().trim().max(80).optional(),
    content: optionalText,
    materials: optionalText,
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  }),
  notes: z.object({
    learnerId: z.string().min(1),
    sessionId: z.string().optional().nullable(),
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(2).max(10000),
  }),
  assignments: z.object({
    learnerId: z.string().min(1).optional().nullable(),
    groupId: z.string().min(1).optional().nullable(),
    title: z.string().trim().min(2).max(160),
    description: optionalText,
    dueAt: z.iso.datetime().optional().nullable(),
    status: z.enum(["ASSIGNED", "COMPLETED", "NEEDS_REVIEW"]).optional(),
    completedAt: z.iso.datetime().optional().nullable(),
  }),
  progress: z.object({
    learnerId: z.string().min(1),
    subject: z.string().trim().min(2).max(100),
    metric: z.string().trim().max(120).optional(),
    score: z.number().min(0).max(100).optional().nullable(),
    note: optionalText,
    recordedAt: z.iso.datetime().optional(),
  }),
} as const;

export type ResourceName = keyof typeof resourceSchemas;

export const centerSchema = z.object({ name: z.string().trim().min(2).max(120) });
export const invitationSchema = z.object({
  email: z.email(),
  role: z.enum(["MANAGER", "TEACHER"]).default("TEACHER"),
});

export const libraryDocumentSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1000).optional(),
  scope: z.enum(["COMMON", "GRADE", "CLASS"]),
  gradeId: z.string().optional(),
  groupId: z.string().optional(),
}).refine((input) => input.scope === "COMMON" ? !input.gradeId && !input.groupId : input.scope === "GRADE" ? Boolean(input.gradeId) && !input.groupId : Boolean(input.groupId) && !input.gradeId, {
  message: "Choose a matching grade or class for this document.",
});
