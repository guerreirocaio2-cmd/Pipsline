import { z } from "zod";
z.setErrorMap((issue) => {
  if (issue.code === "invalid_type")
    return {
      message:
        issue.expected === "number"
          ? "Informe um número válido."
          : "Preencha os campos com valores válidos.",
    };
  if (issue.code === "too_small")
    return {
      message: `O valor mínimo é ${issue.minimum}. Confira os campos da ficha.`,
    };
  if (issue.code === "too_big")
    return {
      message: `O valor máximo é ${issue.maximum}. Confira os campos preenchidos.`,
    };
  if (issue.code === "invalid_enum_value")
    return { message: "Escolha uma das opções disponíveis." };
  return { message: "Confira os campos preenchidos e tente novamente." };
});
export const groups = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Quadríceps",
  "Posteriores e glúteos",
  "Panturrilhas",
  "Abdômen",
  "Cardio",
] as const;
const id = z.string().min(1).max(100);
const revision = z.number().int().min(1);
export const exerciseSchema = z.object({
  id,
  revision,
  name: z.string().trim().min(2).max(120),
  group: z.enum(groups),
  equipment: z.string().trim().min(2).max(80),
  custom: z.boolean(),
});
export const planItemSchema = z
  .object({
    id,
    exerciseId: id,
    sets: z.number().int().min(1).max(12),
    minReps: z.number().int().min(1).max(100),
    maxReps: z.number().int().min(1).max(100),
    load: z.number().min(0).max(1000),
    restSeconds: z.number().int().min(0).max(900),
  })
  .refine((x) => x.maxReps >= x.minReps, {
    message: "A repetição máxima precisa ser maior ou igual à mínima.",
  });
export const planSchema = z.object({
  id,
  revision,
  name: z.string().trim().min(2).max(100),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  items: z.array(planItemSchema).min(1).max(50),
  archived: z.boolean(),
});
export const setSchema = z.object({
  id,
  load: z.number().min(0).max(1000),
  reps: z.number().int().min(0).max(200),
  completedAt: z.string().datetime().nullable(),
});
export const sessionExerciseSchema = z.object({
  id,
  exerciseId: id,
  name: z.string().min(1).max(120),
  minReps: z.number().int().min(1).max(100),
  maxReps: z.number().int().min(1).max(100),
  restSeconds: z.number().int().min(0).max(900),
  skipped: z.boolean(),
  sets: z.array(setSchema).min(1).max(12),
});
const sessionBase = {
  id,
  revision,
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
};
export const sessionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...sessionBase,
    kind: z.literal("strength"),
    planId: id,
    name: z.string().min(1).max(100),
    currentExercise: z.number().int().min(0).max(49),
    exercises: z.array(sessionExerciseSchema).min(1).max(50),
    restUntil: z.number().nullable(),
  }),
  z.object({
    ...sessionBase,
    kind: z.literal("cardio"),
    activity: z.enum(["Corrida", "Bike", "Natação", "Caminhada", "Outro"]),
    minutes: z.number().positive().max(1440),
    distanceKm: z.number().min(0).max(1000),
    effort: z.number().int().min(1).max(10),
  }),
]);
export type Exercise = z.infer<typeof exerciseSchema>;
export type Plan = z.infer<typeof planSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type StrengthSession = Extract<Session, { kind: "strength" }>;
export type SessionExercise = z.infer<typeof sessionExerciseSchema>;
export type State = {
  exercises: Exercise[];
  plans: Plan[];
  sessions: Session[];
};
export type Entity = "exercise" | "plan" | "session";
export const operationSchema = z.object({
  id: z.string().uuid(),
  entity: z.enum(["exercise", "plan", "session"]),
  expectedRevision: z.number().int().min(0),
  payload: z.unknown(),
});
export type Operation = {
  id: string;
  entity: Entity;
  expectedRevision: number;
  payload: Exercise | Plan | Session;
};
export const emptyState = (): State => ({
  exercises: [],
  plans: [],
  sessions: [],
});
export const entityKey = (entity: Entity) =>
  (({ exercise: "exercises", plan: "plans", session: "sessions" }) as const)[
    entity
  ];
export function overlay(state: State, operations: Operation[]): State {
  const result = structuredClone(state);
  for (const op of operations) {
    const key = entityKey(op.entity);
    (result[key] as (Exercise | Plan | Session)[]) = [
      ...result[key].filter((x) => x.id !== op.payload.id),
      op.payload,
    ];
  }
  return result;
}
export function volume(exercise: SessionExercise): number {
  return exercise.sets
    .filter((x) => x.completedAt)
    .reduce((sum, x) => sum + x.load * x.reps, 0);
}
export function progression(
  exercise: SessionExercise,
  increment = 2.5,
): number | null {
  return !exercise.skipped &&
    exercise.sets.every((x) => x.completedAt && x.reps >= exercise.maxReps)
    ? Math.round(
        (Math.max(...exercise.sets.map((x) => x.load)) + increment) * 100,
      ) / 100
    : null;
}
export function exerciseHistory(sessions: Session[], exerciseId: string) {
  return sessions
    .filter(
      (s): s is StrengthSession => s.kind === "strength" && !!s.finishedAt,
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .flatMap((s) =>
      s.exercises
        .filter(
          (e) =>
            e.exerciseId === exerciseId && e.sets.some((x) => x.completedAt),
        )
        .map((e) => ({
          date: s.startedAt,
          maxLoad: Math.max(
            ...e.sets.filter((x) => x.completedAt).map((x) => x.load),
          ),
          volume: volume(e),
          exercise: e,
        })),
    );
}
export function isStagnant(sessions: Session[], exerciseId: string): boolean {
  const last = exerciseHistory(sessions, exerciseId).slice(-3);
  return last.length === 3 && last.every((x) => x.maxLoad === last[0].maxLoad);
}
export function makeSession(
  plan: Plan,
  state: State,
  now = new Date().toISOString(),
): StrengthSession {
  return {
    id: crypto.randomUUID(),
    revision: 1,
    kind: "strength",
    planId: plan.id,
    name: plan.name,
    startedAt: now,
    finishedAt: null,
    currentExercise: 0,
    restUntil: null,
    exercises: plan.items.map((item) => {
      const last = exerciseHistory(state.sessions, item.exerciseId).at(
        -1,
      )?.exercise;
      return {
        id: crypto.randomUUID(),
        exerciseId: item.exerciseId,
        name:
          state.exercises.find((e) => e.id === item.exerciseId)?.name ??
          "Exercício",
        minReps: item.minReps,
        maxReps: item.maxReps,
        restSeconds: item.restSeconds,
        skipped: false,
        sets: Array.from({ length: item.sets }, (_, i) => ({
          id: crypto.randomUUID(),
          load: last?.sets[i]?.load ?? item.load,
          reps: last?.sets[i]?.reps ?? item.minReps,
          completedAt: null,
        })),
      };
    }),
  };
}
export function localDay(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function rollingVolume(sessions: Session[], now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return sessions
    .filter(
      (s): s is StrengthSession =>
        s.kind === "strength" &&
        !!s.finishedAt &&
        new Date(s.startedAt) >= start &&
        new Date(s.startedAt) <= now,
    )
    .reduce(
      (sum, s) => sum + s.exercises.reduce((n, e) => n + volume(e), 0),
      0,
    );
}
