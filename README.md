# Pipsfit

PWA pessoal de treino em português do Brasil. **Fase 1 implementada**: autenticação de um único usuário, 157 exercícios, fichas, modo treinando, descanso automático, histórico e sugestões de progressão. Não há dados pessoais de demonstração.

## Usar no iPhone gratuitamente pelo Mac

Veja o [passo a passo gratuito com Tailscale Personal](docs/iphone-gratis-pelo-mac.md). O Mac continua como servidor e conserva a senha e os dados; o iPhone conecta por HTTPS privado, inclusive fora da rede de casa. O Mac precisa ficar ligado e o Tailscale deve estar conectado nos dois aparelhos. Não é necessário contratar hospedagem.

Se quiser manter o aplicativo disponível com o Mac desligado, existe também uma [alternativa paga no Render](docs/hospedar-no-render.md), configurada em `render.yaml`. Essa alternativa só deve ser contratada depois de revisar o custo no painel; ela não é necessária para o acesso gratuito pelo Mac.

## Rodar localmente

Requer **Node.js 24** (versão validada: 24.19.0) e npm.

```sh
cd /workspace/Pipsline
npm ci
npm run dev
```

Abra `http://localhost:5173` no seu computador. A interface encaminha `/api` para o servidor na porta 3001. No primeiro acesso, crie uma senha com pelo menos 12 caracteres. Não existe senha padrão nem recuperação de senha nesta fase.

Para testar o PWA offline, use a versão de produção. O service worker não é registrado no servidor de desenvolvimento:

```sh
npm run build
npm start
```

Abra `http://localhost:3001`, entre online uma vez e aguarde a primeira sincronização. O navegador pode então instalar o aplicativo e abri-lo offline. Em celular/rede local, sirva por **HTTPS**; HTTP fora de localhost não oferece o contexto seguro necessário ao PWA e ao Web Crypto. O processo escuta apenas em 127.0.0.1 por padrão; use `HOST=0.0.0.0` somente com a exposição de rede desejada.

## Usar a Fase 1

1. Em **Minhas fichas**, edite os modelos A/B/C ou crie uma ficha. Escolha os dias e adicione exercícios; ajuste séries, faixa de repetições, carga total e descanso. Os modelos são pontos de partida editáveis, sem prescrição individual.
2. Toque em **Treinar**. Cada série já traz carga e repetições da última sessão concluída daquele exercício; na primeira vez, usa a ficha. Corrija se necessário e toque em **✓**: uma série pode ser registrada com um toque. Somente esse toque confirma os valores digitados. O descanso começa automaticamente.
3. Alterne exercícios, pule ou retome depois. Voltar ou bloquear o aplicativo conserva o treino em andamento. **Finalizar treino** pede confirmação e preserva séries não realizadas como incompletas. Uma sessão precisa de ao menos uma série concluída para finalizar.
4. **Evolução** mostra cada atividade, carga máxima e volume por exercício, com os valores que formam os gráficos. Atividades avulsas registram duração, distância e esforço de 1 a 10.
5. **Exportar meus dados** gera JSON e CSV, inclusive com dados pendentes. No celular, essa opção fica em **Privacidade e instalação**. Arquivos exportados são legíveis: armazene-os em local privado. Restauração/importação de backups ainda não foi implementada.

## Offline e sincronização

O snapshot e a fila de operações ficam em uma única gravação no IndexedDB, criptografada com AES-GCM. A chave é derivada da senha usando PBKDF2-SHA-256, 310.000 iterações e salt aleatório por aparelho. O app só confirma o salvamento depois que essa gravação termina. Campos editados de uma série são confirmados ao tocar no ✓, não durante a digitação.

Ao reconectar, o cliente envia a fila automaticamente. Cada operação tem UUID e versão esperada. SQLite aplica o lote em transação; repetir uma operação confirmada é seguro. Um conflito mantém toda a fila local e avisa na interface. **Preservar como cópias** cria registros separados para os dados locais e conserva os remotos; exporte antes se quiser conferir as duas versões. Não há sobrescrita silenciosa. Uma trava do navegador permite somente uma aba desbloqueada por aparelho, evitando que duas abas sobrescrevam o armazenamento local.

O desbloqueio offline vale por 7 dias após a última entrada online. Bloquear remove a chave local da memória. Depois de 15 minutos em segundo plano, o app pede a senha ao voltar. O navegador pode negar armazenamento persistente: limpar dados, usar navegação privada ou perder o aparelho antes da sincronização pode eliminar registros locais. Isso não pode ser impedido por uma aplicação web; sincronização e backups são necessários. O PWA não promete sincronização com o app fechado.

## Dados e segurança

A API usa SQLite nativo do Node 24, com WAL, transações e chaves estrangeiras. Dados pessoais ficam em payloads AES-256-GCM; tabelas relacionais também mantêm projeções criptografadas de itens, dias e séries. IDs, revisões, relações e contagens são metadados visíveis. Veja [modelo de dados](docs/modelo-de-dados.md).

O diretório `.local/` (ignorado pelo Git, permissão 0700) contém `pipsfit.sqlite`, os arquivos WAL/SHM e `master.key` (0600). Faça backups consistentes do banco **junto com a chave**. Pare o servidor antes de copiar a pasta, ou use o mecanismo de backup do SQLite. Não apague a chave: um banco existente sem chave bloqueia a inicialização, evitando gerar uma substituta incompatível. A chave fica separada do banco, mas não protege contra alguém com acesso ao processo ou a toda a máquina. Use disco/volume criptografado e controle de acesso ao hospedar.

Senhas usam scrypt com salt individual; o banco não guarda a senha. Sessões de 8 horas usam tokens aleatórios, guardados apenas como hash no servidor e cookie HttpOnly/SameSite=Strict no navegador. Mutações verificam Origin, o login limita tentativas e a API usa no-store. Não há chamadas a serviços externos, analytics ou notificações de saúde.

Para hospedar, termine TLS em um proxy e execute, por exemplo:

```sh
# Defina PIPSFIT_SETUP_TOKEN de forma privada no ambiente da hospedagem.
NODE_ENV=production APP_ORIGIN=https://seu-dominio.example npm start
```

Em produção, defina também `PIPSFIT_SETUP_TOKEN` com um código privado aleatório de 32 a 256 caracteres. Ele protege a criação da primeira conta. No Render, o YAML gera o código e o servidor usa `RENDER_EXTERNAL_URL` automaticamente quando `APP_ORIGIN` não foi definida. Cookies recebem `Secure` e HSTS é habilitado. `APP_ORIGIN` deve corresponder exatamente à origem pública (sem barra final). Não use a mesma instância pública para pessoas diferentes: o aplicativo é de usuário único. A configuração inicial deve ser feita em acesso privado antes de expor o servidor. O servidor web do PWA e a API devem compartilhar a mesma origem.

Na hospedagem pública, `NODE_ENV=production`, uma origem HTTPS e `PIPSFIT_SETUP_TOKEN` são obrigatórios. Variáveis adicionais: `APP_DATA_DIR` (pasta privada de dados, padrão `.local`), `PORT` (3001), `HOST` (127.0.0.1) e `APP_ORIGIN`. Nenhuma credencial de terceiros é necessária para esta fase. Não coloque `.local`, senhas ou chaves no Git.

## Verificações

```sh
npm test             # cálculos, catálogo, validações, segurança e transações da API
npm run build        # TypeScript e bundle PWA
npm run test:e2e     # navegador real; exige build atual e Chromium
```

Os testes de navegador usam `/usr/bin/chromium`; defina `CHROMIUM_PATH` para outro executável, ou instale com `npx playwright install chromium` e informe seu caminho. Os testes criam um banco temporário e **não alteram seus dados**. Usam a porta 4173, que deve estar livre. Os testes validam a versão de produção, inclusive service worker, recarga offline, fila criptografada, sincronização, exportação e largura de 360 px.

A descrição OpenAPI fica em [server/openapi.json](server/openapi.json) e é servida em `/api/openapi.json`. Rotas de dados exigem sessão; chamadas POST exigem Origin da aplicação e Content-Type application/json.

## Decisões adotadas nesta fase

- React + TypeScript + Vite: interface móvel, validação tipada compartilhada e shell offline pequeno. Express + SQLite nativo: um processo, um banco local e sem serviço externo obrigatório.
- Catálogo de 157 exercícios com grupo e equipamento, mais cadastro livre. Fichas A/B/C são modelos editáveis; nenhuma carga pessoal é presumida.
- A carga é **total**, somando os dois halteres. Peso corporal é 0 kg, sem estimativa de massa corporal no volume. Séries usam repetições nesta fase; exercícios por tempo precisam de ajuste futuro.
- Progressão: todas as séries concluídas e no topo da faixa → sugerir maior carga + 2,5 kg. Nunca aplicar automaticamente. Platô: mesma carga máxima em 3 sessões concluídas, sem inferir falta de evolução clínica.
- Semana de segunda a domingo; datas da interface usam o fuso do aparelho. Volume móvel inclui hoje e os seis dias anteriores. Consistência conta dias com ao menos uma atividade concluída nos últimos 30 dias.
- Criptografia também na fila offline; conflitos exigem decisão explícita de preservar cópias. Sem provedor externo de identidade ou envio de dados a terceiros.
- Exportação antecipada para permitir cópias dos dados já na Fase 1. Não há restauração automática, recuperação de senha ou migração entre contas.

## Próximas fases e regras a decidir

2. Diário alimentar com fonte TACO versionada, alimentos e receitas, metas explicáveis e testes de Mifflin-St Jeor.
3. Medidas, fotos privadas, tendências e metas com prazo.
4. Bioimpedância manual/CSV, depois Excel/PDF/OCR e revisão humana. A imagem de referência ainda precisa ser fornecida nessa fase; o texto enviado contém os valores, mas não o print. Validar todos os campos, consistência, classificações configuráveis, duplicidade e arquivo original privado. Nenhum parser ou OCR é anunciado como pronto.
5. Dashboard integrado, notificações opt-in, exportação ampliada e refinamentos.

Dúvidas para revisão antes das próximas fases:

- A progressão deve usar quais incrementos por exercício/equipamento? Carga de halteres será total ou por lado? Precisamos de séries medidas em segundos e exercícios unilaterais?
- Qual fluxo de recuperação de senha/backups você prefere? Um código de recuperação muda o modelo de proteção offline.
- Quais metas pessoais, faixa etária, referência de classificação da bioimpedância e origem/licença da TACO devem orientar as próximas fases?
