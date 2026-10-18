import { describe, it, expect } from "vitest";
import { catalog, starterPlans } from "../shared/catalog";
import {
  exerciseSchema,
  planSchema,
  sessionSchema,
  makeSession,
  progression,
  volume,
  exerciseHistory,
  isStagnant,
  rollingVolume,
  overlay,
  type StrengthSession,
} from "../shared/domain";
const state = () => ({
  exercises: catalog,
  plans: starterPlans(),
  sessions: [],
});
const session = () =>
  makeSession(starterPlans()[0], state(), "2026-10-18T12:00:00.000Z");
function completed(
  load = 10,
  date = "2026-10-18T12:00:00.000Z",
): StrengthSession {
  const s = session();
  s.startedAt = date;
  s.finishedAt = date;
  s.exercises.forEach((e) =>
    e.sets.forEach((set) => {
      set.load = load;
      set.reps = 12;
      set.completedAt = date;
    }),
  );
  return s;
}
describe("catálogo e fichas", () => {
  it("oferece pelo menos 150 exercícios válidos, nomes e IDs únicos", () => {
    expect(catalog.length).toBeGreaterThanOrEqual(150);
    expect(new Set(catalog.map((x) => x.name)).size).toBe(catalog.length);
    expect(new Set(catalog.map((x) => x.id)).size).toBe(catalog.length);
    catalog.forEach((x) =>
      expect(exerciseSchema.safeParse(x).success).toBe(true),
    );
  });
  it("modelos só referenciam exercícios existentes", () => {
    starterPlans().forEach((p) => {
      expect(planSchema.safeParse(p).success).toBe(true);
      p.items.forEach((i) =>
        expect(catalog.some((e) => e.id === i.exerciseId)).toBe(true),
      );
    });
  });
  it("rejeita faixas invertidas e cargas negativas", () => {
    const p = starterPlans()[0];
    p.items[0].maxReps = 2;
    expect(planSchema.safeParse(p).success).toBe(false);
    const s = session();
    s.exercises[0].sets[0].load = -1;
    expect(sessionSchema.safeParse(s).success).toBe(false);
  });
});
describe("volume, histórico e progressão", () => {
  it("conta apenas séries concluídas em carga × repetições", () => {
    const e = session().exercises[0];
    e.sets[0] = {
      ...e.sets[0],
      load: 20,
      reps: 10,
      completedAt: "2026-10-18T12:00:00.000Z",
    };
    e.sets[1].load = 100;
    expect(volume(e)).toBe(200);
  });
  it("sugere aumento apenas com todas as séries no topo da faixa", () => {
    const e = completed(20).exercises[0];
    expect(progression(e)).toBe(22.5);
    e.sets[0].reps = 11;
    expect(progression(e)).toBeNull();
  });
  it("não recomenda aumento com série incompleta ou exercício pulado", () => {
    const e = completed().exercises[0];
    e.skipped = true;
    expect(progression(e)).toBeNull();
    e.skipped = false;
    e.sets[1].completedAt = null;
    expect(progression(e)).toBeNull();
  });
  it("detecta três sessões com carga máxima igual e ignora treinos abertos", () => {
    const sessions = [
      completed(10, "2026-10-15T12:00:00.000Z"),
      completed(10, "2026-10-16T12:00:00.000Z"),
      completed(10),
      session(),
    ];
    const id = sessions[0].exercises[0].exerciseId;
    expect(isStagnant(sessions, id)).toBe(true);
    expect(exerciseHistory(sessions, id)).toHaveLength(3);
    sessions[2].exercises[0].sets[0].load = 12;
    expect(isStagnant(sessions, id)).toBe(false);
  });
  it("preenche a última sessão cronológica, sem aplicar a sugestão automaticamente", () => {
    const s = state();
    const recent = completed(15);
    const earlier = completed(10, "2026-10-01T12:00:00.000Z");
    s.sessions = [recent, earlier] as never[];
    const next = makeSession(s.plans[0], s);
    expect(next.exercises[0].sets[0].load).toBe(15);
    expect(next.exercises[0].sets[0].completedAt).toBeNull();
  });
  it("volume móvel exclui datas antigas e futuras", () => {
    const records = [
      completed(10, "2026-10-01T12:00:00.000Z"),
      completed(10),
      completed(20, "2026-11-01T12:00:00.000Z"),
    ];
    expect(rollingVolume(records, new Date("2026-10-18T15:00:00Z"))).toBe(1080);
  });
  it("sobrepõe uma fila pendente sem alterar o snapshot original", () => {
    const original = state();
    const p = { ...original.plans[0], revision: 2, name: "Ficha offline" };
    const next = overlay(original, [
      {
        id: crypto.randomUUID(),
        entity: "plan",
        expectedRevision: 1,
        payload: p,
      },
    ]);
    expect(next.plans.find((x) => x.id === p.id)?.name).toBe("Ficha offline");
    expect(original.plans[0].name).not.toBe("Ficha offline");
  });
});
