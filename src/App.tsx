import { useEffect, useState, type ComponentType } from "react";
import {
  LayoutDashboard,
  Dumbbell,
  Library,
  ChartNoAxesCombined,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Play,
  LockKeyhole,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  LoaderCircle,
  RefreshCw,
  Download,
  CalendarDays,
  Zap,
  Target,
  ShieldCheck,
  WifiOff,
  X,
  Smartphone,
} from "lucide-react";
import { useStore, api } from "./store";
import {
  makeSession,
  localDay,
  rollingVolume,
  volume,
  type Plan,
  type StrengthSession,
} from "../shared/domain";
import { Brand, SectionTitle, Empty, Modal, number, download } from "./ui";
import { Plans, Exercises, weekdays } from "./Plans";
import { Workout, Cardio } from "./Workout";
import { History, SessionList } from "./History";
type Page = "home" | "plans" | "exercises" | "history";
const navigation: {
  id: Page;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}[] = [
  { id: "home", label: "Visão geral", Icon: LayoutDashboard },
  { id: "plans", label: "Minhas fichas", Icon: Dumbbell },
  { id: "exercises", label: "Exercícios", Icon: Library },
  { id: "history", label: "Evolução", Icon: ChartNoAxesCombined },
];
function Login() {
  const { login, busy, error, clearError } = useStore();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [requiresSetupToken, setRequiresSetupToken] = useState(false);
  const [localError, setLocalError] = useState("");
  useEffect(() => {
    void api<{ configured: boolean; requiresSetupToken?: boolean }>(
      "/auth/status",
    )
      .then((r) => {
        setConfigured(r.configured);
        setRequiresSetupToken(r.requiresSetupToken ?? false);
      })
      .catch(() => setConfigured(true));
  }, []);
  const setup = configured === false;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLocalError("");
    if (setup && password !== confirmation) {
      setLocalError("As senhas precisam ser iguais.");
      return;
    }
    try {
      await login(password, setup, setupToken);
    } catch {}
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-copy">
          <span className="tag">Seu espaço de evolução</span>
          <h1>
            Consistência
            <br />
            muda <em>tudo.</em>
          </h1>
          <p>
            Um treino de cada vez.
            <br />
            Um pouco mais perto de você.
          </p>
          <div className="story-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <Dumbbell size={76} />
          </div>
        </div>
        <p className="story-bottom">SEU RITMO. SUA EVOLUÇÃO.</p>
      </section>
      <section className="login-form-wrap">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="login-form">
          <span className="eyebrow">BEM-VINDO AO PIPSFIT</span>
          <h2>{setup ? "Um bom começo." : "Bom ter você aqui."}</h2>
          <p>
            {setup
              ? "Crie uma senha para proteger seu espaço pessoal."
              : "Desbloqueie seu espaço. Seu próximo passo começa aqui."}
          </p>
          <form onSubmit={submit}>
            {setup && requiresSetupToken && (
              <label className="field">
                <span>Código de ativação</span>
                <input
                  aria-label="Código de ativação"
                  type="password"
                  required
                  minLength={32}
                  maxLength={256}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                />
                <small>
                  Use o código PIPSFIT_SETUP_TOKEN do painel da hospedagem. Ele
                  é necessário apenas para criar a conta.
                </small>
              </label>
            )}
            <label className="field">
              <span>{setup ? "Crie sua senha" : "Sua senha"}</span>
              <input
                aria-label={setup ? "Crie sua senha" : "Sua senha"}
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete={setup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Pelo menos 12 caracteres"
              />
            </label>
            {setup && (
              <label className="field">
                <span>Confirme a senha</span>
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
            )}
            {(error || localError) && (
              <p className="form-error" role="alert">
                {localError || error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy || configured === null}
            >
              {busy ? (
                <LoaderCircle className="spin" size={19} />
              ) : (
                <LockKeyhole size={18} />
              )}{" "}
              {setup ? "Criar meu espaço" : "Entrar no meu espaço"}
              <ArrowRight size={19} />
            </button>
          </form>
          <div className="privacy-note">
            <ShieldCheck size={21} />
            <p>
              Seus registros ficam criptografados neste aparelho e no servidor.
              A senha desbloqueia o acesso local, inclusive offline por até 7
              dias após entrar online.
            </p>
          </div>
          <p className="help">
            {setup
              ? "Guarde a senha em um lugar seguro. Esta versão não oferece recuperação de senha."
              : "Use o mesmo aparelho e a mesma senha para acessar os registros offline."}
          </p>
        </div>
        <small className="login-foot">Feito para cuidar da sua rotina.</small>
      </section>
    </main>
  );
}
function Home({
  onStart,
  onPage,
  onCardio,
}: {
  onStart: (p: Plan) => void;
  onPage: (p: Page) => void;
  onCardio: () => void;
}) {
  const { vault, busy } = useStore();
  const state = vault!.state;
  const today = new Date();
  const plans = state.plans.filter((p) => !p.archived);
  const todayPlan =
    plans.find((p) => p.weekdays.includes(today.getDay())) ?? plans[0];
  const active = state.sessions.find(
    (s): s is StrengthSession => s.kind === "strength" && !s.finishedAt,
  );
  const start = new Date(today);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  const completed = state.sessions.filter((s) => !!s.finishedAt);
  const weekSessions = completed.filter(
    (s) => new Date(s.startedAt) >= start && new Date(s.startedAt) <= today,
  );
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 29);
  cutoff.setHours(0, 0, 0, 0);
  const days = new Set(
    completed
      .filter(
        (s) =>
          new Date(s.startedAt) >= cutoff && new Date(s.startedAt) <= today,
      )
      .map((s) => localDay(s.startedAt)),
  ).size;
  const vol = rollingVolume(completed, today);
  return (
    <>
      <div className="home-title">
        <div>
          <p className="eyebrow">UM NOVO DIA, UM NOVO PASSO</p>
          <h1>
            Seu ritmo.
            <br />
            <span>Sua evolução.</span>
          </h1>
        </div>
        <div className="today-date">
          <CalendarDays size={18} />
          <span>
            {today.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
        </div>
      </div>
      <section className="hero-card">
        <div className="hero-content">
          <span className="hero-label">
            <i />
            {active
              ? "VOCÊ JÁ COMEÇOU"
              : todayPlan?.weekdays.includes(today.getDay())
                ? "SEU TREINO DE HOJE"
                : "SEU PRÓXIMO TREINO"}
          </span>
          <h2>
            {active
              ? "Seu treino espera\npor você."
              : "Hoje é dia de\ncuidar de você."}
          </h2>
          <p>
            {active
              ? active.name
              : todayPlan
                ? todayPlan.name
                : "Monte uma ficha e dê o primeiro passo."}
          </p>
          <div className="hero-meta">
            {active ? (
              <span>
                {active.exercises.reduce(
                  (n, e) => n + e.sets.filter((x) => x.completedAt).length,
                  0,
                )}{" "}
                séries salvas
              </span>
            ) : todayPlan ? (
              <>
                <span>{todayPlan.items.length} exercícios</span>
                <span>
                  {todayPlan.items.reduce((n, i) => n + i.sets, 0)} séries
                  planejadas
                </span>
              </>
            ) : (
              <span>Uma rotina que cabe na sua vida</span>
            )}
          </div>
          <button
            className="button lime"
            disabled={busy}
            onClick={() => (todayPlan ? onStart(todayPlan) : onPage("plans"))}
          >
            <Play size={17} fill="currentColor" />
            {active
              ? "Continuar treino"
              : todayPlan
                ? "Começar treino"
                : "Criar minha ficha"}
            <ArrowUpRight size={19} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="hero-dumbbell">
            <Dumbbell size={128} strokeWidth={1.2} />
          </div>
          <span className="art-caption">CADA REPETIÇÃO CONTA.</span>
        </div>
      </section>
      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-title">
            <span>Treinos nesta semana</span>
            <Dumbbell size={20} />
          </div>
          <div className="stat-value">
            {weekSessions.length}
            <small>treinos</small>
          </div>
          <p>De segunda até hoje</p>
        </article>
        <article className="stat-card">
          <div className="stat-title">
            <span>Volume nos últimos 7 dias</span>
            <Zap size={20} />
          </div>
          <div className="stat-value">
            {number(vol)}
            <small>kg</small>
          </div>
          <p>Soma de carga × repetições concluídas</p>
        </article>
        <article className="stat-card">
          <div className="stat-title">
            <span>Consistência em 30 dias</span>
            <Target size={20} />
          </div>
          <div className="stat-value">
            {days}
            <small>/ 30 dias</small>
          </div>
          <div
            className="consistency-dots"
            aria-label={`${days} dias com treino nos últimos 30 dias`}
          >
            {Array.from({ length: 30 }, (_, i) => {
              const d = new Date(cutoff);
              d.setDate(d.getDate() + i);
              return (
                <i
                  key={i}
                  className={
                    completed.some((s) => localDay(s.startedAt) === localDay(d))
                      ? "filled"
                      : ""
                  }
                />
              );
            })}
          </div>
        </article>
      </div>
      <SectionTitle title="Seu plano, na prática">
        <button className="text-button" onClick={() => onPage("plans")}>
          Ver fichas
          <ArrowUpRight size={17} />
        </button>
      </SectionTitle>
      <div className="mini-plans">
        {plans.slice(0, 3).map((plan, i) => (
          <button
            className="mini-plan"
            key={plan.id}
            onClick={() => onStart(plan)}
            disabled={busy}
          >
            <span className="plan-letter">{String.fromCharCode(65 + i)}</span>
            <div>
              <h3>{plan.name}</h3>
              <p>
                {plan.items.length} exercícios ·{" "}
                {plan.weekdays.length
                  ? plan.weekdays.map((x) => weekdays[x]).join(", ")
                  : "No seu tempo"}
              </p>
            </div>
            <ArrowUpRight size={20} />
          </button>
        ))}
      </div>
      {!plans.length && (
        <Empty title="Uma rotina com a sua cara">
          Adicione sua primeira ficha em Minhas fichas.
        </Empty>
      )}
      <div className="home-bottom">
        <section>
          <SectionTitle title="Últimos movimentos">
            <button className="text-button" onClick={() => onPage("history")}>
              Histórico
              <ArrowUpRight size={17} />
            </button>
          </SectionTitle>
          {completed.length ? (
            <SessionList sessions={completed.slice(-3)} />
          ) : (
            <div className="quiet-empty">
              <Dumbbell size={23} />
              <p>
                Seu próximo treino pode ser o primeiro.
                <br />
                <span>Os registros aparecem aqui depois de concluir.</span>
              </p>
            </div>
          )}
        </section>
        <aside className="cardio-card">
          <span className="eyebrow">ALÉM DA MUSCULAÇÃO</span>
          <h3>Todo movimento conta.</h3>
          <p>Correu, pedalou, nadou ou caminhou? Registre sua atividade.</p>
          <button className="text-button" onClick={onCardio}>
            Registrar atividade
            <Plus size={18} />
          </button>
        </aside>
      </div>
      <p className="phase-note">
        Fase 1 · Treinos. Alimentação, medidas e bioimpedância serão adicionadas
        nas próximas fases.
      </p>
    </>
  );
}
function Export({ onClose }: { onClose: () => void }) {
  const { vault } = useStore();
  function json() {
    download(
      `pipsfit-${localDay(new Date().toISOString())}.json`,
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          state: vault!.state,
          pendingOperations: vault!.outbox,
        },
        null,
        2,
      ),
      "application/json",
    );
  }
  function csv() {
    const rows: unknown[][] = [
      [
        "tipo",
        "id",
        "nome",
        "data",
        "exercicio",
        "serie",
        "carga_kg",
        "repeticoes",
        "concluida_em",
        "duracao_min",
        "distancia_km",
        "esforco",
        "dados_json",
      ],
    ];
    for (const ex of vault!.state.exercises)
      rows.push([
        "exercicio",
        ex.id,
        ex.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        JSON.stringify(ex),
      ]);
    for (const p of vault!.state.plans)
      rows.push([
        "ficha",
        p.id,
        p.name,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        JSON.stringify(p),
      ]);
    for (const s of vault!.state.sessions) {
      if (s.kind === "strength")
        for (const e of s.exercises)
          for (const [i, set] of e.sets.entries())
            rows.push([
              "serie",
              s.id,
              s.name,
              s.startedAt,
              e.name,
              i + 1,
              set.load,
              set.reps,
              set.completedAt ?? "",
              "",
              "",
              "",
              JSON.stringify({ session: s, exercise: e, set }),
            ]);
      else
        rows.push([
          "cardio",
          s.id,
          s.activity,
          s.startedAt,
          "",
          "",
          "",
          "",
          "",
          s.minutes,
          s.distanceKm,
          s.effort,
          JSON.stringify(s),
        ]);
    }
    download(
      `pipsfit-${localDay(new Date().toISOString())}.csv`,
      rows
        .map((r) =>
          r
            .map((value) => {
              let text = String(value ?? "");
              if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
              return '"' + text.replaceAll('"', '""') + '"';
            })
            .join(";"),
        )
        .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <Modal title="Seus dados, com você" onClose={onClose}>
      <p>
        A exportação inclui os dados deste aparelho e registros ainda não
        sincronizados. JSON inclui também a fila de sincronização; CSV inclui o
        conteúdo completo de cada registro na coluna dados_json.
      </p>
      <p className="notice">
        Os arquivos exportados ficam sem criptografia. Guarde-os em um local
        privado. Não incluem senha, sessão ou chave do servidor.
      </p>
      <div className="export-options">
        <button className="button primary" onClick={json}>
          <Download size={18} />
          Exportar JSON
        </button>
        <button className="button secondary" onClick={csv}>
          <Download size={18} />
          Exportar CSV
        </button>
      </div>
    </Modal>
  );
}
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const {
    vault,
    busy,
    error,
    syncError,
    online,
    syncing,
    lastSync,
    lock,
    mutate,
    sync,
    recover,
    clearError,
  } = useStore();
  const [page, setPage] = useState<Page>("home");
  const [training, setTraining] = useState<string | null>(null);
  const [cardio, setCardio] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem("pipsfit-theme") ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pipsfit-theme", theme);
  }, [theme]);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  if (!vault) return <Login />;
  const active = vault.state.sessions.find(
    (s): s is StrengthSession => s.kind === "strength" && !s.finishedAt,
  );
  const session = vault.state.sessions.find(
    (s): s is StrengthSession =>
      s.id === training && s.kind === "strength" && !s.finishedAt,
  );
  async function start(plan: Plan) {
    if (active) {
      setTraining(active.id);
      return;
    }
    const next = makeSession(plan, vault!.state);
    try {
      await mutate("session", next);
      setTraining(next.id);
    } catch {}
  }
  function go(next: Page) {
    setTraining(null);
    setPage(next);
    window.scrollTo({ top: 0 });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand-button"
          aria-label="Pipsfit, início"
          onClick={() => go("home")}
        >
          <Brand />
        </button>
        <p className="sidebar-label">SEU ESPAÇO</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={!session && page === id ? "active" : ""}
              aria-current={!session && page === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
              {!session && page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-motivation">
            <span>UM PASSO POR VEZ.</span>
            <p>
              O progresso acontece
              <br />
              quando você aparece.
            </p>
            <div className="motivation-line" />
          </div>
          <button onClick={() => setExporting(true)}>
            <Download size={19} />
            Exportar meus dados
          </button>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}Tema{" "}
            {theme === "dark" ? "claro" : "escuro"}
          </button>
          <button onClick={() => void lock()}>
            <LockKeyhole size={19} />
            Bloquear aplicativo
          </button>
          <div className="sidebar-profile">
            <span>P</span>
            <div>
              <strong>Meu espaço pessoal</strong>
              <small>Privado por padrão</small>
            </div>
            <ShieldCheck size={18} />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="breadcrumb">
            Meu espaço <span>/</span>{" "}
            {session
              ? "Treinando"
              : navigation.find((x) => x.id === page)?.label}
          </span>
          <div className="topbar-right">
            <button
              className={`sync-pill ${!online || syncError ? "offline" : ""}`}
              onClick={() => void sync()}
              aria-label="Sincronizar registros"
              title={
                lastSync
                  ? `Última sincronização: ${lastSync.toLocaleTimeString("pt-BR")}`
                  : "Sincronizar registros"
              }
            >
              {syncing ? (
                <LoaderCircle size={16} className="spin" />
              ) : !online ? (
                <CloudOff size={16} />
              ) : (
                <Cloud size={16} />
              )}
              <span>
                {syncing
                  ? "Sincronizando"
                  : vault.outbox.length
                    ? `${vault.outbox.length} pendente${vault.outbox.length > 1 ? "s" : ""}`
                    : !online
                      ? "Offline"
                      : syncError
                        ? "Requer atenção"
                        : "Tudo sincronizado"}
              </span>
            </button>
            <button
              className="avatar"
              aria-label="Privacidade e instalação"
              onClick={() => setHelp(true)}
            >
              P
            </button>
          </div>
        </header>
        <div className="mobile-heading">
          <Brand />
          <button
            className="icon-button"
            aria-label="Bloquear aplicativo"
            onClick={() => void lock()}
          >
            <LockKeyhole size={19} />
          </button>
        </div>
        {(error || syncError) && (
          <div
            className={`global-message ${error ? "error" : ""}`}
            role="status"
          >
            <div>
              <WifiOff size={19} />
              <span>{error || syncError}</span>
            </div>
            <div>
              {syncError.includes("outro dispositivo") && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Preservar os registros pendentes como cópias e manter os dados do servidor? Nenhum dos dois será apagado.",
                      )
                    )
                      void recover();
                  }}
                >
                  Preservar como cópias
                </button>
              )}
              <button
                className="text-button"
                onClick={() => setExporting(true)}
              >
                Exportar cópia
              </button>
              {error && (
                <button
                  className="icon-button"
                  aria-label="Fechar aviso"
                  onClick={clearError}
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>
        )}
        {active && !session && (
          <div className="resume-banner">
            <span>
              <i />
              Você tem um treino em andamento
            </span>
            <button
              className="text-button"
              onClick={() => setTraining(active.id)}
            >
              Continuar
              <ArrowRight size={17} />
            </button>
          </div>
        )}
        <div className="page-content" key={session ? "training" : page}>
          {session ? (
            <Workout
              session={session}
              onClose={() => {
                setTraining(null);
                setPage("history");
              }}
            />
          ) : page === "home" ? (
            <Home
              onStart={(p) => void start(p)}
              onPage={go}
              onCardio={() => setCardio(true)}
            />
          ) : page === "plans" ? (
            <Plans onStart={(p) => void start(p)} />
          ) : page === "exercises" ? (
            <Exercises />
          ) : (
            <History />
          )}
        </div>
        <footer className="main-footer">
          <span>Pipsfit · Um compromisso com você.</span>
          <button className="text-button" onClick={() => setHelp(true)}>
            <ShieldCheck size={14} />
            Privacidade e instalação
          </button>
        </footer>
      </main>
      <nav className="mobile-nav" aria-label="Navegação no celular">
        {navigation.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={!session && page === id ? "active" : ""}
            onClick={() => go(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {cardio && <Cardio onClose={() => setCardio(false)} />}{" "}
      {exporting && <Export onClose={() => setExporting(false)} />}
      {help && (
        <Modal title="Seu espaço, protegido" onClose={() => setHelp(false)}>
          <p>
            Dados pessoais criptografados no servidor com AES-256-GCM e neste
            aparelho com uma chave derivada da sua senha. A chave do servidor é
            um arquivo privado separado do banco.
          </p>
          <p>
            O bloqueio remove a chave local da memória. A cópia offline continua
            criptografada neste navegador. Depois de 15 minutos em segundo
            plano, o app solicita a senha novamente ao voltar.
          </p>
          <p className="notice">
            Limpar os dados do navegador ou perder este aparelho antes de
            sincronizar pode apagar a cópia local. Sincronize e exporte backups
            regularmente. Não há recuperação de senha nesta fase.
          </p>
          <h3>
            <Smartphone size={19} />
            Instalar no celular
          </h3>
          <p>
            Acesse por HTTPS e use “Instalar aplicativo” no Chrome ou “Adicionar
            à Tela de Início” no Safari. Abra o app online uma vez antes de
            usá-lo offline. Na rede local, use HTTPS: o navegador permite PWA em
            HTTP apenas no localhost.
          </p>
          {install && (
            <button
              className="button primary"
              onClick={() => void install.prompt().then(() => setInstall(null))}
            >
              Instalar Pipsfit
            </button>
          )}
          <div className="help-actions">
            <button
              className="button secondary"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}Usar
              tema {theme === "dark" ? "claro" : "escuro"}
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setHelp(false);
                setExporting(true);
              }}
            >
              <Download size={18} />
              Exportar dados
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
