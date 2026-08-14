import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { DIFFICULTY_COLORS, type Difficulty, type ObjectKind } from "@/lib/domain";
import type { RoomView, StudentView } from "@/lib/view-models";

/**
 * Document PDF d'un plan de classe.
 *
 * Tracé en Views positionnées plutôt qu'en SVG : le rendu est plus prévisible,
 * et la police intégrée Helvetica couvre les caractères accentués sans qu'il
 * faille embarquer un fichier de police.
 */

// A4 paysage, en points typographiques.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const HEADER_HEIGHT = 58;
const FOOTER_HEIGHT = 26;

const SEAT_WIDTH = 62;
const SEAT_HEIGHT = 26;

const styles = StyleSheet.create({
  page: {
    paddingTop: MARGIN,
    paddingBottom: MARGIN,
    paddingHorizontal: MARGIN,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#101828",
  },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, color: "#5c6b7f", marginTop: 3 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  canvas: { position: "relative", borderWidth: 1, borderColor: "#c9d2dd", marginTop: 10 },
  furniture: { position: "absolute", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  furnitureLabel: { fontSize: 7, color: "#5c6b7f" },
  seat: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#98a5b6",
    borderRadius: 3,
    backgroundColor: "#ffffff",
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: "center",
  },
  seatEmpty: { borderStyle: "dashed", borderColor: "#c9d2dd", backgroundColor: "#f7f9fb" },
  seatName: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  seatComment: { fontSize: 5.5, color: "#5c6b7f", marginTop: 1 },
  seatRow: { flexDirection: "row", alignItems: "center" },
  pastille: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  pastilleText: { fontSize: 5, fontFamily: "Helvetica-Bold", color: "#1a1207" },
  footer: {
    position: "absolute",
    bottom: MARGIN - 14,
    left: MARGIN,
    right: MARGIN,
    fontSize: 7,
    color: "#8a97a8",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rosterTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  rosterRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dde3ea",
    paddingVertical: 3.5,
  },
  rosterName: { width: "34%", fontSize: 9 },
  rosterSeat: { width: "18%", fontSize: 9, color: "#5c6b7f" },
  rosterComment: { flex: 1, fontSize: 8, color: "#5c6b7f" },
});

const FURNITURE_COLORS: Record<ObjectKind, { background: string; border: string }> = {
  TABLE: { background: "#f0f3f7", border: "#c9d2dd" },
  TEACHER_DESK: { background: "#e6e9fb", border: "#6b73d8" },
  BOARD: { background: "#3f46c4", border: "#3f46c4" },
  DOOR: { background: "#ffffff", border: "#98a5b6" },
  WINDOW: { background: "#ffffff", border: "#98a5b6" },
  OBSTACLE: { background: "#eef1f5", border: "#98a5b6" },
};

const FURNITURE_LABELS: Partial<Record<ObjectKind, string>> = {
  TEACHER_DESK: "Bureau",
  BOARD: "TABLEAU",
  DOOR: "Porte",
  WINDOW: "Fenetre",
};

export interface PlanPdfOptions {
  includeComments: boolean;
  includeDifficulty: boolean;
  includeRoster: boolean;
  mirrored: boolean;
}

export interface PlanPdfData {
  planName: string;
  className: string;
  roomName: string;
  teacherName: string;
  room: RoomView;
  students: StudentView[];
  /** seatId -> studentId */
  assignments: Map<string, string>;
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
  const seats = room.objects.flatMap((object) => object.seats);

  const availableWidth = PAGE_WIDTH - MARGIN * 2;
  const availableHeight = PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT;
  const scale = Math.min(availableWidth / room.widthCm, availableHeight / room.heightCm);

  const canvasWidth = room.widthCm * scale;
  const canvasHeight = room.heightCm * scale;

  // Vue depuis le bureau : rotation à 180° de la salle, exactement comme à
  // l'écran. Les deux axes s'inversent — le tableau se retrouve en bas de la
  // feuille et la gauche du papier redevient la gauche du professeur. Les noms,
  // eux, ne sont jamais pivotés : ils resteraient illisibles.
  const flipX = (x: number, width = 0) => (options.mirrored ? room.widthCm - x - width : x);
  const flipY = (y: number, height = 0) => (options.mirrored ? room.heightCm - y - height : y);

  const seatedCount = seats.filter((seat) => assignments.has(seat.id)).length;
  const printedOn = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <Document
      title={`${data.className} — ${data.roomName}`}
      author={data.teacherName}
      creator="StudentPlace"
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>
              {data.className} — {data.roomName}
            </Text>
            <Text style={styles.subtitle}>
              {data.planName} · {seatedCount} eleve{seatedCount > 1 ? "s" : ""} place
              {seatedCount > 1 ? "s" : ""} ·{" "}
              {options.mirrored ? "vue depuis le bureau" : "vue du dessus, tableau en haut"}
            </Text>
          </View>
          <Text style={styles.subtitle}>{printedOn}</Text>
        </View>

        <View style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}>
          {room.objects.map((object) => {
            const box = boundingBox(object);
            const colors = FURNITURE_COLORS[object.kind];
            const label = object.label ?? FURNITURE_LABELS[object.kind];
            const width = box.width * scale;
            const height = box.height * scale;

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
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                {label && width > 40 && height > 10 && (
                  <Text
                    style={[
                      styles.furnitureLabel,
                      object.kind === "BOARD" ? { color: "#ffffff" } : {},
                    ]}
                  >
                    {label}
                  </Text>
                )}
              </View>
            );
          })}

          {seats.map((seat) => {
            const studentId = assignments.get(seat.id);
            const student = studentId ? studentById.get(studentId) : undefined;

            return (
              <View
                key={seat.id}
                style={[
                  styles.seat,
                  student ? {} : styles.seatEmpty,
                  {
                    left: flipX(seat.x) * scale - SEAT_WIDTH / 2,
                    top: flipY(seat.y) * scale - SEAT_HEIGHT / 2,
                    width: SEAT_WIDTH,
                    height: SEAT_HEIGHT,
                  },
                ]}
              >
                {student ? (
                  <>
                    <View style={styles.seatRow}>
                      {options.includeDifficulty && (
                        <View
                          style={[
                            styles.pastille,
                            { backgroundColor: DIFFICULTY_COLORS[student.difficulty as Difficulty] },
                          ]}
                        >
                          <Text style={styles.pastilleText}>{student.difficulty}</Text>
                        </View>
                      )}
                      <Text style={styles.seatName}>
                        {student.firstName} {student.lastName}
                      </Text>
                    </View>
                    {options.includeComments && student.comment !== "" && (
                      <Text style={styles.seatComment}>{student.comment}</Text>
                    )}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.footer} fixed>
          <Text>StudentPlace — {data.teacherName}</Text>
          <Text>
            {options.includeComments
              ? "Document contenant des donnees personnelles : diffusion restreinte."
              : "Plan de classe"}
          </Text>
        </View>
      </Page>

      {options.includeRoster && (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <Text style={styles.rosterTitle}>
            {data.className} — liste alphabetique ({data.roomName})
          </Text>

          <View style={styles.rosterRow}>
            <Text style={[styles.rosterName, { fontFamily: "Helvetica-Bold" }]}>Eleve</Text>
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
              const seatId = [...assignments].find(([, id]) => id === student.id)?.[0];
              const seat = seats.find((candidate) => candidate.id === seatId);

              return (
                <View key={student.id} style={styles.rosterRow}>
                  <Text style={styles.rosterName}>
                    {student.lastName} {student.firstName}
                    {options.includeDifficulty ? ` (${student.difficulty}/5)` : ""}
                  </Text>
                  <Text style={styles.rosterSeat}>
                    {seat ? (seat.label ?? `${Math.round(seat.x / 10)} ; ${Math.round(seat.y / 10)}`) : "non place"}
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
