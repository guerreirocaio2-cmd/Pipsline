# Pipsfit online gratuitamente: Render Free + Neon Free

O aplicativo ficará disponível no mesmo endereço HTTPS para Mac e iPhone, com o Mac desligado. A configuração usa **Render Free** para executar o aplicativo e **Neon Free** para conservar os dados em PostgreSQL. Não utiliza disco pago do Render, Tailscale nem porta aberta no roteador.

Os planos gratuitos têm limites e podem colocar o serviço em repouso. O primeiro acesso depois de um período parado pode levar cerca de um minuto enquanto o servidor desperta. O banco permanece separado do processo do aplicativo; reiniciar o serviço não apaga a conta ou os registros. Confira os limites atuais nos painéis dos provedores e mantenha os planos **Free**, sem ativar upgrades pagos. Não há promessa de disponibilidade contínua ou de gratuidade sem limites de uso.

## 1. Criar o banco gratuito no Neon

1. No Mac, abra [Neon](https://neon.com/signup) e crie sua conta.
2. Escolha o plano **Free** e crie um projeto separado chamado `pipsfit`.
3. Se houver escolha de região, prefira **AWS US West 2 / Oregon**, a mesma região configurada para o aplicativo no Render.
4. No projeto, clique em **Connect** e copie a **Connection string**, normalmente começando com `postgresql://`. Use a conexão **pooled** se o painel oferecer essa opção.

Essa conexão contém uma senha de banco. Ela será colada somente no campo privado do Render na próxima etapa. Não envie essa conexão pelo chat nem coloque-a no GitHub. Não é necessário criar tabelas ou executar SQL manualmente: o aplicativo prepara o esquema no primeiro início.

## 2. Criar o aplicativo gratuito no Render

Feche qualquer página antiga que ainda mostre Starter ou disco pago. Abra o link atualizado:

[Configurar o Pipsfit gratuito no Render](https://render.com/deploy?repo=https://github.com/guerreirocaio2-cmd/Pipsline)

1. Entre no Render usando o GitHub e autorize o repositório `guerreirocaio2-cmd/Pipsline`.
2. O Render lê o `render.yaml` da branch `main`. Confira que o serviço está no plano **Free**, sem disco persistente pago. Se aparecer **Starter**, não confirme: reabra o link para carregar o arquivo atualizado.
3. Quando pedir **DATABASE_URL**, cole a conexão que copiou do Neon.
4. Confirme a criação gratuita e aguarde o serviço ficar **Live**.
5. Abra o endereço **HTTPS** que o Render gerar. Esse será o endereço usado nos dois aparelhos.

Se a criação não abrir pelo botão, use **New → Blueprint**, selecione o repositório e a branch `main`; o arquivo de configuração é `render.yaml`, na raiz.

## 3. Ativar sua conta do Pipsfit

O Render gera automaticamente dois valores privados:

- **PIPSFIT_SETUP_TOKEN:** código para criar a primeira conta com segurança.
- **PIPSFIT_ENCRYPTION_KEY:** chave que protege os dados de saúde no banco.

No painel do serviço, abra **Environment**, revele e copie somente o valor de **PIPSFIT_SETUP_TOKEN**. Abra o endereço do aplicativo, preencha **Código de ativação** com esse valor e crie sua senha. Depois disso, você entra apenas com a senha.

**Mantenha PIPSFIT_ENCRYPTION_KEY inalterada.** Ela não precisa ser digitada no aplicativo nem enviada a ninguém. Apagar ou trocar essa chave impede a leitura do banco existente. O servidor detecta uma chave diferente e recusa iniciar, preservando os registros. A chave deve acompanhar qualquer backup restaurável do banco, guardada de forma privada e separada do GitHub.

O banco novo começa vazio de registros pessoais. Os dados de uma instalação antiga no Mac não são enviados automaticamente. O usuário informou que ainda não havia treinos a migrar; se isso mudou, exporte uma cópia no Mac e preserve a pasta `.local` antes de fazer qualquer migração. Não apague os arquivos locais.

## 4. Abrir no Mac e instalar no iPhone

Use sempre **o endereço HTTPS do Render**, no Mac e no iPhone. A antiga instalação em localhost é independente.

No iPhone:

1. Abra esse endereço no **Safari** e entre com sua senha.
2. Aguarde **Tudo sincronizado**.
3. Toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**.
4. Abra o ícone do Pipsfit e faça a primeira entrada online. O aplicativo instalado pode pedir a senha novamente porque seu armazenamento pode ser separado do Safari.

Depois da primeira entrada online, você poderá registrar treinos offline. Eles serão enviados quando o aplicativo voltar a ter conexão e o servidor estiver disponível. Não depende de manter o Mac ligado.

## Verificar e manter

- Faça um registro no iPhone e confirme que aparece no Mac após sincronizar.
- Reinicie o serviço no Render: a conta e os dados devem continuar disponíveis.
- Para atualizar, use **Manual Deploy → Deploy latest commit** no mesmo serviço. O deploy automático está desativado para evitar alterações inesperadas. Não recrie as variáveis privadas nem o projeto do Neon a cada atualização.
- Mantenha exportações JSON/CSV pelo aplicativo. São arquivos sem criptografia; guarde-os em local privado. A interface ainda não restaura essas exportações automaticamente.
- Se atingir limites gratuitos ou houver indisponibilidade, o aplicativo pode ficar temporariamente inacessível. Não faça upgrade pago sem revisar o plano. Confirme a sincronização e preserve backups.

## Configuração técnica

`render.yaml` define um serviço Node 24.19.0 no plano Free, sem disco, na região Oregon. O YAML define `PIPSFIT_STORAGE=postgres`; no Render esse também é o padrão de segurança. A aplicação recusa SQLite no Render e, sem conexão e chave privadas do PostgreSQL, a inicialização falha em vez de criar um banco temporário no disco do serviço.

A chave AES-256-GCM é derivada do segredo aleatório `PIPSFIT_ENCRYPTION_KEY`. O banco conserva um verificador autenticado dessa chave. A conexão PostgreSQL usa TLS com verificação de certificado e channel binding habilitado; parâmetros da URL não podem desativar a verificação.

As operações são protegidas por transações e advisory lock no PostgreSQL. O servidor valida cada revisão da fila e grava apenas a versão final de cada registro junto com todos os recibos de idempotência. Assim, filas offline longas não precisam de uma consulta remota por série. Conflitos fazem rollback do lote e mantêm a cópia local do navegador.

O uso local por `npm start` ou pelo inicializador do Mac mantém SQLite e a chave da pasta `.local`. Nenhum banco local é migrado ou substituído automaticamente.

Testes: `npm test` cobre os dois bancos, autenticação, idempotência, conflitos, dados após reabrir o banco e TLS. `npm run test:e2e:postgres` valida o fluxo real do navegador contra o motor PostgreSQL em WASM (PGlite); não cria um projeto Neon nem substitui o teste final no serviço hospedado. A conexão remota real depende de criar as contas e fornecer DATABASE_URL no painel privado do Render.

Referências: [Neon Free Tier](https://github.com/neondatabase/neon#readme), [Render Free](https://render.com/docs/free), [TLS do driver PostgreSQL](https://node-postgres.com/features/ssl).
