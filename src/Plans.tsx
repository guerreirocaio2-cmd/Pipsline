import { useState } from "react";
import {
  Plus,
  X,
  Search,
  Play,
  Pencil,
  Archive,
  ArrowRight,
} from "lucide-react";
import {
  groups,
  planSchema,
  exerciseSchema,
  type Plan,
  type Exercise,
} from "../shared/domain";
import { useStore } from "./store";
import { Modal, Field, SectionTitle, Empty } from "./ui";
export const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function PlanEditor({
  plan,
  onClose,
}: {
  plan?: Plan;
  onClose: () => void;
}) {
  const { vault, mutate, busy } = useStore();
  const [draft, setDraft] = useState<Plan>(
    plan
      ? structuredClone(plan)
      : {
          id: crypto.randomUUID(),
          revision: 1,
          name: "",
          weekdays: [],
          items: [],
          archived: false,
        },
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const change = (id: string, key: string, value: number) =>
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = planSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await mutate("plan", parsed.data);
      onClose();
    } catch {
      /* Erro persistente no cabeçalho. */
    }
  }
  return (
    <Modal title={plan ? "Editar ficha" : "Nova ficha"} onClose={onClose} wide>
      <form onSubmit={save}>
        <Field label="Nome da ficha">
          <input
            required
            minLength={2}
            maxLength={100}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Ex.: Treino A · Superiores"
          />
        </Field>
        <fieldset className="days">
          <legend>
            Dias da semana <span>(opcional)</span>
          </legend>
          {weekdays.map((day, i) => (
            <button
              type="button"
              key={day}
              aria-pressed={draft.weekdays.includes(i)}
              className={draft.weekdays.includes(i) ? "selected" : ""}
              onClick={() =>
                setDraft({
                  ...draft,
                  weekdays: draft.weekdays.includes(i)
                    ? draft.weekdays.filter((x) => x !== i)
                    : [...draft.weekdays, i],
                })
              }
            >
              {day}
            </button>
          ))}
        </fieldset>
        <div className="plan-items">
          {draft.items.map((item, i) => (
            <section className="plan-item" key={item.id}>
              <div className="item-heading">
                <h3>
                  <span>{String(i + 1).padStart(2, "0")}</span>{" "}
                  {
                    vault!.state.exercises.find((x) => x.id === item.exerciseId)
                      ?.name
                  }
                </h3>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover exercício ${i + 1}`}
                  onClick={() => {
                    if (
                      confirm(
                        "Remover este exercício da ficha? A mudança só será aplicada ao salvar.",
                      )
                    )
                      setDraft({
                        ...draft,
                        items: draft.items.filter((x) => x.id !== item.id),
                      });
                  }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="five-fields">
                <Field label="Séries">
                  <input
                    type="number"
                    required
                    min="1"
                    max="12"
                    value={item.sets}
                    onChange={(e) =>
                      change(item.id, "sets", e.target.valueAsNumber)
                    }
                  />
                </Field>
                <Field label="Reps mín.">
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={item.minReps}
                    onChange={(e) =>
                      change(item.id, "minReps", e.target.valueAsNumber)
                    }
                  />
                </Field>
                <Field label="Reps máx.">
                  <input
                    type="number"
                    required
                    min={item.minReps}
                    max="100"
                    value={item.maxReps}
                    onChange={(e) =>
                      change(item.id, "maxReps", e.target.valueAsNumber)
                    }
                  />
                </Field>
                <Field label="Carga (kg)">
                  <input
                    type="number"
                    required
                    min="0"
                    max="1000"
                    step="0.25"
                    value={item.load}
                    onChange={(e) =>
                      change(item.id, "load", e.target.valueAsNumber)
                    }
                  />
                </Field>
                <Field label="Pausa (s)">
                  <input
                    type="number"
                    required
                    min="0"
                    max="900"
                    value={item.restSeconds}
                    onChange={(e) =>
                      change(item.id, "restSeconds", e.target.valueAsNumber)
                    }
                  />
                </Field>
              </div>
            </section>
          ))}
        </div>
        <div className="picker">
          <label className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar exercício para adicionar"
              aria-label="Buscar exercício para adicionar"
            />
          </label>
          <div className="picker-results">
            {vault!.state.exercises
              .filter((x) =>
                x.name
                  .toLocaleLowerCase("pt-BR")
                  .includes(query.toLocaleLowerCase("pt-BR")),
              )
              .slice(0, 6)
              .map((ex) => (
                <button
                  type="button"
                  key={ex.id}
                  onClick={() => {
                    if (draft.items.length >= 50) {
                      setError("Uma ficha pode ter até 50 exercícios.");
                      return;
                    }
                    setDraft({
                      ...draft,
                      items: [
                        ...draft.items,
                        {
                          id: crypto.randomUUID(),
                          exerciseId: ex.id,
                          sets: 3,
                          minReps: 8,
                          maxReps: 12,
                          load: 0,
                          restSeconds: 90,
                        },
                      ],
                    });
                    setQuery("");
                  }}
                >
                  <span>
                    {ex.name}
                    <small>
                      {ex.group} · {ex.equipment}
                    </small>
                  </span>
                  <Plus size={19} />
                </button>
              ))}
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="help">
          Carga zero representa peso corporal ou uma carga ainda não definida.
          Os modelos são pontos de partida; ajuste-os à sua rotina.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            Salvar ficha
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ExerciseEditor({ onClose }: { onClose: () => void }) {
  const { mutate, busy } = useStore();
  const [draft, setDraft] = useState<Exercise>({
    id: crypto.randomUUID(),
    revision: 1,
    name: "",
    equipment: "",
    group: "Peito",
    custom: true,
  });
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = exerciseSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await mutate("exercise", parsed.data);
      onClose();
    } catch {}
  }
  return (
    <Modal title="Seu próprio exercício" onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Nome">
          <input
            value={draft.name}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </Field>
        <Field label="Grupo muscular">
          <select
            value={draft.group}
            onChange={(e) =>
              setDraft({ ...draft, group: e.target.value as Exercise["group"] })
            }
          >
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Equipamento">
          <input
            required
            minLength={2}
            maxLength={80}
            value={draft.equipment}
            onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
            placeholder="Ex.: elástico, halteres, peso corporal"
          />
        </Field>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button primary" disabled={busy}>
            Cadastrar exercício
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Plans({ onStart }: { onStart: (plan: Plan) => void }) {
  const { vault, mutate, busy } = useStore();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [archive, setArchive] = useState<Plan | null>(null);
  const plans = vault!.state.plans.filter((p) => !p.archived);
  return (
    <>
      <SectionTitle eyebrow="A base da sua rotina" title="Suas fichas">
        <button className="button primary" onClick={() => setEditing("new")}>
          <Plus size={19} />
          Nova ficha
        </button>
      </SectionTitle>
      <p className="page-description">
        Organize os exercícios. Ajuste a carga. Encontre seu ritmo.
      </p>
      <div className="plans-grid">
        {plans.map((plan, i) => (
          <article className="plan-card" key={plan.id}>
            <div className="plan-card-top">
              <span className="plan-letter">
                {String.fromCharCode(65 + (i % 26))}
              </span>
              <span className="tag">
                {plan.weekdays.length
                  ? plan.weekdays.map((d) => weekdays[d]).join(" · ")
                  : "Sem dia fixo"}
              </span>
            </div>
            <h3>{plan.name}</h3>
            <p>
              {plan.items.length} exercícios ·{" "}
              {plan.items.reduce((s, x) => s + x.sets, 0)} séries
            </p>
            <ol>
              {plan.items.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <span>
                    {
                      vault!.state.exercises.find(
                        (e) => e.id === item.exerciseId,
                      )?.name
                    }
                  </span>
                  <small>
                    {item.sets} × {item.minReps}–{item.maxReps}
                  </small>
                </li>
              ))}
            </ol>
            {plan.items.length > 4 && (
              <p className="help">+ {plan.items.length - 4} exercícios</p>
            )}
            <div className="plan-card-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => onStart(plan)}
              >
                <Play size={16} fill="currentColor" />
                Treinar
              </button>
              <button
                className="icon-button"
                aria-label={`Editar ${plan.name}`}
                onClick={() => setEditing(plan)}
              >
                <Pencil size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={`Arquivar ${plan.name}`}
                onClick={() => setArchive(plan)}
              >
                <Archive size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!plans.length && (
        <Empty title="Sua rotina começa aqui">
          Crie uma ficha com os exercícios que fazem sentido para você.
        </Empty>
      )}
      {vault!.state.plans.some((p) => p.archived) && (
        <details className="archived">
          <summary>Fichas arquivadas</summary>
          {vault!.state.plans
            .filter((p) => p.archived)
            .map((p) => (
              <div className="list-row" key={p.id}>
                <span>{p.name}</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void mutate("plan", { ...p, archived: false }).catch(
                      () => {},
                    )
                  }
                >
                  Restaurar
                  <ArrowRight size={16} />
                </button>
              </div>
            ))}
        </details>
      )}
      {editing && (
        <PlanEditor
          plan={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {archive && (
        <Modal title="Arquivar esta ficha?" onClose={() => setArchive(null)}>
          <p>
            O histórico de {archive.name} será preservado. Você poderá restaurar
            a ficha depois.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setArchive(null)}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void mutate("plan", { ...archive, archived: true })
                  .then(() => setArchive(null))
                  .catch(() => {})
              }
            >
              Arquivar ficha
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Exercises() {
  const { vault } = useStore();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Todos");
  const [newExercise, setNewExercise] = useState(false);
  const list = vault!.state.exercises.filter(
    (x) =>
      (group === "Todos" || x.group === group) &&
      `${x.name} ${x.equipment}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  return (
    <>
      <SectionTitle
        eyebrow="Movimento com propósito"
        title="Biblioteca de exercícios"
      >
        <button className="button primary" onClick={() => setNewExercise(true)}>
          <Plus size={19} />
          Criar exercício
        </button>
      </SectionTitle>
      <p className="page-description">
        {vault!.state.exercises.filter((x) => !x.custom).length} exercícios de
        base e espaço para os seus.
      </p>
      <div className="filters">
        <label className="search">
          <Search size={19} />
          <input
            placeholder="Buscar nome ou equipamento"
            aria-label="Buscar nome ou equipamento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filtrar grupo muscular"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        >
          <option>Todos</option>
          {groups.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>
      <p className="help">{list.length} exercícios encontrados</p>
      <div className="exercise-grid">
        {list.map((ex, i) => (
          <article className="exercise-card" key={ex.id}>
            <span className="exercise-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className="eyebrow">{ex.group}</span>
              <h3>{ex.name}</h3>
              <p>
                {ex.equipment}
                {ex.custom ? " · Seu exercício" : ""}
              </p>
            </div>
          </article>
        ))}
      </div>
      {!list.length && (
        <Empty title="Nenhum exercício encontrado">
          Tente outro nome ou altere o grupo muscular.
        </Empty>
      )}
      {newExercise && <ExerciseEditor onClose={() => setNewExercise(false)} />}
    </>
  );
}
