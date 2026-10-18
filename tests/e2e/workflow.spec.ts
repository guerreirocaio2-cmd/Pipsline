import { test, expect } from "@playwright/test";
const password = "senha-exclusiva-de-teste-123";
test("Fase 1: ficha, série offline, recarga, sincronização e exportação", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Código de ativação", { exact: true })
    .fill("codigo-de-ativacao-exclusivo-de-teste-123");
  await page.getByLabel("Crie sua senha", { exact: true }).fill(password);
  await page.getByLabel("Confirme a senha").fill(password);
  await page.getByRole("button", { name: "Criar meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu ritmo. Sua evolução." }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: "Minhas fichas" })
    .click();
  await page.getByRole("button", { name: "Nova ficha", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da ficha").fill("Teste de treino pessoal");
  await dialog.getByRole("button", { name: "Seg", exact: true }).click();
  await dialog
    .getByLabel("Buscar exercício para adicionar")
    .fill("Supino reto com halteres");
  await dialog
    .getByRole("button", { name: "Supino reto com halteres" })
    .click();
  await dialog.getByLabel("Carga (kg)").fill("20");
  await dialog.getByLabel("Séries", { exact: true }).fill("2");
  await dialog.getByRole("button", { name: "Salvar ficha" }).click();
  await expect(dialog).not.toBeVisible();
  const card = page.locator(".plan-card").filter({
    has: page.getByRole("heading", { name: "Teste de treino pessoal" }),
  });
  await card.getByRole("button", { name: "Treinar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Supino reto com halteres" }),
  ).toBeVisible();
  await expect(page.getByLabel("Carga da série 1")).toHaveValue("20");
  await expect(
    page.getByRole("button", { name: "Sincronizar registros" }),
  ).toContainText("Tudo sincronizado");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
    return !!registration.active;
  });
  await context.setOffline(true);
  await page.getByLabel("Repetições da série 1").fill("12");
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Desmarcar série 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).not.toContainText("00:00");
  // Uma recarga offline força o uso do service worker e do IndexedDB criptografado.
  await page.reload();
  await page.getByLabel("Sua senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(page.getByText("Você tem um treino em andamento")).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Desmarcar série 1", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Repetições da série 2").fill("12");
  await page
    .getByRole("button", { name: "Concluir série 2", exact: true })
    .click();
  await expect(
    page.getByText("Próxima sessão: que tal 22,5 kg?"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finalizar treino", exact: true })
    .click();
  await page.getByRole("button", { name: "Concluir e salvar" }).click();
  await expect(
    page.getByRole("heading", { name: "Sua evolução", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: "Sincronizar registros" }),
  ).toContainText("Tudo sincronizado", { timeout: 20000 });
  const snapshot = await page.evaluate(async () => {
    const response = await fetch("/api/state");
    return response.json();
  });
  expect(snapshot.state.sessions).toHaveLength(1);
  expect(
    snapshot.state.sessions[0].exercises[0].sets.every(
      (s: { completedAt: string | null }) => s.completedAt,
    ),
  ).toBe(true);
  expect(snapshot.state.sessions[0].exercises[0].sets[0].load).toBe(20);
  await page.getByRole("button", { name: "Sincronizar registros" }).click();
  await expect(
    page.getByRole("button", { name: "Sincronizar registros" }),
  ).toContainText("Tudo sincronizado");
  await page
    .getByRole("button", { name: "Exportar meus dados", exact: true })
    .click();
  const file = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar JSON", exact: true })
    .click();
  expect((await file).suggestedFilename()).toMatch(/pipsfit-.*\.json$/);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.screenshot({
    path: "test-results/pipsfit-historico.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("celular: 360 px, catálogo, temas e alvos de toque", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByLabel("Sua senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu ritmo. Sua evolução." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/pipsfit-celular.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Navegação no celular" })
    .getByRole("button", { name: "Exercícios", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Buscar nome ou equipamento" })
    .fill("supino");
  expect(await page.locator(".exercise-card").count()).toBeGreaterThanOrEqual(
    8,
  );
  await page
    .getByRole("button", { name: "Criar exercício", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Meu supino");
  await dialog.getByLabel("Equipamento", { exact: true }).fill("Halteres");
  await dialog.getByRole("button", { name: "Cadastrar exercício" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Meu supino", exact: true }),
  ).toBeVisible();
  const tooSmall = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      })
      .map((b) => b.getAttribute("aria-label") ?? b.textContent),
  );
  expect(tooSmall).toEqual([]);
  await page
    .getByRole("button", { name: "Privacidade e instalação", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Usar tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("preserva conflitos entre aparelhos e bloqueia duas abas simultâneas", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByLabel("Sua senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu ritmo. Sua evolução." }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByLabel("Sua senha", { exact: true }).fill(password);
  await second.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(second.getByRole("alert")).toContainText("outra aba");
  await second.close();
  await expect(
    page.getByRole("button", { name: "Sincronizar registros" }),
  ).toContainText("Tudo sincronizado");
  const remoteLogin = await fetch("http://127.0.0.1:4173/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:4173",
    },
    body: JSON.stringify({ password }),
  });
  const remoteCookie = remoteLogin.headers.get("set-cookie")!.split(";")[0];
  const remoteState = await remoteLogin.json();
  const plan = remoteState.state.plans[0];
  await context.setOffline(true);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("button", { name: "Minhas fichas" })
    .click();
  await page
    .getByRole("button", { name: `Editar ${plan.name}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome da ficha")
    .fill("Minha ficha offline");
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click();
  const updated = await fetch("http://127.0.0.1:4173/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:4173",
      Cookie: remoteCookie,
    },
    body: JSON.stringify({
      operations: [
        {
          id: crypto.randomUUID(),
          entity: "plan",
          expectedRevision: plan.revision,
          payload: {
            ...plan,
            revision: plan.revision + 1,
            name: "Minha ficha remota",
          },
        },
      ],
    }),
  });
  expect(updated.status).toBe(200);
  await context.setOffline(false);
  await expect(
    page.getByText("Este registro mudou em outro dispositivo.", {
      exact: false,
    }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Preservar como cópias" }).click();
  await expect(
    page.getByRole("heading", { name: "Minha ficha remota", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Minha ficha offline (cópia recuperada)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sincronizar registros" }),
  ).toContainText("Tudo sincronizado", { timeout: 15000 });
  const after = await page.evaluate(async () => {
    const r = await fetch("/api/state");
    return r.json();
  });
  expect(
    after.state.plans.some(
      (p: { name: string }) => p.name === "Minha ficha remota",
    ),
  ).toBe(true);
  expect(
    after.state.plans.some(
      (p: { name: string }) =>
        p.name === "Minha ficha offline (cópia recuperada)",
    ),
  ).toBe(true);
});
