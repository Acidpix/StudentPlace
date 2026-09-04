import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Chiffrement des commentaires sur les élèves.
 *
 * Pourquoi : un fichier SQLite est un fichier texte à peine structuré. Une
 * sauvegarde égarée ou un accès disque suffirait à lire en clair des
 * appréciations comportementales concernant des mineurs. Ces commentaires sont
 * donc chiffrés au repos ; le reste des données (noms, notes de comportement)
 * demeure en clair car il doit rester triable et interrogeable.
 *
 * Format stocké : "<iv>.<tag>.<données>", chaque partie en base64.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // taille recommandée pour GCM
const KEY_BYTES = 32; // AES-256

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY est absent. Générer une clé avec « openssl rand -base64 32 » et la placer dans .env.",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY doit faire exactement ${KEY_BYTES} octets une fois décodée (${key.length} obtenus). Générer avec « openssl rand -base64 32 ».`,
    );
  }

  cachedKey = key;
  return key;
}

/** Vérifie au démarrage que la clé est exploitable, sans rien chiffrer. */
export function assertEncryptionKeyIsValid(): void {
  getKey();
}

export function encryptComment(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined) return null;

  const trimmed = plain.trim();
  if (trimmed === "") return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

/**
 * Déchiffre un commentaire.
 *
 * Renvoie `null` si la donnée est absente, malformée, ou si la clé ne
 * correspond pas — typiquement après un changement d'ENCRYPTION_KEY. On ne
 * lève pas d'exception : une page de classe entière ne doit pas tomber parce
 * qu'un commentaire est illisible. La perte est signalée dans les journaux.
 */
export function decryptComment(stored: string | null | undefined): string | null {
  if (!stored) return null;

  const parts = stored.split(".");
  if (parts.length !== 3) {
    console.warn("[crypto] Commentaire au format inattendu, ignoré.");
    return null;
  }

  const [ivB64, tagB64, dataB64] = parts;

  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    console.warn(
      "[crypto] Déchiffrement impossible : ENCRYPTION_KEY a probablement changé depuis l'enregistrement.",
    );
    return null;
  }
}

/** Comparaison à temps constant, pour les jetons ponctuels. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
