/**
 * Lecture d'une liste d'élèves collée depuis un tableur OU saisie en texte
 * simple.
 *
 * On ne peut pas exiger d'un professeur qu'il produise un CSV canonique : le
 * séparateur est détecté automatiquement (point-virgule, tabulation, virgule),
 * les guillemets d'Excel sont gérés, et une éventuelle ligne d'en-tête est
 * ignorée.
 *
 * Colonnes attendues, dans l'ordre :
 *   Nom ; Prénom ; Comportement (1-5, facultatif) ; Commentaire (facultatif)
 *
 * Une ligne SANS séparateur est acceptée telle quelle — « Martin Camille », un
 * élève par ligne. Nom et prénom sont alors séparés d'après `nameOrder`, sauf
 * si la casse tranche d'elle-même : une liste d'établissement écrit le patronyme
 * en capitales (« MARTIN Camille »), et cette indication prime sur l'ordre
 * déclaré. Les deux formes cohabitent dans un même collage, ligne par ligne.
 */

export interface ParsedStudentRow {
  lastName: string;
  firstName: string;
  behavior: number;
  comment: string;
}

export interface ParseResult {
  students: ParsedStudentRow[];
  errors: string[];
}

/** Ordre des mots d'une ligne de texte simple, quand la casse ne tranche pas. */
export const NAME_ORDERS = ["lastFirst", "firstLast"] as const;
export type NameOrder = (typeof NAME_ORDERS)[number];

export const NAME_ORDER_LABELS: Record<NameOrder, string> = {
  lastFirst: "Nom puis prénom",
  firstLast: "Prénom puis nom",
};

export interface ParseOptions {
  /** Défaut : `lastFirst`, l'ordre des colonnes du tableur et de l'affichage. */
  nameOrder?: NameOrder;
}

function detectDelimiter(sample: string): string {
  const candidates = [";", "\t", ","];
  let best = ";";
  let bestCount = -1;

  for (const candidate of candidates) {
    const count = sample.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }

  return best;
}

/** Découpe un texte délimité en lignes de champs, guillemets compris. */
export function parseDelimited(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const delimiter = detectDelimiter(normalized.split("\n")[0]);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'; // guillemet échappé
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** Minuscules sans accent, pour comparer « Prénom » et « prenom ». */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const HEADER_WORDS = new Set([
  "nom",
  "noms",
  "patronyme",
  "prenom",
  "prenoms",
  "eleve",
  "eleves",
  "comportement",
  // « difficulte » est resté : l'échelle a changé de nom, pas les fichiers
  // déjà préparés par le professeur. Sans lui, leur en-tête serait pris pour
  // un élève.
  "difficulte",
  "commentaire",
  "commentaires",
]);

/**
 * Comparaison MOT À MOT et non par sous-chaîne : « Monome » contient « nom »,
 * et un test par `includes` sacrifiait le premier élève de la liste.
 */
function looksLikeHeader(cells: string[]): boolean {
  const words = cells
    .slice(0, 4)
    .flatMap((cell) => fold(cell).split(/[\s'-]+/))
    .filter(Boolean);

  return words.some((word) => HEADER_WORDS.has(word));
}

/** Un mot est un patronyme d'établissement s'il est tout en capitales. */
function isAllCaps(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toLocaleUpperCase("fr");
}

/**
 * Sépare « Martin Camille » en nom et prénom.
 *
 * Le reste des mots va au PRÉNOM et non au nom : « Marie Claire Dupont » se lit
 * comme un prénom composé plus souvent que comme un nom composé, et un
 * professeur corrigera plus vite une ligne sur trente qu'il ne réécrira la
 * liste entière.
 */
export function splitFullName(
  raw: string,
  nameOrder: NameOrder = "lastFirst",
): { lastName: string; firstName: string } | null {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const caps = words.filter(isAllCaps);
  if (caps.length > 0 && caps.length < words.length) {
    return {
      lastName: caps.join(" "),
      firstName: words.filter((word) => !isAllCaps(word)).join(" "),
    };
  }

  return nameOrder === "lastFirst"
    ? { lastName: words[0], firstName: words.slice(1).join(" ") }
    : { lastName: words[words.length - 1], firstName: words.slice(0, -1).join(" ") };
}

export function parseStudentList(text: string, options: ParseOptions = {}): ParseResult {
  const nameOrder = options.nameOrder ?? "lastFirst";
  const rows = parseDelimited(text);
  const errors: string[] = [];
  const students: ParsedStudentRow[] = [];

  if (rows.length === 0) {
    return { students, errors: ["Aucune ligne exploitable."] };
  }

  const hasHeader = looksLikeHeader(rows[0]);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  dataRows.forEach((cells, index) => {
    // Numéro de ligne tel que le professeur le voit dans son tableur.
    const lineNumber = index + (hasHeader ? 2 : 1);

    let lastName = (cells[0] ?? "").trim();
    let firstName = (cells[1] ?? "").trim();

    if (!lastName && !firstName) return;

    // Texte simple : un seul champ rempli, nom et prénom encore accolés.
    if (lastName && !firstName) {
      const split = splitFullName(lastName, nameOrder);
      if (split) {
        lastName = split.lastName;
        firstName = split.firstName;
      }
    }

    if (!lastName || !firstName) {
      errors.push(
        `Ligne ${lineNumber} : « ${lastName || firstName} » ne donne qu'un mot, il faut le nom ET le prénom.`,
      );
      return;
    }

    let behavior = 1;
    const rawBehavior = (cells[2] ?? "").trim();
    if (rawBehavior !== "") {
      const parsed = Number.parseInt(rawBehavior.replace(",", "."), 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
        errors.push(
          `Ligne ${lineNumber} : comportement « ${rawBehavior} » ignoré, il doit aller de 1 à 5.`,
        );
      } else {
        behavior = parsed;
      }
    }

    students.push({
      lastName,
      firstName,
      behavior,
      comment: (cells[3] ?? "").trim(),
    });
  });

  if (students.length === 0 && errors.length === 0) {
    errors.push("Aucun élève trouvé. Vérifiez que la première colonne contient les noms.");
  }

  return { students, errors };
}
