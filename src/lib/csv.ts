/**
 * Lecture d'une liste d'élèves collée depuis un tableur.
 *
 * On ne peut pas exiger d'un professeur qu'il produise un CSV canonique : le
 * séparateur est détecté automatiquement (point-virgule, tabulation, virgule),
 * les guillemets d'Excel sont gérés, et une éventuelle ligne d'en-tête est
 * ignorée.
 *
 * Colonnes attendues, dans l'ordre :
 *   Nom ; Prénom ; Difficulté (1-5, facultative) ; Commentaire (facultatif)
 */

export interface ParsedStudentRow {
  lastName: string;
  firstName: string;
  difficulty: number;
  comment: string;
}

export interface ParseResult {
  students: ParsedStudentRow[];
  errors: string[];
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

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.slice(0, 3).join(" ").toLowerCase();
  return joined.includes("nom") || joined.includes("prenom") || joined.includes("prénom");
}

export function parseStudentList(text: string): ParseResult {
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

    const lastName = (cells[0] ?? "").trim();
    const firstName = (cells[1] ?? "").trim();

    if (!lastName && !firstName) return;

    if (!lastName || !firstName) {
      errors.push(`Ligne ${lineNumber} : nom et prénom sont tous deux obligatoires.`);
      return;
    }

    let difficulty = 1;
    const rawDifficulty = (cells[2] ?? "").trim();
    if (rawDifficulty !== "") {
      const parsed = Number.parseInt(rawDifficulty.replace(",", "."), 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 5) {
        errors.push(
          `Ligne ${lineNumber} : difficulté « ${rawDifficulty} » ignorée, elle doit aller de 1 à 5.`,
        );
      } else {
        difficulty = parsed;
      }
    }

    students.push({
      lastName,
      firstName,
      difficulty,
      comment: (cells[3] ?? "").trim(),
    });
  });

  if (students.length === 0 && errors.length === 0) {
    errors.push("Aucun élève trouvé. Vérifiez que la première colonne contient les noms.");
  }

  return { students, errors };
}
