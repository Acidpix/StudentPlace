import { z } from "zod";

import { OBJECT_KINDS, RELATION_TYPES, ROOM_MAX_CM, ROOM_MIN_CM } from "@/lib/domain";

/**
 * Schémas de validation. Toute donnée entrante — formulaire, import CSV,
 * corps de requête — traverse l'un de ces schémas avant d'atteindre la base.
 */

// -------------------------------- Comptes -----------------------------------

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(80),
  email: z.email("Adresse e-mail invalide."),
  password: z
    .string()
    .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
    .max(200),
});

export const signInSchema = z.object({
  email: z.email("Adresse e-mail invalide."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

// --------------------------------- Classes ----------------------------------

export const classGroupSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la classe est obligatoire.").max(60),
  schoolYear: z.string().trim().max(20).optional().or(z.literal("")),
});

// --------------------------------- Élèves -----------------------------------

export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(60),
  lastName: z.string().trim().min(1, "Le nom est obligatoire.").max(60),
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
  difficulty: z.coerce
    .number()
    .int()
    .min(1, "La note de difficulté va de 1 à 5.")
    .max(5, "La note de difficulté va de 1 à 5."),
  // Volontairement `z.boolean()` et non `z.coerce.boolean()` : la coercition
  // transformerait la chaîne "false" en `true`.
  needsFront: z.boolean().default(false),
  leftHanded: z.boolean().default(false),
});

// -------------------------------- Relations ---------------------------------

export const relationSchema = z.object({
  studentAId: z.string().min(1),
  studentBId: z.string().min(1),
  type: z.enum(RELATION_TYPES),
});

// --------------------------------- Salles -----------------------------------

export const roomSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la salle est obligatoire.").max(60),
  widthCm: z.coerce.number().int().min(ROOM_MIN_CM).max(ROOM_MAX_CM),
  heightCm: z.coerce.number().int().min(ROOM_MIN_CM).max(ROOM_MAX_CM),
});

/** Une place, telle que transmise par l'éditeur de salle. */
export const seatInputSchema = z.object({
  id: z.string().optional(),
  x: z.number().int(),
  y: z.number().int(),
  label: z.string().max(20).nullable().optional(),
  disabled: z.boolean().default(false),
  isEndSeat: z.boolean().default(false),
});

/** Un meuble et les places qu'il porte. */
export const roomObjectInputSchema = z.object({
  id: z.string().optional(),
  kind: z.enum(OBJECT_KINDS),
  x: z.number().int(),
  y: z.number().int(),
  widthCm: z.number().int().min(10).max(ROOM_MAX_CM),
  heightCm: z.number().int().min(5).max(ROOM_MAX_CM),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  label: z.string().max(40).nullable().optional(),
  seats: z.array(seatInputSchema).default([]),
});

/**
 * Sauvegarde complète d'une salle : l'éditeur envoie l'agencement entier,
 * ce qui évite d'avoir à réconcilier des ajouts et suppressions un par un.
 */
export const roomLayoutSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  widthCm: z.number().int().min(ROOM_MIN_CM).max(ROOM_MAX_CM),
  heightCm: z.number().int().min(ROOM_MIN_CM).max(ROOM_MAX_CM),
  objects: z.array(roomObjectInputSchema).max(200),
});

// ---------------------------------- Plans -----------------------------------

export const planSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à ce plan.").max(60),
  classGroupId: z.string().min(1, "Choisissez une classe."),
  roomId: z.string().min(1, "Choisissez une salle."),
});

export const planSettingsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  mirrored: z.boolean(),
  proximityCm: z.number().int().min(0).max(1000),
});

/** Affectations d'un plan, envoyées en bloc par l'éditeur de placement. */
export const assignmentsSchema = z.object({
  planId: z.string().min(1),
  assignments: z
    .array(
      z.object({
        seatId: z.string().min(1),
        studentId: z.string().min(1),
        pinned: z.boolean().default(false),
      }),
    )
    .max(200),
});

// -------------------------------- Import CSV --------------------------------

export const csvImportSchema = z.object({
  classGroupId: z.string().min(1),
  content: z.string().min(1, "Collez ou téléversez une liste d'élèves."),
  replaceExisting: z.boolean().default(false),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type RoomLayoutInput = z.infer<typeof roomLayoutSchema>;
export type RoomObjectInput = z.infer<typeof roomObjectInputSchema>;
export type SeatInput = z.infer<typeof seatInputSchema>;
