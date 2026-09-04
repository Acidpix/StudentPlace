import { Document, Line, Page, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { BEHAVIOR_COLORS, BEHAVIOR_VALUES, type ObjectKind } from "@/lib/domain";
import { seatFootprintCm } from "@/lib/placement/geometry";
import {
  LABEL_BORDER_PX,
  LABEL_PADDING_PX,
  PT_PER_PX,
  fittedSize,
  planLabelStyle,
  seatLabelText,
  seatMetrics,
  textRoomPx,
  type PlanLabelStyle,
  type SeatMetrics,
} from "@/lib/plan-labels";
import type { RoomView, SeatView, StudentView } from "@/lib/view-models";

/**
 * Document PDF d'un plan de classe.
 *
 * Tracé en Views positionnées plutôt qu'en SVG : le rendu est plus prévisible,
 * et la police intégrée Helvetica couvre les caractères accentués sans qu'il
 * faille embarquer un fichier de police.
 *
 * ---
 *
 * **CE DOCUMENT DOIT RESSEMBLER À L'ÉCRAN.** C'est sa règle première, et elle
 * n'était pas tenue : le PDF posait des étiquettes de 62 × 26 points, taille
 * FIXE, quand l'éditeur les dimensionne en centimètres de salle ; il écrivait
 * le nom entier là où l'écran écrit « Camille M. » ; il remplissait les tables
 * d'un aplat beige quand elles ne sont plus qu'un liseré pointillé ; il peignait
 * le tableau en vert plein sans ses hachures. Le professeur composait donc un
 * plan et en imprimait un autre.
 *
 * Deux mesures pour que cela ne se reproduise pas —
 *
 *  - toute la TYPOGRAPHIE des étiquettes vient de `src/lib/plan-labels.ts`,
 *    partagé avec `plan/plan-pieces.tsx`. Emprise, corps commun à la classe,
 *    abrègements : un seul calcul, pas deux ;
 *  - l'unité passée à ce calcul est `PT_PER_PX`, si bien qu'une étiquette
 *    imprimée à 100 % a exactement la taille de celle affichée à l'écran, et
 *    non les quatre tiers.
 *
 * Restent HORS du PDF, délibérément : la trame de points du sol et le grain du
 * papier (déjà neutralisés à l'impression de l'application, `@media print`),
 * l'ombre portée (même raison) et les traits d'incompatibilité, qui demandent
 * les relations de la classe — que la route du PDF ne charge pas.
 */

// A4 paysage, en points typographiques.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
/** Barre supérieure, et le blanc qui la sépare du plan. */
const TOP_BAR_HEIGHT = 32;
const TOP_BAR_GAP = 8;
const HEADER_HEIGHT = TOP_BAR_HEIGHT + TOP_BAR_GAP;
/**
 * Bandeau de légende sous le plan, marge comprise. Deux lignes de réserve : la
 * légende se replie (`flexWrap`) et s'allonge d'un cran dès que le comportement
 * ou les cases de participation sont demandées.
 */
const LEGEND_GAP = 8;
const LEGEND_HEIGHT = LEGEND_GAP + 24;
const FOOTER_HEIGHT = 20;

/** Cases à cocher de participation, sous chaque nom. */
const PARTICIPATION_BOXES = 5;

/**
 * Le PDF ne peut pas lire les variables CSS du thème : ses couleurs sont
 * fixées ici, sur la variante CLAIRE de la palette « Atelier ». C'est le bon
 * choix — un plan de classe s'imprime sur du papier blanc, jamais sur un
 * tableau noir.
 *
 * Les valeurs `oklch()` de `globals.css` sont converties une fois pour toutes
 * en sRGB, et les couleurs semi-transparentes (la trame diluée, les hachures)
 * sont aplaties sur leur fond : react-pdf ne compose pas d'alpha aussi
 * fidèlement qu'un navigateur, et il n'y a de toute façon qu'un seul fond
 * possible sur une feuille.
 */
const INK = {
  surface: "#fdfbf7",
  surfaceMuted: "#e9e3d6",
  border: "#ddd3bf",
  foreground: "#22201f",
  muted: "#6d675e",
  /** `--primary`, oklch(0.72 0.14 25) — le corail de l'action. */
  primary: "#ef7f77",
  primarySoft: "#fff0ee",
  accent: "#0f6f5c",
  accentSoft: "#e2f1ec",
  /** `--danger`, oklch(0.47 0.16 22) — la brique du signal réservé. */
  danger: "#a1252f",
  dangerSoft: "#ffedec",
  /** `--room-floor` : le sol est BLANC, le papier chaud reste autour. */
  floor: "#ffffff",
  /** `--border` à 35 % sur le sol blanc : le quadrillage de 50 cm. */
  grid: "#f3f0e9",
  /** Blanc à 50 % sur `--accent-soft` : les hachures du tableau. */
  hatch: "#f1f8f6",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK.foreground,
  },

  // -------------------------------------------------------- barre supérieure
  /**
   * La barre de l'éditeur : nom du plan, pastille « classe · salle », compteurs.
   * Même composition, même ordre, dans un cadre à filet fin.
   */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: INK.border,
    borderRadius: 6,
    backgroundColor: INK.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: TOP_BAR_GAP,
    height: TOP_BAR_HEIGHT,
  },
  planName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginRight: 8,
    // Un nom long ne doit pas repousser les pastilles hors de la barre.
    maxWidth: 160,
    maxLines: 1,
    textOverflow: "ellipsis",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: INK.border,
    borderRadius: 4,
    backgroundColor: INK.surfaceMuted,
    paddingHorizontal: 5,
    paddingVertical: 3,
    marginRight: 6,
  },
  chipName: { fontSize: 8, fontFamily: "Helvetica-Bold", marginRight: 5 },
  /** `.eyebrow` : petites capitales espacées, la signature typographique. */
  eyebrow: { fontSize: 6.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.6, textTransform: "uppercase" },
  chipAccent: {
    borderRadius: 4,
    backgroundColor: INK.accentSoft,
    paddingHorizontal: 5,
    paddingVertical: 4,
    marginRight: 6,
  },
  chipDanger: {
    borderRadius: 4,
    backgroundColor: INK.dangerSoft,
    paddingHorizontal: 5,
    paddingVertical: 4,
    marginRight: 6,
  },
  spacer: { flexGrow: 1 },
  date: { fontSize: 8, color: INK.muted },

  // ------------------------------------------------------------------ plan
  canvas: {
    position: "relative",
    borderRadius: 4,
    backgroundColor: INK.floor,
    // `alignSelf` et non `margin: auto` : Yoga connaît le premier à coup sûr.
    alignSelf: "center",
  },
  furniture: { position: "absolute", alignItems: "center", justifyContent: "center" },

  // --------------------------------------------------------------- légende
  legend: {
    flexDirection: "row",
    alignItems: "center",
    // Elle se replie plutôt que de déborder : selon les options cochées, elle
    // porte de une à quatre mentions.
    flexWrap: "wrap",
    marginTop: LEGEND_GAP,
  },
  legendText: { fontSize: 7.5, color: INK.muted, marginRight: 10 },
  legendSwatch: { width: 7, height: 7, borderRadius: 2, marginRight: 2 },

  footer: {
    position: "absolute",
    bottom: MARGIN - 14,
    left: MARGIN,
    right: MARGIN,
    fontSize: 7,
    color: INK.muted,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // ------------------------------------------------- liste alphabétique
  rosterTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  rosterRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: INK.border,
    paddingVertical: 3.5,
  },
  rosterName: { width: "34%", fontSize: 9 },
  rosterSeat: { width: "18%", fontSize: 9, color: INK.muted },
  rosterComment: { flex: 1, fontSize: 8, color: INK.muted },
});

/**
 * Traitement de chaque meuble, calqué sur `room/furniture.tsx`.
 *
 * `strokeCm` est l'épaisseur du contour EN CENTIMÈTRES de salle, comme dans le
 * SVG de l'écran : c'est ce qui fait qu'un plan très réduit garde des traits
 * fins et qu'un plan à pleine page garde des traits francs.
 */
const FURNITURE_STYLES: Record<
  ObjectKind,
  { fill?: string; border: string; text: string; dashed?: boolean; strokeCm: number; hatched?: boolean }
> = {
  // Un LISERÉ POINTILLÉ, sans aplat : la table est entièrement recouverte par
  // les étiquettes, un cadre plein doublerait celui des cartes.
  TABLE: { border: INK.border, text: INK.muted, dashed: true, strokeCm: 1.5 },
  TEACHER_DESK: { fill: INK.primarySoft, border: INK.primary, text: INK.primary, strokeCm: 2 },
  BOARD: { fill: INK.accentSoft, border: INK.accent, text: INK.accent, strokeCm: 2, hatched: true },
  DOOR: { border: INK.muted, text: INK.muted, dashed: true, strokeCm: 2 },
  WINDOW: { border: INK.muted, text: INK.muted, dashed: true, strokeCm: 2 },
  OBSTACLE: { fill: INK.surfaceMuted, border: INK.muted, text: INK.muted, dashed: true, strokeCm: 2 },
};

const FURNITURE_LABELS: Partial<Record<ObjectKind, string>> = {
  TEACHER_DESK: "Bureau",
  BOARD: "Tableau",
  DOOR: "Porte",
  WINDOW: "Fenêtre",
};

export interface PlanPdfOptions {
  includeComments: boolean;
  includeBehavior: boolean;
  includeRoster: boolean;
  /** Cinq cases à cocher sous chaque nom, pour noter la participation. */
  includeParticipation: boolean;
  mirrored: boolean;
}

/** Ce qu'une place porte : l'élève, et son verrouillage. */
export interface PlanPdfAssignment {
  studentId: string;
  pinned: boolean;
}

export interface PlanPdfData {
  planName: string;
  className: string;
  roomName: string;
  teacherName: string;
  room: RoomView;
  students: StudentView[];
  /** seatId -> affectation */
  assignments: Map<string, PlanPdfAssignment>;
}

/**
 * Boîte englobante d'un meuble pivoté.
 *
 * Les rotations étant toujours des quarts de tour, il suffit d'échanger
 * largeur et profondeur autour du centre : le résultat est exact, sans avoir
 * à s'en remettre au support partiel des transformations dans react-pdf.
 */
function boundingBox(object: RoomView["objects"][number]) {
  const swapped = object.rotation === 90 || object.rotation === 270;
  const width = swapped ? object.heightCm : object.widthCm;
  const height = swapped ? object.widthCm : object.heightCm;
  return {
    x: object.x + object.widthCm / 2 - width / 2,
    y: object.y + object.heightCm / 2 - height / 2,
    width,
    height,
  };
}

/**
 * Produit le PDF binaire.
 *
 * Le JSX vit ici plutôt que dans la route : un fichier `route.ts` ne peut pas
 * en contenir, et le renommer en `.tsx` reposerait sur une convention moins
 * sûre que ce simple point d'entrée.
 */
export function renderPlanPdf(data: PlanPdfData, options: PlanPdfOptions): Promise<Buffer> {
  return renderToBuffer(<PlanDocument data={data} options={options} />);
}

export function PlanDocument({
  data,
  options,
}: {
  data: PlanPdfData;
  options: PlanPdfOptions;
}) {
  const { room, students, assignments } = data;

  const studentById = new Map(students.map((student): [string, StudentView] => [student.id, student]));

  // `sideways` : la table de cette place est pivotée d'un quart de tour (le
  // bras d'un U). Son étiquette tourne AVEC elle, exactement comme à l'écran.
  const seats = room.objects.flatMap((object) =>
    object.seats.map((seat) => ({ ...seat, sideways: object.rotation % 180 !== 0 })),
  );

  const availableWidth = PAGE_WIDTH - MARGIN * 2;
  const availableHeight =
    PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - LEGEND_HEIGHT - FOOTER_HEIGHT;
  // Points par centimètre de salle. Le pendant exact de `pxPerCm` à l'écran.
  const scale = Math.min(availableWidth / room.widthCm, availableHeight / room.heightCm);

  const canvasWidth = room.widthCm * scale;
  const canvasHeight = room.heightCm * scale;

  /**
   * L'emprise d'une étiquette est celle de sa table — le pas de ses places en
   * largeur, sa profondeur en hauteur — et elle est COMMUNE à tout le plan.
   * Exactement le calcul de l'éditeur, sur les mêmes tables.
   */
  const tableSpans = room.objects
    .filter((object) => object.kind === "TABLE")
    .map((object) => ({
      widthCm: object.widthCm,
      heightCm: object.heightCm,
      seatCount: object.seats.length,
    }));
  const footprint = seatFootprintCm(tableSpans);
  const metrics = seatMetrics(footprint, scale, {
    unit: PT_PER_PX,
    // Les cases à cocher se servent sur la part de hauteur du NOM, jamais sur
    // la carte entière : sans cela elles pousseraient le texte hors du cadre.
    heightShare: options.includeParticipation ? 0.3 : 0.46,
  });
  const labels = planLabelStyle(students, metrics);

  // Vue depuis le bureau : rotation à 180° de la salle, exactement comme à
  // l'écran. Les deux axes s'inversent — le tableau se retrouve en bas de la
  // feuille et la gauche du papier redevient la gauche du professeur. Les noms,
  // eux, ne sont jamais pivotés : ils resteraient illisibles.
  const flipX = (x: number, width = 0) => (options.mirrored ? room.widthCm - x - width : x);
  const flipY = (y: number, height = 0) => (options.mirrored ? room.heightCm - y - height : y);

  const seatedCount = seats.filter((seat) => assignments.has(seat.id)).length;
  const pinnedCount = [...assignments.values()].filter((entry) => entry.pinned).length;
  const printedOn = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const gridStep = 50;
  const verticals = Array.from(
    { length: Math.max(0, Math.floor(room.widthCm / gridStep)) },
    (_, index) => (index + 1) * gridStep,
  );
  const horizontals = Array.from(
    { length: Math.max(0, Math.floor(room.heightCm / gridStep)) },
    (_, index) => (index + 1) * gridStep,
  );

  return (
    <Document
      title={`${data.className} — ${data.roomName}`}
      author={data.teacherName}
      creator="Sisit"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* ------------------------------------------- la barre de l'éditeur */}
        <View style={styles.topBar}>
          <Text style={styles.planName}>{data.planName}</Text>

          <View style={styles.chip}>
            <Text style={styles.chipName}>{data.className}</Text>
            <Text style={[styles.eyebrow, { color: INK.muted }]}>{data.roomName}</Text>
          </View>

          <View style={styles.chipAccent}>
            <Text style={[styles.eyebrow, { color: INK.accent }]}>
              {seatedCount}/{students.length} placés
            </Text>
          </View>

          {pinnedCount > 0 && (
            <View style={styles.chipDanger}>
              <Text style={[styles.eyebrow, { color: INK.danger }]}>
                {pinnedCount} verrouillée{pinnedCount > 1 ? "s" : ""}
              </Text>
            </View>
          )}

          <View style={styles.spacer} />
          <Text style={styles.date}>{printedOn}</Text>
        </View>

        {/* --------------------------------------------------------- le plan */}
        <View style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}>
          {/* Le cadre de la salle — 3 cm dans le SVG de l'écran — est un CALQUE
              et non la bordure du conteneur : dans Yoga, un enfant absolu se
              positionne à l'intérieur de la bordure de son parent, si bien
              qu'un cadre porté par le conteneur décalerait toute la salle de
              son épaisseur et la ferait déborder d'autant à droite et en bas.
              Posé en premier, il se laisse recouvrir par le mobilier, comme le
              rect de `RoomGrid` que rend `Furniture` par-dessus. */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: Math.max(0.75, Math.min(2, 3 * scale)),
              borderColor: INK.border,
              borderRadius: 4,
            }}
          />

          {/* Quadrillage de 50 cm — l'outil de mesure de l'éditeur de salle,
              très dilué. La TRAME DE POINTS, elle, ne suit pas : elle est
              décorative, et l'application la neutralise déjà à l'impression. */}
          {verticals.map((x) => (
            <View
              key={`v${x}`}
              style={{
                position: "absolute",
                left: x * scale,
                top: 0,
                width: 0.5,
                height: canvasHeight,
                backgroundColor: INK.grid,
              }}
            />
          ))}
          {horizontals.map((y) => (
            <View
              key={`h${y}`}
              style={{
                position: "absolute",
                left: 0,
                top: y * scale,
                width: canvasWidth,
                height: 0.5,
                backgroundColor: INK.grid,
              }}
            />
          ))}

          {room.objects.map((object) => {
            const box = boundingBox(object);
            const style = FURNITURE_STYLES[object.kind];
            const label = object.label ?? FURNITURE_LABELS[object.kind] ?? null;
            const width = box.width * scale;
            const height = box.height * scale;
            const stroke = Math.max(0.5, Math.min(2, style.strokeCm * scale));

            // Même seuil qu'à l'écran, mais mesuré sur la boîte ENGLOBANTE :
            // le libellé n'est pas pivoté ici, il ne doit donc pas s'afficher
            // dans un meuble devenu étroit par sa rotation.
            const showLabel = label !== null && box.width >= 60 && box.height >= 24;
            const isBoard = object.kind === "BOARD";

            return (
              <View
                key={object.id}
                style={[
                  styles.furniture,
                  {
                    left: flipX(box.x, box.width) * scale,
                    top: flipY(box.y, box.height) * scale,
                    width,
                    height,
                    borderWidth: stroke,
                    borderStyle: style.dashed ? "dashed" : "solid",
                    borderColor: style.border,
                    borderRadius: isBoard ? 4 * scale : 6 * scale,
                  },
                  // La clé est OMISE plutôt que mise à « transparent » : la
                  // table n'a pas d'aplat du tout, et une couleur nommée que
                  // react-pdf ne saurait pas lire virerait au noir.
                  style.fill ? { backgroundColor: style.fill } : {},
                ]}
              >
                {/* Rognées au CADRE du meuble : le calque absolu part de
                    l'intérieur de la bordure, il ne doit donc pas mesurer la
                    boîte entière sous peine de déborder par la droite. */}
                {style.hatched && (
                  <Hatching
                    width={Math.max(0, width - 2 * stroke)}
                    height={Math.max(0, height - 2 * stroke)}
                    scale={scale}
                  />
                )}

                {showLabel && (
                  <Text
                    style={{
                      fontSize: Math.min(20, box.height * 0.5) * scale,
                      color: style.text,
                      fontFamily: isBoard ? "Helvetica-Bold" : "Helvetica",
                      maxLines: 1,
                      ...(isBoard
                        ? {
                            textTransform: "uppercase" as const,
                            letterSpacing: Math.min(20, box.height * 0.5) * scale * 0.16,
                          }
                        : null),
                    }}
                  >
                    {label}
                  </Text>
                )}
              </View>
            );
          })}

          {seats.map((seat) => {
            const entry = assignments.get(seat.id);
            const student = entry ? studentById.get(entry.studentId) : undefined;

            return (
              <View
                key={seat.id}
                style={{
                  position: "absolute",
                  left: flipX(seat.x) * scale - metrics.width / 2,
                  top: flipY(seat.y) * scale - metrics.height / 2,
                  width: metrics.width,
                  height: metrics.height,
                  // Une place sur une table pivotée tourne son étiquette avec
                  // elle — toujours un quart de tour DANS LE MÊME SENS, jamais
                  // l'angle exact : 270° afficherait le texte à l'envers pour
                  // la moitié des bras d'un U.
                  ...(seat.sideways
                    ? { transform: "rotate(90deg)", transformOrigin: "center" }
                    : null),
                }}
              >
                {student ? (
                  <SeatedStudent
                    student={student}
                    pinned={entry?.pinned ?? false}
                    metrics={metrics}
                    labels={labels}
                    options={options}
                  />
                ) : (
                  <EmptySeat seat={seat} metrics={metrics} labels={labels} />
                )}
              </View>
            );
          })}
        </View>

        {/* ------------------------- la légende, comme sous le plan à l'écran */}
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            {options.mirrored
              ? "Vue depuis le bureau : les élèves vous font face, le tableau est en bas."
              : "Vue du dessus : le tableau est en haut, comme sur le plan de la salle."}
          </Text>

          {options.includeBehavior && (
            <>
              <Text style={[styles.eyebrow, { color: INK.muted, marginRight: 4 }]}>
                Comportement
              </Text>
              {BEHAVIOR_VALUES.map((level) => (
                <View
                  key={level}
                  style={[styles.legendSwatch, { backgroundColor: BEHAVIOR_COLORS[level] }]}
                />
              ))}
              <Text style={[styles.legendText, { marginLeft: 4 }]}>(cerclage de l&apos;étiquette)</Text>
            </>
          )}

          {pinnedCount > 0 && (
            <Text style={[styles.legendText, { color: INK.danger }]}>
              Cadre rouge : place verrouillée.
            </Text>
          )}

          {options.includeParticipation && (
            <Text style={styles.legendText}>{PARTICIPATION_BOXES} cases : participation.</Text>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>Sisit — {data.teacherName}</Text>
          <Text>
            {options.includeComments || options.includeBehavior
              ? "Document contenant des données personnelles : diffusion restreinte."
              : "Plan de classe"}
          </Text>
        </View>
      </Page>

      {options.includeRoster && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.rosterTitle}>
            {data.className} — liste alphabétique ({data.roomName})
          </Text>

          <View style={styles.rosterRow}>
            <Text style={[styles.rosterName, { fontFamily: "Helvetica-Bold" }]}>Élève</Text>
            <Text style={[styles.rosterSeat, { fontFamily: "Helvetica-Bold" }]}>Place</Text>
            {options.includeComments && (
              <Text style={[styles.rosterComment, { fontFamily: "Helvetica-Bold" }]}>
                Commentaire
              </Text>
            )}
          </View>

          {[...students]
            .sort((a, b) =>
              `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"),
            )
            .map((student) => {
              const seatId = [...assignments].find(([, entry]) => entry.studentId === student.id)?.[0];
              const seat = seats.find((candidate) => candidate.id === seatId);

              return (
                <View key={student.id} style={styles.rosterRow}>
                  <Text style={styles.rosterName}>
                    {student.lastName} {student.firstName}
                    {options.includeBehavior ? ` (${student.behavior}/5)` : ""}
                  </Text>
                  <Text style={styles.rosterSeat}>
                    {seat
                      ? (seat.label ?? `${Math.round(seat.x / 10)} ; ${Math.round(seat.y / 10)}`)
                      : "non placé"}
                  </Text>
                  {options.includeComments && (
                    <Text style={styles.rosterComment}>{student.comment}</Text>
                  )}
                </View>
              );
            })}
        </Page>
      )}
    </Document>
  );
}

// ------------------------------------------------------------------- pièces

/**
 * Les hachures du tableau.
 *
 * L'écran les obtient d'un `<pattern>` SVG ; react-pdf n'en connaît pas. On
 * pose donc les traits un à un, DÉJÀ ROGNÉS au rectangle : les diagonales
 * `x + y = c` se coupent analytiquement, ce qui évite d'avoir à s'en remettre
 * au découpage d'un `<Svg>` — dont le comportement de débordement n'est pas
 * garanti.
 *
 * Même pas que le motif de l'écran : une diagonale tous les 10 cm, épaisse de
 * 3 cm. Le tableau est le repère d'orientation du plan ; il doit se lire avant
 * tout le reste, y compris en vue pivotée.
 */
function Hatching({ width, height, scale }: { width: number; height: number; scale: number }) {
  const step = 10 * scale;
  const lines: Array<[number, number, number, number]> = [];

  for (let c = step; c < width + height; c += step) {
    const x1 = Math.max(0, c - height);
    const x2 = Math.min(width, c);
    if (x2 - x1 <= 0.01) continue;
    lines.push([x1, c - x1, x2, c - x2]);
  }

  return (
    <Svg
      style={{ position: "absolute", top: 0, left: 0 }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {lines.map(([x1, y1, x2, y2], index) => (
        <Line
          key={index}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={INK.hatch}
          strokeWidth={Math.max(0.5, 3 * scale)}
        />
      ))}
    </Svg>
  );
}

/** Ce qu'affiche une place sans élève. */
function EmptySeat({
  seat,
  metrics,
  labels,
}: {
  seat: SeatView;
  metrics: SeatMetrics;
  labels: PlanLabelStyle;
}) {
  const label = seat.disabled ? "Condamnée" : "Libre";

  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        borderWidth: LABEL_BORDER_PX * PT_PER_PX,
        borderStyle: "dashed",
        borderColor: INK.border,
        borderRadius: metrics.radius,
        alignItems: "center",
        justifyContent: "center",
        opacity: seat.disabled ? 0.5 : 1,
      }}
    >
      {!metrics.tiny && (
        <Text
          style={{
            // Jamais plus gros que les noms — une place vide n'a pas à crier
            // plus fort qu'un élève — et rogné si « Condamnée », deux fois plus
            // long que « Libre », ne tenait pas dans la carte.
            fontSize: fittedSize(label, labels.font, textRoomPx(metrics)),
            color: INK.muted,
            // `maxLines` est un attribut de STYLE dans react-pdf, jamais une
            // propriété du composant. Filet de sécurité : la largeur des noms
            // n'est qu'estimée, et un texte qui reviendrait à la ligne
            // déborderait la carte au lieu d'être rogné.
            maxLines: 1,
          }}
        >
          {label}
        </Text>
      )}
    </View>
  );
}

/**
 * L'étiquette d'un élève placé — la carte de l'écran, à l'identique.
 *
 * Le COMPORTEMENT s'y lit à un cerclage INTÉRIEUR, posé en bordure d'un calque
 * absolu plutôt qu'en `box-shadow: inset`, que react-pdf ne connaît pas. Le
 * VERROUILLAGE se lit à un cerclage rouge POSÉ AUTOUR, l'équivalent de
 * l'`outline` de l'écran : les deux ne se disputent ainsi ni la bordure de la
 * carte, ni l'un l'autre.
 */
function SeatedStudent({
  student,
  pinned,
  metrics,
  labels,
  options,
}: {
  student: StudentView;
  pinned: boolean;
  metrics: SeatMetrics;
  labels: PlanLabelStyle;
  options: PlanPdfOptions;
}) {
  const text = seatLabelText(student, labels.form);
  const pinRing = Math.max(1.5, Math.min(2.25, metrics.height * 0.09));

  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        borderWidth: LABEL_BORDER_PX * PT_PER_PX,
        borderColor: INK.border,
        borderRadius: metrics.radius,
        backgroundColor: INK.surface,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: metrics.ring + LABEL_PADDING_PX * metrics.unit,
      }}
    >
      {pinned && (
        <View
          style={{
            position: "absolute",
            top: -pinRing - 1,
            left: -pinRing - 1,
            right: -pinRing - 1,
            bottom: -pinRing - 1,
            borderWidth: pinRing,
            borderColor: INK.danger,
            borderRadius: metrics.radius + pinRing,
          }}
        />
      )}

      {options.includeBehavior && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderWidth: metrics.ring,
            borderColor: BEHAVIOR_COLORS[student.behavior],
            borderRadius: metrics.radius,
          }}
        />
      )}

      {/* « Camille M. », sur toute la largeur. Forme et corps sont ceux du PLAN
          ENTIER, pas de cette carte : tous les élèves s'écrivent de la même
          taille, et c'est le nom le plus long de la classe qui l'a fixée. */}
      {text && (
        <Text
          style={{
            fontSize: labels.font,
            fontFamily: "Helvetica-Bold",
            color: INK.foreground,
            maxLines: 1,
            textOverflow: "ellipsis",
          }}
        >
          {text}
        </Text>
      )}

      {options.includeParticipation && <ParticipationRow metrics={metrics} />}

      {options.includeComments && student.comment !== "" && !options.includeParticipation && (
        <Text
          style={{
            fontSize: Math.max(4, labels.font * 0.6),
            color: INK.muted,
            marginTop: 1,
            maxLines: 1,
            textOverflow: "ellipsis",
          }}
        >
          {student.comment}
        </Text>
      )}
    </View>
  );
}

/**
 * Cinq cases à cocher sous le nom, pour noter la participation en classe.
 *
 * Elles se dimensionnent comme tout le reste de l'étiquette — sur la carte, pas
 * en points fixes : une salle imprimée en petit donne de petites cases, mais
 * elles restent toujours cinq, alignées, et jamais plus larges que le nom.
 *
 * Le pas retenu est une case plus une demi-case de blanc ; la rangée entière
 * vaut donc sept cases de large. Les cases sont VIDES et sans numéro : c'est le
 * professeur qui décide ce qu'une croix veut dire, et un chiffre à cette taille
 * ne serait de toute façon pas lisible.
 */
function ParticipationRow({ metrics }: { metrics: SeatMetrics }) {
  const inner = textRoomPx(metrics);
  const box = Math.max(
    2,
    Math.min(
      inner / (PARTICIPATION_BOXES + (PARTICIPATION_BOXES - 1) * 0.5),
      metrics.height * 0.26,
      11 * metrics.unit,
    ),
  );
  const gap = box * 0.5;

  return (
    <View style={{ flexDirection: "row", marginTop: Math.max(0.8, box * 0.3) }}>
      {Array.from({ length: PARTICIPATION_BOXES }, (_, index) => (
        <View
          key={index}
          style={{
            width: box,
            height: box,
            marginLeft: index === 0 ? 0 : gap,
            borderWidth: Math.max(0.4, box * 0.09),
            borderColor: INK.muted,
            borderRadius: box * 0.2,
            backgroundColor: INK.floor,
          }}
        />
      ))}
    </View>
  );
}
