import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  SkipForward,
  Timer,
  TrendingUp,
  X,
  Activity,
} from "lucide-react";
import {
  sessionSchema,
  progression,
  volume,
  isStagnant,
  type StrengthSession,
  type SessionExercise,
} from "../shared/domain";
import { useStore } from "./store";
import { Modal, Field, number } from "./ui";
export function Workout({
  session,
  onClose,
}: {
  session: StrengthSession;
  onClose: () => void;
}) {
  const { mutate, busy, vault } = useStore();
  const [now, setNow] = useState(Date.now());
  const [finish, setFinish] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);
  const exercise = session.exercises[session.currentExercise];
  const completed = session.exercises.reduce(
    (s, e) => s + e.sets.filter((x) => x.completedAt).length,
    0,
  );
  const total = session.exercises.reduce((s, e) => s + e.sets.length, 0);
  const rest = session.restUntil
    ? Math.max(0, Math.ceil((session.restUntil - now) / 1000))
    : 0;
  async function save(next: StrengthSession) {
    const parsed = sessionSchema.safeParse(next);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return false;
    }
    try {
      await mutate("session", parsed.data);
      return true;
    } catch {
      return false;
    }
  }
  function updateExercise(
    next: SessionExercise,
    restUntil = session.restUntil,
  ) {
    return save({
      ...session,
      restUntil,
      exercises: session.exercises.map((e) => (e.id === next.id ? next : e)),
    });
  }
  async function complete(e: React.FormEvent<HTMLFormElement>, setId: string) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const load = Number(data.get("load"));
    const reps = Number(data.get("reps"));
    await updateExercise(
      {
        ...exercise,
        skipped: false,
        sets: exercise.sets.map((s) =>
          s.id === setId
            ? { ...s, load, reps, completedAt: new Date().toISOString() }
            : s,
        ),
      },
      exercise.restSeconds ? Date.now() + exercise.restSeconds * 1000 : null,
    );
  }
  const suggestion = progression(exercise);
  return (
    <div className="workout-view">
      <div className="workout-top">
        <button className="text-button" onClick={onClose}>
          <ArrowLeft size={18} />
          Voltar
        </button>
        <span className="live-label">
          <i />
          Treino em andamento
        </span>
        <button
          className="icon-button"
          aria-label="Minimizar treino"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="workout-intro">
        <p className="eyebrow">{session.name}</p>
        <h1>
          Uma série de cada vez<span>.</span>
        </h1>
        <p>Seu treino é salvo a cada série, mesmo sem internet.</p>
      </div>
      <div className="session-progress">
        <span>
          {completed} de {total} séries concluídas
        </span>
        <span>{Math.round((completed / total) * 100)}%</span>
        <progress value={completed} max={total} />
      </div>
      <div className="training-layout">
        <section className="training-card">
          <div className="exercise-heading">
            <span className="plan-letter">
              {String(session.currentExercise + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="eyebrow">
                Exercício {session.currentExercise + 1} de{" "}
                {session.exercises.length}
              </p>
              <h2>{exercise.name}</h2>
            </div>
          </div>
          <div className="training-tags">
            <span>
              {exercise.minReps}–{exercise.maxReps} repetições
            </span>
            <span>
              <Timer size={15} />
              {exercise.restSeconds}s de pausa
            </span>
            <span>{number(volume(exercise))} kg de volume</span>
          </div>
          {exercise.skipped && (
            <p className="notice">
              Exercício pulado. Você pode voltar e registrar séries quando
              quiser.
            </p>
          )}
          <div className="set-labels">
            <span>Série</span>
            <span>Carga total · kg</span>
            <span>Repetições</span>
            <span>Salvar</span>
          </div>
          {exercise.sets.map((set, i) => (
            <form
              className={`set-row ${set.completedAt ? "done" : ""}`}
              key={`${set.id}:${set.completedAt}`}
              onSubmit={(e) => void complete(e, set.id)}
            >
              <span className="set-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                name="load"
                type="number"
                inputMode="decimal"
                min="0"
                max="1000"
                step="0.25"
                required
                defaultValue={set.load}
                disabled={!!set.completedAt}
                aria-label={`Carga da série ${i + 1}`}
              />
              <input
                name="reps"
                type="number"
                inputMode="numeric"
                min="1"
                max="200"
                required
                defaultValue={set.reps || exercise.minReps}
                disabled={!!set.completedAt}
                aria-label={`Repetições da série ${i + 1}`}
              />
              {set.completedAt ? (
                <button
                  className="set-check checked"
                  type="button"
                  disabled={busy}
                  aria-label={`Desmarcar série ${i + 1}`}
                  onClick={() => {
                    if (
                      confirm(
                        "Desmarcar esta série? O registro será atualizado.",
                      )
                    )
                      void updateExercise(
                        {
                          ...exercise,
                          sets: exercise.sets.map((s) =>
                            s.id === set.id ? { ...s, completedAt: null } : s,
                          ),
                        },
                        null,
                      );
                  }}
                >
                  <Check size={23} />
                </button>
              ) : (
                <button
                  className="set-check"
                  disabled={busy}
                  aria-label={`Concluir série ${i + 1}`}
                >
                  <Check size={23} />
                </button>
              )}
            </form>
          ))}
          <p className="help">
            Toque no ✓ para salvar. Valores vêm da última sessão ou da ficha. Em
            halteres, informe a soma dos dois; use 0 para peso corporal.
          </p>
          {suggestion !== null && (
            <div className="success-note">
              <TrendingUp size={21} />
              <div>
                <strong>
                  Próxima sessão: que tal {number(suggestion, 2)} kg?
                </strong>
                <p>
                  Todas as séries chegaram a {exercise.maxReps} repetições.
                  Sugestão: maior carga + 2,5 kg. Ajuste conforme seu
                  equipamento; não aplicamos automaticamente.
                </p>
              </div>
            </div>
          )}
          {isStagnant(vault!.state.sessions, exercise.exerciseId) && (
            <p className="notice">
              A maior carga ficou igual nas últimas 3 sessões concluídas. Revise
              a recuperação e a execução antes de progredir.
            </p>
          )}
          <div className="training-navigation">
            <button
              className="button secondary"
              disabled={busy || session.currentExercise === 0}
              onClick={() =>
                void save({
                  ...session,
                  currentExercise: session.currentExercise - 1,
                  restUntil: null,
                })
              }
            >
              <ArrowLeft size={17} />
              Anterior
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void save({
                  ...session,
                  restUntil: null,
                  currentExercise: Math.min(
                    session.currentExercise + 1,
                    session.exercises.length - 1,
                  ),
                  exercises: session.exercises.map((e) =>
                    e.id === exercise.id ? { ...e, skipped: true } : e,
                  ),
                })
              }
            >
              <SkipForward size={16} />
              Pular
            </button>
            <button
              className="button primary"
              disabled={
                busy || session.currentExercise === session.exercises.length - 1
              }
              onClick={() =>
                void save({
                  ...session,
                  currentExercise: session.currentExercise + 1,
                  restUntil: null,
                })
              }
            >
              Próximo
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
        <aside className="training-aside">
          <section className={`rest-card ${rest ? "resting" : ""}`}>
            <Timer size={25} />
            <p className="eyebrow">
              {rest ? "Recupere o fôlego" : "No seu tempo"}
            </p>
            <div className="timer" role="timer" aria-label="Tempo de descanso">
              {String(Math.floor(rest / 60)).padStart(2, "0")}
              <span>:</span>
              {String(rest % 60).padStart(2, "0")}
            </div>
            <p>
              {rest
                ? "O descanso começa ao salvar uma série."
                : "O cronômetro inicia automaticamente."}
            </p>
            {rest > 0 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void save({ ...session, restUntil: null })}
              >
                Pular descanso
              </button>
            )}
          </section>
          <section className="session-summary">
            <h3>Seu caminho hoje</h3>
            {session.exercises.map((e, i) => (
              <button
                key={e.id}
                className={i === session.currentExercise ? "current" : ""}
                disabled={busy}
                onClick={() =>
                  void save({ ...session, currentExercise: i, restUntil: null })
                }
              >
                <span>
                  {e.sets.every((s) => s.completedAt) ? (
                    <Check size={17} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  {e.name}
                  <small>
                    {e.sets.filter((s) => s.completedAt).length}/{e.sets.length}{" "}
                    séries{e.skipped ? " · pulado" : ""}
                  </small>
                </span>
              </button>
            ))}
          </section>
          <button
            className="button primary full"
            disabled={busy || !completed}
            onClick={() => setFinish(true)}
          >
            <CheckCheck size={20} />
            Finalizar treino
          </button>
        </aside>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {finish && (
        <Modal title="Encerrar por hoje?" onClose={() => setFinish(false)}>
          <p>
            Você concluiu {completed} de {total} séries e movimentou{" "}
            {number(session.exercises.reduce((n, e) => n + volume(e), 0))} kg de
            volume.
          </p>
          {completed < total && (
            <p className="notice">
              As séries que faltam ficarão como não realizadas. As séries
              concluídas serão preservadas no histórico.
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setFinish(false)}
            >
              Continuar treino
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void save({
                  ...session,
                  finishedAt: new Date().toISOString(),
                  restUntil: null,
                }).then((saved) => {
                  if (saved) {
                    setFinish(false);
                    onClose();
                  }
                })
              }
            >
              Concluir e salvar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function Cardio({ onClose }: { onClose: () => void }) {
  const { mutate, busy } = useStore();
  const [error, setError] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const minutes = Number(data.get("minutes"));
    const ended = new Date();
    const session = {
      id: crypto.randomUUID(),
      revision: 1,
      kind: "cardio" as const,
      activity: data.get("activity"),
      minutes,
      distanceKm: Number(data.get("distance")),
      effort: Number(data.get("effort")),
      startedAt: new Date(ended.getTime() - minutes * 60000).toISOString(),
      finishedAt: ended.toISOString(),
    };
    const parsed = sessionSchema.safeParse(session);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await mutate("session", parsed.data);
      onClose();
    } catch {}
  }
  return (
    <Modal title="Registrar atividade avulsa" onClose={onClose}>
      <p className="help">Registre uma atividade que você acabou de fazer.</p>
      <form onSubmit={save}>
        <Field label="Atividade">
          <select name="activity">
            {["Corrida", "Bike", "Natação", "Caminhada", "Outro"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <div className="two-fields">
          <Field label="Duração (min)">
            <input
              name="minutes"
              type="number"
              min="1"
              max="1440"
              required
              defaultValue="30"
            />
          </Field>
          <Field label="Distância (km)">
            <input
              name="distance"
              type="number"
              min="0"
              max="1000"
              step="0.01"
              defaultValue="0"
              required
            />
          </Field>
        </div>
        <Field
          label="Esforço percebido (1 a 10)"
          hint="1 = muito leve · 10 = esforço máximo"
        >
          <input
            name="effort"
            type="number"
            min="1"
            max="10"
            required
            defaultValue="5"
          />
        </Field>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button primary" disabled={busy}>
            <Activity size={18} />
            Salvar atividade
          </button>
        </div>
      </form>
    </Modal>
  );
}
