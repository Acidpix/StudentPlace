"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";

import { DifficultyBadge } from "@/components/ui/difficulty-badge";
import { cn } from "@/lib/cn";
import { DIFFICULTY_COLORS } from "@/lib/domain";
import { studentFullName, studentShortName, type SeatView, type StudentView } from "@/lib/view-models";

/**
 * Briques de l'éditeur de placement.
 *
 * Les places sont des éléments HTML positionnés en pourcentage au-dessus du
 * plan SVG, et non des formes SVG : dnd-kit mesure des rectangles du DOM, et
 * une div se stylise bien plus librement qu'un <circle>.
 *
 * Leur TAILLE, elle, est exprimée en centimètres de salle convertis en pixels
 * (`pxPerCm`, mesuré par usePlanScale). C'est ce qui garantit qu'une étiquette
 * n'en recouvre jamais une autre : son emprise est plus petite que l'écartement
 * réel de deux places. La contrepartie est qu'une grande salle affichée en
 * petit donne de petites étiquettes — d'où les trois densités ci-dessous et le
 * zoom de l'éditeur.
 */

export const TRAY_DROPPABLE_ID = "tray";
export const seatDroppableId = (seatId: string) => `seat:${seatId}`;
export const studentDraggableId = (studentId: string) => `student:${studentId}`;

export function parseDraggableId(id: string): string | null {
  return id.startsWith("student:") ? id.slice("student:".length) : null;
}

export function parseSeatDroppableId(id: string): string | null {
  return id.startsWith("seat:") ? id.slice("seat:".length) : null;
}

// ------------------------------------------------------------------ échelle

export interface SeatMetrics {
  width: number;
  height: number;
  /** Corps MAXIMAL de l'étiquette. Un nom long en recevra moins. */
  font: number;
  /** Épaisseur du cerclage intérieur qui porte la difficulté. */
  ring: number;
  radius: number;
  /** Trop étroite pour le moindre mot : « Libre » et consorts sont masqués. */
  tiny: boolean;
}

/**
 * Corps de texte le plus grand qu'on s'autorise sur une place, en pixels.
 * Au-delà, une salle affichée en grand donnerait des étiquettes criardes.
 * 20 px, soit un cran au-dessus du texte courant de l'interface : sur le plan
 * de classe, le nom d'un élève EST le contenu.
 */
const SEAT_FONT_MAX_PX = 20;

/**
 * Traduit l'emprise disponible en dimensions d'étiquette.
 *
 * L'étiquette tient sur UNE SEULE LIGNE : « Camille M. », le prénom suivi de
 * l'initiale du nom. C'est la forme de la maquette, et c'est aussi la seule
 * qui garde un texte GRAND — deux lignes empilées obligeaient à diviser la
 * hauteur par deux, donc à écrire deux fois plus petit, pour un nom de famille
 * que le professeur connaît déjà. L'initiale suffit à départager deux
 * prénoms identiques, seul cas où le nom entier servait vraiment ; il reste
 * dans l'infobulle, dans le panneau latéral et pour les lecteurs d'écran.
 *
 * Le corps rendu ici est un PLAFOND : `fitStudentLabel()` le réduit nom par
 * nom si la largeur ne suffit pas. C'est ce qui rend l'affichage stable quand
 * la fenêtre rétrécit ou que la salle est grande — le texte se resserre au
 * lieu de disparaître d'un coup.
 *
 * La difficulté ne se lit pas dans l'étiquette mais à un CERCLAGE INTÉRIEUR de
 * la carte : le nom dispose de toute la largeur et se centre, et la couleur
 * reste visible même sur une étiquette minuscule où une pastille deviendrait
 * un point indéchiffrable.
 */
export function seatMetrics(footprint: { widthCm: number; heightCm: number }, pxPerCm: number): SeatMetrics {
  const width = footprint.widthCm * pxPerCm;
  const height = footprint.heightCm * pxPerCm;

  return {
    width,
    height,
    // Le texte suit les DEUX dimensions. La hauteur d'abord — une ligne unique
    // peut prendre près de la moitié de la carte —, la largeur ensuite, pour
    // qu'une carte basse et large ne reçoive pas un corps que ses noms ne
    // pourraient jamais employer.
    font: Math.max(6, Math.min(SEAT_FONT_MAX_PX, height * 0.46, width * 0.3)),
    // Un filet, pas un cadre : le cerclage de difficulté doit se lire sans
    // manger la place du nom.
    ring: Math.max(1, Math.min(2, height * 0.03)),
    radius: Math.max(4, Math.min(10, height * 0.18)),
    tiny: width < 44,
  };
}

/** Initiales de repli lorsque l'étiquette est trop étroite pour un prénom. */
function studentInitials(student: StudentView): string {
  return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
}

/**
 * Largeur estimée d'un texte, en multiples de la taille de police.
 *
 * Approximation assumée : mesurer chaque nom au `canvas` donnerait la valeur
 * exacte mais coûterait une mesure par élève à chaque redimensionnement.
 *
 * La moyenne unique de 0,55 qui tenait ce rôle était trop pessimiste d'un bon
 * cinquième — « Camille M. » vaut en réalité 4,4 fois sa taille de police, pas
 * 5,5 — et ce cinquième était perdu en corps de texte, sur toutes les cartes.
 * Distinguer quatre familles de caractères suffit à récupérer l'essentiel :
 * les capitales sont larges, les jambages fins ne valent qu'un tiers, et « m »
 * et « w » sont des cas à part. Le compte reste LÉGÈREMENT MAJORÉ, pour que
 * l'étiquette soit au pire un cran trop petite — jamais tronquée.
 */
function textWidthRatio(text: string): number {
  let total = 0;

  for (const char of text) {
    if (" .,'-".includes(char)) total += 0.28;
    else if ("iIjlt".includes(char)) total += 0.32;
    else if ("mw".includes(char)) total += 0.82;
    else if (char !== char.toLowerCase()) total += 0.68;
    else total += 0.52;
  }

  return total;
}

export interface SeatLabel {
  /** Ce qui s'affiche : « Camille M. », ou un repli plus court. */
  text: string | null;
  /** Corps retenu POUR CE TEXTE-LÀ, au plus `metrics.font`. */
  font: number;
}

/**
 * Planchers de lisibilité, en pixels.
 *
 * Un nom écrit à 8 px n'est pas lu, il est deviné : plutôt que de rétrécir
 * indéfiniment « Camille M. », on préfère à ce stade écrire « Camille » en
 * grand. D'où DEUX seuils — le nom en toutes lettres se retire à 10 px, les
 * initiales tiennent jusqu'à 7,5 px parce qu'à ce point elles sont tout ce qui
 * reste avant la carte muette.
 */
const MIN_NAME_PX = 10;
const MIN_INITIALS_PX = 7.5;

/**
 * Rembourrage horizontal de l'étiquette, de part et d'autre du texte.
 *
 * Réduit au strict nécessaire : sur une carte de cent pixels, chaque pixel rendu
 * au texte est un pixel de corps de police en plus. Le cerclage de difficulté
 * s'y ajoute, lui, parce qu'il est peint À L'INTÉRIEUR du cadre.
 */
const LABEL_PADDING_PX = 2;

/** Largeur réellement offerte au texte : la carte, moins bordures et marges. */
function textRoomPx(metrics: SeatMetrics): number {
  // Bordures (2 × 2 px), rembourrage, puis le cerclage intérieur.
  return metrics.width - 4 - 2 * LABEL_PADDING_PX - 2 * metrics.ring;
}

/** Corps auquel `text` remplit exactement `room`, sans dépasser `cap`. */
function fittedSize(text: string, cap: number, room: number): number {
  const ratio = textWidthRatio(text);
  return ratio <= 0 ? cap : Math.min(cap, room / ratio);
}

/**
 * Choisit ce qu'affiche l'étiquette, selon la place dont elle dispose.
 *
 * La forme de référence est TOUJOURS « Camille M. » — prénom, puis initiale du
 * nom de famille. Elle ne dépend ni de la taille de la carte ni de la longueur
 * du nom : une même classe s'écrit partout de la même façon, ce qui rend le
 * plan lisible d'un coup d'œil au lieu de le faire alterner entre trois
 * présentations.
 *
 * Ce qui s'adapte, c'est le CORPS DU TEXTE, calculé nom par nom : le texte se
 * resserre à mesure que la carte rétrécit, au lieu de disparaître d'un coup.
 * On ne renonce à quelque chose qu'une fois le plancher de lisibilité atteint,
 * et dans cet ordre :
 *
 *  1. « Camille M. » ;
 *  2. le prénom seul — l'initiale du nom coûte trois caractères, et à ce stade
 *     mieux vaut « Camille » en grand que « Camille M. » à la loupe ;
 *  3. les initiales ;
 *  4. rien — le cerclage de difficulté reste la seule information.
 *
 * Le nom complet demeure de toute façon dans l'infobulle, dans le panneau
 * latéral et pour les lecteurs d'écran. Le calcul est fait PAR ÉLÈVE : « Léa
 * R. » s'affiche en grand là où « Jean-Baptiste V. » s'affiche en petit.
 */
export function fitStudentLabel(student: StudentView, metrics: SeatMetrics): SeatLabel {
  const inner = textRoomPx(metrics);

  const candidates: Array<[string, number]> = [
    [studentShortName(student), MIN_NAME_PX],
    [student.firstName, MIN_NAME_PX],
    [studentInitials(student), MIN_INITIALS_PX],
  ];

  for (const [text, floor] of candidates) {
    const font = fittedSize(text, metrics.font, inner);
    if (font >= floor) return { text, font };
  }

  return { text: null, font: metrics.font };
}

// ------------------------------------------------------------------ étiquette

export function StudentLabel({
  student,
  full = false,
}: {
  student: StudentView;
  full?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <DifficultyBadge difficulty={student.difficulty} size="sm" />
      <span className="truncate">
        {full ? `${student.lastName} ${student.firstName}` : studentShortName(student)}
      </span>
    </span>
  );
}

// ------------------------------------------------------------------- bac

/**
 * Une ligne du bac, volontairement DENSE : la colonne est étroite et l'on veut
 * voir une classe entière sans la faire défiler. D'où une seule ligne de texte,
 * le nom de famille d'abord — c'est par lui qu'on cherche quelqu'un — et les
 * besoins particuliers réduits à deux lettres.
 */
export function TrayStudent({ student }: { student: StudentView }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentDraggableId(student.id),
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      title={`${student.lastName} ${student.firstName}${student.comment ? ` — ${student.comment}` : ""}`}
      className={cn(
        "flex w-full cursor-grab items-center gap-1.5 rounded-control border border-border bg-surface px-1.5 py-1 text-left text-xs",
        "transition-colors hover:border-primary hover:bg-primary-soft/40 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <DifficultyBadge difficulty={student.difficulty} size="sm" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{student.lastName}</span> {student.firstName}
      </span>
      {(student.needsFront || student.leftHanded) && (
        <span className="shrink-0 text-[9px] text-muted">
          {student.needsFront && <span title="Doit être au premier rang">1er</span>}
          {student.needsFront && student.leftHanded && " "}
          {student.leftHanded && <span title="Gaucher">G</span>}
        </span>
      )}
    </button>
  );
}

/**
 * Colonne « À placer » — la colonne de GAUCHE de l'éditeur, d'après la maquette.
 *
 * Elle ne se replie plus quand tout le monde est placé : elle porte aussi la
 * légende de difficulté, calée en bas, donc elle a toujours quelque chose à
 * montrer. Une fois la classe placée, elle affiche simplement « Tout le monde
 * est placé » et reste la ZONE DE DÉPOSE qui sort un élève du plan — c'est la
 * colonne entière qui est droppable, pas seulement la liste, pour qu'on puisse
 * viser large en glissant.
 *
 * `footer` reçoit la légende plutôt que de l'inclure d'office : la colonne ne
 * connaît ainsi rien du vocabulaire de difficulté.
 */
export function TrayColumn({
  children,
  count,
  footer,
}: {
  children: React.ReactNode;
  count: number;
  footer?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROPPABLE_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        // `flex-1` et non `h-full` : le parent est un conteneur flex en
        // colonne, tantôt étiré par la grille (grand écran), tantôt plafonné
        // par une hauteur maximale (petit écran). Une hauteur en POURCENTAGE
        // ne se résoudrait dans aucun des deux cas — le parent n'a jamais de
        // hauteur explicite — et la liste déborderait au lieu de défiler.
        "flex min-h-0 flex-1 flex-col transition-colors",
        isOver ? "bg-primary-soft" : "bg-surface",
      )}
    >
      <div className="px-3 pb-2 pt-3">
        <h2 className="text-sm font-bold leading-none">À placer</h2>
        <p className="mt-1.5 text-xs leading-snug text-muted">
          {count === 0 ? (
            "Tout le monde est placé. Déposez ici pour retirer."
          ) : (
            <>
              <span className="tabular-nums">{count}</span> élève{count > 1 ? "s" : ""} · glissez
              sur une place
            </>
          )}
        </p>
      </div>

      {/* `min-h-0` autorise ce bloc à se comprimer dans la colonne en flex :
          sans lui, un contenu long pousserait la légende hors de la carte au
          lieu de faire défiler la liste. */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">{children}</div>

      {footer && <div className="mt-auto border-t border-border px-3 py-3">{footer}</div>}
    </div>
  );
}

// ----------------------------------------------------------------- place

/** Ce qu'affiche une place sans élève. */
function emptySeatLabel(seat: SeatView): string {
  return seat.disabled ? "Condamnée" : "Libre";
}

export function SeatSpot({
  seat,
  student,
  pinned,
  conflicted,
  selected,
  leftPercent,
  topPercent,
  metrics,
  onSelect,
}: {
  seat: SeatView;
  student: StudentView | null;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  leftPercent: number;
  topPercent: number;
  metrics: SeatMetrics;
  onSelect: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: seatDroppableId(seat.id) });

  return (
    <div
      ref={setDropRef}
      style={{
        left: `${leftPercent}%`,
        top: `${topPercent}%`,
        width: metrics.width,
        height: metrics.height,
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2"
    >
      {student ? (
        <SeatedStudent
          student={student}
          pinned={pinned}
          conflicted={conflicted}
          selected={selected}
          highlighted={isOver}
          metrics={metrics}
          onSelect={onSelect}
        />
      ) : (
        <div
          style={{
            borderRadius: metrics.radius,
            // Même ajustement que pour un nom : « Condamnée » est deux fois plus
            // long que « Libre » et débordait de la carte, rogné des deux côtés.
            fontSize: fittedSize(emptySeatLabel(seat), metrics.font, textRoomPx(metrics)),
          }}
          className={cn(
            "flex h-full w-full items-center justify-center overflow-hidden border-2 border-dashed",
            seat.disabled
              ? "border-border text-muted opacity-50"
              : isOver
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted",
          )}
          title={seat.disabled ? "Place condamnée" : "Place libre"}
        >
          {metrics.tiny ? "" : emptySeatLabel(seat)}
        </div>
      )}
    </div>
  );
}

function SeatedStudent({
  student,
  pinned,
  conflicted,
  selected,
  highlighted,
  metrics,
  onSelect,
}: {
  student: StudentView;
  pinned: boolean;
  conflicted: boolean;
  selected: boolean;
  highlighted: boolean;
  metrics: SeatMetrics;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: studentDraggableId(student.id),
  });

  // La difficulté n'est plus chiffrée sur l'étiquette : elle doit donc être
  // dite ailleurs. La couleur du cerclage ne porte jamais l'information seule.
  const title = [
    studentFullName(student),
    `difficulté ${student.difficulty}/5`,
    pinned ? "place verrouillée" : null,
    student.comment || null,
  ]
    .filter(Boolean)
    .join(" — ");

  const label = fitStudentLabel(student, metrics);

  /**
   * Le verrouillage se lit à un CERCLAGE ROUGE PERMANENT.
   *
   * Un cadenas en coin d'étiquette débordait à moitié et devenait illisible dès
   * que la salle était grande — l'échelle des étiquettes suit celle du plan.
   *
   * Le cerclage est posé en `outline` et non en `border` : la bordure porte
   * déjà l'état courant — sélection, survol de dépose, conflit — et le rouge
   * disparaîtrait dès qu'on toucherait l'élève. L'`outline` se dessine en
   * dehors du cadre et ne dépend d'aucun de ces états, donc il ne s'éteint
   * jamais. `overflow-hidden` ne le rogne pas : le débordement ne s'applique
   * qu'aux descendants.
   *
   * Le rouge sert aussi aux incompatibilités : les deux se distinguent au
   * TRAIT. Un conflit est POINTILLÉ sur fond teinté — comme la ligne qui relie
   * les deux élèves — là où un verrouillage est un cercle PLEIN.
   */
  const pinRing = Math.max(2, Math.min(3, metrics.height * 0.09));

  return (
    <div
      style={{
        borderRadius: metrics.radius,
        outline: pinned ? `${pinRing}px solid var(--danger)` : undefined,
        outlineOffset: pinned ? 1 : undefined,
        // Le cerclage de difficulté est posé en ombre INTÉRIEURE : il se
        // dessine à l'intérieur du cadre, donc il ne se dispute ni la bordure
        // (sélection, survol, conflit) ni l'`outline` (verrouillage), et les
        // trois restent lisibles ensemble.
        // L'ombre portée qui accompagnait ce cerclage est partie : plus rien
        // n'a de volume dans l'application, une étiquette moins que tout le
        // reste — elles sont des dizaines côte à côte sur le plan.
        boxShadow: `inset 0 0 0 ${metrics.ring}px ${DIFFICULTY_COLORS[student.difficulty]}`,
      }}
      className={cn(
        "relative flex h-full w-full items-center overflow-hidden border-2 transition-colors",
        conflicted
          ? "border-dashed border-danger bg-danger-soft"
          : selected
            ? "border-solid border-primary bg-primary-soft"
            : highlighted
              ? "border-solid border-primary bg-surface"
              : "border-solid border-border bg-surface",
        isDragging && "opacity-40",
      )}
    >
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        onClick={onSelect}
        title={title}
        style={{ paddingInline: metrics.ring + LABEL_PADDING_PX }}
        className="flex h-full w-full cursor-grab flex-col items-center justify-center overflow-hidden text-center leading-tight active:cursor-grabbing"
      >
        {/* « Camille M. », sur toute la largeur. Le corps vient de
            `fitStudentLabel()` et non de `metrics` : il est ajusté à CE nom-là,
            dans CETTE carte. */}
        {label.text && (
          <span className="w-full truncate font-medium" style={{ fontSize: label.font }}>
            {label.text}
          </span>
        )}

        <span className="sr-only">
          {studentFullName(student)} — difficulté {student.difficulty} sur 5
          {pinned ? " — place verrouillée" : ""}
        </span>
      </button>
    </div>
  );
}
