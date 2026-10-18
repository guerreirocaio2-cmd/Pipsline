# Hospedar o Pipsfit e instalar no iPhone

O repositório contém `render.yaml`, que prepara um servidor Node.js com HTTPS, uma única instância e **disco persistente de 1 GB**. O banco e sua chave ficam juntos no disco privado, em `/var/data/pipsfit`.

**Há custo:** a configuração usa o plano web Starter e um disco persistente. O valor e as condições atuais são apresentados pelo Render antes da confirmação; revise-os no painel. Esta preparação não cria uma conta, não cadastra cartão e não contrata o serviço por você. Não troque por um serviço gratuito sem disco: os dados poderiam se perder ao reiniciar ou atualizar.

## 1. Criar a hospedagem

No Mac, abra:

[Configurar o Pipsfit no Render](https://render.com/deploy?repo=https://github.com/guerreirocaio2-cmd/Pipsline)

1. Crie uma conta ou entre no Render. Conecte o GitHub e autorize o repositório `guerreirocaio2-cmd/Pipsline` se for solicitado.
2. O Render deve ler o arquivo `render.yaml`. Confira o serviço `pipsfit`, plano **Starter**, uma instância e disco **pipsfit-data**, 1 GB, montado em `/var/data`.
3. Confira o custo e confirme a criação. Aguarde o build e o deploy terminarem; o serviço deve ficar **Live**.
4. Abra o endereço **HTTPS** que o painel do Render apresentar. O endereço exato depende da criação do serviço; nenhum endereço público do aplicativo foi gerado apenas por salvar este arquivo.

Se o botão não iniciar a configuração, no painel do Render use **New → Blueprint**, selecione esse repositório e a branch `main`. O arquivo fica na raiz e se chama `render.yaml`.

## 2. Criar sua conta pessoal com segurança

O serviço público não aceita que qualquer visitante crie a primeira senha. O Render gera uma variável privada chamada **PIPSFIT_SETUP_TOKEN**.

1. No painel do serviço `pipsfit`, abra **Environment** e revele/copie o valor de `PIPSFIT_SETUP_TOKEN`.
2. Abra o endereço HTTPS do aplicativo no Mac.
3. Preencha **Código de ativação** com esse valor e crie sua senha de pelo menos 12 caracteres.
4. Depois da criação, você usa apenas a senha. O código não aparece na API, não é incluído em exportações e não deve ser enviado em chat ou colocado em URLs.

Os dados locais do Mac e a nova hospedagem são bancos separados. Nesta instalação o usuário informou que ainda não havia registros a migrar. Passe a usar **o mesmo endereço HTTPS** no Mac e no iPhone para compartilhar os próximos registros. O app antigo em localhost continua independente e não envia automaticamente registros já confirmados ao seu próprio servidor local.

## 3. Adicionar no iPhone

1. No **Safari**, abra o endereço HTTPS do serviço.
2. Entre com a senha criada e aguarde o indicador **Tudo sincronizado**.
3. Toque em **Compartilhar** e escolha **Adicionar à Tela de Início**. Se aparecer a opção **Abrir como App**, deixe-a ativada.
4. Toque em **Adicionar**. Abra pelo ícone **Pipsfit** e entre novamente, se solicitado.

Abra o aplicativo instalado online uma vez antes de usar offline. A instalação pode ter armazenamento separado do Safari; por isso, a primeira entrada pelo ícone pode pedir senha e conexão. Depois, os treinos podem ser registrados offline e sincronizados ao reabrir com conexão. O Mac não precisa ficar ligado. O iPhone deve ter uma versão atual do iOS/Safari com Web Crypto, IndexedDB, Web Locks e service workers.

## Verificar que funcionou

- O endereço abre com HTTPS, e a primeira conta só é criada com o código privado.
- O mesmo login funciona no Mac e no iPhone pelo endereço online.
- Uma série salva no iPhone aparece no histórico do Mac após sincronizar.
- Uma reinicialização do serviço pelo painel conserva a senha e os registros. O arquivo `master.key` nunca deve ser substituído ou removido.

## Manutenção

O YAML desativa deploy automático: uma mudança no GitHub não altera imediatamente seu aplicativo pessoal. Quando quiser atualizar, use **Manual Deploy → Deploy latest commit** no serviço. Não crie outro serviço para atualizar. O disco existente deve ser conservado.

Faça exportações regulares pelo aplicativo. Exportações JSON/CSV não são criptografadas, então armazene-as em local privado. Para um backup restaurável do servidor, preserve banco e `master.key` juntos de forma consistente, com o servidor parado ou pelo backup do SQLite. As exportações ainda não têm restauração na interface.

## Configuração técnica

- Node.js 24.19.0; build: `npm ci --include=dev --no-audit --no-fund && npm run build`; start: `npm start`.
- `NODE_ENV=production`, `HOST=0.0.0.0`, `APP_DATA_DIR=/var/data/pipsfit` e `PIPSFIT_SETUP_TOKEN` gerado pelo Render.
- O Render fornece `PORT` e `RENDER_EXTERNAL_URL`. O servidor usa `RENDER_EXTERNAL_URL` como origem HTTPS de autenticação. Se configurar domínio próprio, defina `APP_ORIGIN` com a origem HTTPS exata do domínio e use essa origem em todos os dispositivos.
- Cookies são Secure/HttpOnly/SameSite=Strict. A API mantém a verificação de Origin; o HTTPS termina no proxy do Render.
- A produção recusa iniciar sem origem HTTPS e sem código de ativação válido. O uso local pelo inicializador permanece inalterado.
- O código de ativação tem de 32 a 256 caracteres. Mantenha a variável configurada em reinicializações; ela só é exigida para a criação da primeira conta.
- `tsx` é uma dependência de produção, porque executa o servidor TypeScript.

Referências: [Blueprints](https://render.com/docs/blueprint-spec), [discos persistentes](https://render.com/docs/disks), [variáveis](https://render.com/docs/environment-variables) e [versão do Node](https://render.com/docs/node-version). A validação local verifica código, build e persistência, mas a criação do serviço e o teste no iPhone precisam ocorrer na conta do usuário.
