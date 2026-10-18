import { describe, expect, it } from "vitest";
import { runtimeConfig } from "../server/runtime";
const activation = "codigo-de-ativacao-exclusivo-de-teste-123";
describe("configuração da hospedagem", () => {
  it("usa a origem HTTPS fornecida pelo Render e o volume persistente", () => {
    const config = runtimeConfig({
      NODE_ENV: "production",
      RENDER_EXTERNAL_URL: "https://meu-pipsfit.onrender.com/",
      PIPSFIT_SETUP_TOKEN: activation,
      APP_DATA_DIR: "/var/data/pipsfit",
      HOST: "0.0.0.0",
      PORT: "10000",
    });
    expect(config.origin).toBe("https://meu-pipsfit.onrender.com");
    expect(config.directory).toBe("/var/data/pipsfit");
    expect(config.port).toBe(10000);
    expect(config.host).toBe("0.0.0.0");
    expect(config.production).toBe(true);
  });
  it("recusa produção sem origem HTTPS ou sem proteção de ativação", () => {
    expect(() =>
      runtimeConfig({
        NODE_ENV: "production",
        PIPSFIT_SETUP_TOKEN: activation,
      }),
    ).toThrow("APP_ORIGIN");
    expect(() =>
      runtimeConfig({
        NODE_ENV: "production",
        APP_ORIGIN: "http://pipsfit.example",
        PIPSFIT_SETUP_TOKEN: activation,
      }),
    ).toThrow("HTTPS");
    expect(() =>
      runtimeConfig({
        NODE_ENV: "production",
        APP_ORIGIN: "https://pipsfit.example",
      }),
    ).toThrow("PIPSFIT_SETUP_TOKEN");
  });
  it("prefere domínio próprio explícito e rejeita URL com caminho ou credenciais", () => {
    expect(
      runtimeConfig({
        NODE_ENV: "production",
        APP_ORIGIN: "https://treino.example",
        RENDER_EXTERNAL_URL: "https://outro.onrender.com",
        PIPSFIT_SETUP_TOKEN: activation,
      }).origin,
    ).toBe("https://treino.example");
    expect(() =>
      runtimeConfig({ APP_ORIGIN: "https://site.example/pipsfit" }),
    ).toThrow("origem pública");
    expect(() =>
      runtimeConfig({ APP_ORIGIN: "https://nome:senha@site.example" }),
    ).toThrow("credenciais");
  });
  it("recusa portas inválidas antes de criar o banco", () => {
    for (const port of ["abc", "0", "65536", "1.5"])
      expect(() => runtimeConfig({ PORT: port })).toThrow("PORT");
  });
  it("preserva inicialização local sem código de ativação", () => {
    const config = runtimeConfig({});
    expect(config.port).toBe(3001);
    expect(config.host).toBe("127.0.0.1");
    expect(config.production).toBe(false);
    expect(config.setupToken).toBeUndefined();
  });
});
