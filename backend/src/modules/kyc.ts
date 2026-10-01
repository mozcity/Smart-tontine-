import { Router } from 'express';
import { z } from 'zod';
import { many, one, pool } from '../db.js';
import { conflict, badRequest } from '../lib/errors.js';
import { currentUser } from '../lib/auth.js';
import { pricing } from '../pricing.js';
import { track } from '../services/notify.js';

// Vérification d'identité (KYC) : le membre envoie sa pièce et un selfie (niveau 1), puis un
// justificatif de domicile ou de revenus (niveau 2). Un administrateur valide ; les plafonds suivent.
export const router = Router();

// Photo prise par l'app ou le site : JPEG/PNG/WebP encodé, 500 Ko maximum (compressé côté client).
export const kycImage = z.string().max(500_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Photo JPEG, PNG ou WebP');
export const ID_TYPES = ['cnib', 'passeport', 'carte_consulaire', 'permis', 'carte_electeur', 'autre'] as const;

router.get('/', async (req, res) => {
  const userId = currentUser(req).id;
  const u = await one(pool, 'SELECT kyc_level FROM users WHERE id = $1', [userId]);
  const submissions = await many(pool,
    `SELECT id, level, id_type, status, reason, created_at, reviewed_at FROM kyc_submissions
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`, [userId]);
  res.json({
    level: u.kyc_level,
    pending: submissions.find((s) => s.status === 'pending') ?? null,
    last: submissions[0] ?? null,
    limits: pricing.limits,
    requirements: {
      1: ['Pièce d\'identité (CNIB, passeport, carte consulaire…) recto et verso', 'Selfie en tenant la pièce'],
      2: ['Niveau 1', 'Justificatif de domicile ou de revenus (facture SONABEL/ONEA, bulletin de salaire, attestation)'],
    },
  });
});

router.post('/', async (req, res) => {
  const userId = currentUser(req).id;
  const body = z.object({
    level: z.union([z.literal(1), z.literal(2)]),
    idType: z.enum(ID_TYPES),
    idNumber: z.string().trim().min(4).max(40),
    fullName: z.string().trim().min(3).max(80),
    birthDate: z.iso.date().optional(),
    idFront: kycImage,
    idBack: kycImage.optional(),
    selfie: kycImage,
    proofOfAddress: kycImage.optional(),
  }).parse(req.body);
  const u = await one(pool, 'SELECT kyc_level FROM users WHERE id = $1', [userId]);
  if (body.level <= u.kyc_level) throw conflict('already_verified', `Ton identité est déjà vérifiée au niveau ${u.kyc_level}`);
  if (body.level === 2 && !body.proofOfAddress) throw badRequest('proof_required', 'Ajoute un justificatif de domicile ou de revenus');
  if (body.idType === 'cnib' && !body.idBack) throw badRequest('id_back_required', 'Ajoute le verso de ta CNIB');
  try {
    const s = await one(pool,
      `INSERT INTO kyc_submissions (user_id, level, id_type, id_number, full_name, birth_date, id_front, id_back, selfie, proof_of_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, level, status, created_at`,
      [userId, body.level, body.idType, body.idNumber, body.fullName, body.birthDate ?? null, body.idFront, body.idBack ?? null, body.selfie, body.proofOfAddress ?? null]);
    await track(pool, userId, 'kyc_submitted', { level: body.level });
    res.status(201).json(s);
  } catch (e: any) {
    if (e?.code === '23505') throw conflict('kyc_pending', 'Un dossier est déjà en cours de vérification');
    throw e;
  }
});
