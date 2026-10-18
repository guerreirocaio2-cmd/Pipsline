import { useState } from "react";
import { TrendingUp, Activity, Dumbbell } from "lucide-react";
import {
  exerciseHistory,
  isStagnant,
  progression,
  volume,
  type Session,
  type StrengthSession,
} from "../shared/domain";
import { useStore } from "./store";
import { SectionTitle, Empty, number, date, Modal } from "./ui";
export function SessionList({ sessions }: { sessions: Session[] }) {
  const [detail, setDetail] = useState<Session | null>(null);
  return (
    <>
      <div className="sessions-list">
        {[...sessions]
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .map((s) => (
            <button
              className="session-row"
              key={s.id}
              onClick={() => setDetail(s)}
            >
              <span className="activity-icon">
                {s.kind === "strength" ? (
                  <Dumbbell size={20} />
                ) : (
                  <Activity size={20} />
                )}
              </span>
              <span>
                <strong>{s.kind === "strength" ? s.name : s.activity}</strong>
                <small>
                  {s.kind === "strength"
                    ? `${s.exercises.reduce((n, e) => n + e.sets.filter((x) => x.completedAt).length, 0)} séries · ${number(s.exercises.reduce((n, e) => n + volume(e), 0))} kg de volume`
                    : `${number(s.minutes)} min · ${number(s.distanceKm, 2)} km · esforço ${s.effort}/10`}
                </small>
              </span>
              <time dateTime={s.startedAt}>{date(s.startedAt)}</time>
            </button>
          ))}
      </div>
      {detail && (
        <Modal
          title={detail.kind === "strength" ? detail.name : detail.activity}
          onClose={() => setDetail(null)}
        >
          <p className="help">
            {new Date(detail.startedAt).toLocaleString("pt-BR")}
          </p>
          {detail.kind === "strength" ? (
            detail.exercises.map((e) => (
              <section className="history-detail" key={e.id}>
                <h3>{e.name}</h3>
                <p>
                  {e.skipped ? "Exercício marcado como pulado. " : ""}
                  {e.sets
                    .map(
                      (s, i) =>
                        `${i + 1}: ${s.completedAt ? `${number(s.load, 2)} kg × ${s.reps}` : "não realizada"}`,
                    )
                    .join(" · ")}
                </p>
                {progression(e) !== null && (
                  <p className="success-text">
                    Progressão sugerida: {number(progression(e)!, 2)} kg (maior
                    carga + 2,5 kg).
                  </p>
                )}
              </section>
            ))
          ) : (
            <p>
              {detail.minutes} minutos · {number(detail.distanceKm, 2)} km ·
              esforço {detail.effort}/10
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
function Chart({
  values,
  labels,
  title,
  unit,
}: {
  values: number[];
  labels: string[];
  title: string;
  unit: string;
}) {
  const width = 600,
    height = 160;
  const max = Math.max(...values, 1);
  const coords = values.map((value, i) => [
    30 + (i * (width - 60)) / Math.max(values.length - 1, 1),
    height - 22 - (value / max) * (height - 42),
  ]);
  return (
    <section className="chart-card">
      <div>
        <h3>{title}</h3>
        <strong>
          {number(values.at(-1) ?? 0, 2)} <small>{unit}</small>
        </strong>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${values.map((v, i) => `${labels[i]}: ${number(v, 2)} ${unit}`).join("; ")}`}
      >
        <line x1="20" x2="580" y1="138" y2="138" stroke="var(--border)" />
        <line
          x1="20"
          x2="580"
          y1="80"
          y2="80"
          stroke="var(--border)"
          strokeDasharray="4 6"
        />
        <polyline
          points={coords.map((x) => x.join(",")).join(" ")}
          fill="none"
          stroke="var(--chart)"
          strokeWidth="3"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" fill="var(--chart)">
            <title>
              {labels[i]}: {number(values[i], 2)} {unit}
            </title>
          </circle>
        ))}
      </svg>
      <div className="chart-dates">
        <span>{labels[0]}</span>
        <span>{labels.at(-1)}</span>
      </div>
    </section>
  );
}
export function History() {
  const { vault } = useStore();
  const completed = vault!.state.sessions.filter((s) => s.finishedAt);
  const exerciseIds = [
    ...new Set(
      completed
        .filter((s): s is StrengthSession => s.kind === "strength")
        .flatMap((s) =>
          s.exercises
            .filter((e) => e.sets.some((x) => x.completedAt))
            .map((e) => e.exerciseId),
        ),
    ),
  ];
  const [selected, setSelected] = useState("");
  const active = selected || exerciseIds[0];
  const history = active ? exerciseHistory(completed, active) : [];
  return (
    <>
      <SectionTitle eyebrow="O que você constrói, fica" title="Sua evolução" />
      <p className="page-description">
        Pequenos avanços, vistos ao longo do tempo.
      </p>
      {!completed.length ? (
        <Empty title="A primeira página está em branco">
          Finalize um treino ou registre uma atividade para começar seu
          histórico.
        </Empty>
      ) : (
        <>
          <div className="history-header">
            <h3>Por exercício</h3>
            <select
              value={active ?? ""}
              aria-label="Exercício do histórico"
              onChange={(e) => setSelected(e.target.value)}
            >
              {!exerciseIds.length && (
                <option value="">Sem séries registradas</option>
              )}
              {exerciseIds.map((id) => (
                <option key={id} value={id}>
                  {vault!.state.exercises.find((e) => e.id === id)?.name}
                </option>
              ))}
            </select>
          </div>
          {history.length > 0 && (
            <>
              <div className="charts">
                <Chart
                  title="Maior carga por sessão"
                  values={history.map((x) => x.maxLoad)}
                  labels={history.map((x) => date(x.date))}
                  unit="kg"
                />
                <Chart
                  title="Volume por sessão"
                  values={history.map((x) => x.volume)}
                  labels={history.map((x) => date(x.date))}
                  unit="kg"
                />
              </div>
              <p className="help">
                Maior carga = máximo das séries concluídas. Volume = soma de
                carga × repetições das séries concluídas. Carga corporal não é
                estimada.
              </p>
              {isStagnant(completed, active) && (
                <p className="notice">
                  A maior carga se manteve nas últimas 3 sessões. Isso sinaliza
                  um platô de carga, não um diagnóstico de estagnação muscular.
                </p>
              )}
              {progression(history.at(-1)!.exercise) !== null && (
                <div className="success-note">
                  <TrendingUp size={22} />
                  <p>
                    Você atingiu o topo da faixa em todas as séries da última
                    sessão. Sugestão:{" "}
                    {number(progression(history.at(-1)!.exercise)!, 2)} kg na
                    próxima (maior carga + 2,5 kg).
                  </p>
                </div>
              )}
              <details className="explain">
                <summary>Ver valores usados nos gráficos</summary>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Maior carga</th>
                        <th>Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((x, i) => (
                        <tr key={i}>
                          <td>{new Date(x.date).toLocaleString("pt-BR")}</td>
                          <td>{number(x.maxLoad, 2)} kg</td>
                          <td>{number(x.volume, 2)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
          <SectionTitle title="Atividades registradas" />
          <SessionList sessions={completed} />
        </>
      )}
    </>
  );
}
