# Usar o Pipsfit no iPhone sem contratar hospedagem

O Mac continua guardando o banco do Pipsfit. O **Tailscale Personal**, no plano gratuito para uso pessoal, conecta o Mac ao iPhone por uma rede privada. **Tailscale Serve** fornece um endereço HTTPS com certificado válido. É necessário instalar o Tailscale nos dois aparelhos e entrar na mesma conta.

O Mac precisa ficar ligado, conectado à internet e com o servidor aberto. O iPhone consegue acessar também fora do Wi-Fi de casa, enquanto o Tailscale estiver conectado nos dois aparelhos. Sem o Mac disponível, os registros offline já habilitados no iPhone continuam locais e serão sincronizados quando a conexão com o Mac voltar.

## 1. Instalar o Tailscale

- No Mac: baixe o aplicativo em [tailscale.com/download/mac](https://tailscale.com/download/mac), instale, abra e entre na sua conta pessoal. Autorize a conexão de VPN quando o macOS solicitar.
- No iPhone: instale **Tailscale** pela App Store, entre na **mesma conta** e autorize a configuração de VPN. Deixe a conexão ativada.
- Escolha o plano **Personal gratuito**. Não é necessário contratar um servidor ou usar o Render para este acesso.

## 2. Preparar o Mac

Use a pasta do Pipsfit que já funcionou no Mac. Ela deve conservar sua pasta privada `.local`; não substitua ou apague essa pasta.

Se ainda não criou a senha do Pipsfit, abra primeiro `iniciar-mac-linux.command` e configure a senha pela interface local. Antes de encerrar, aguarde **Tudo sincronizado** na interface. Depois, na janela desse servidor, pressione **Ctrl+C**. O acesso para iPhone vai iniciar o servidor com a origem HTTPS correta e usar a mesma senha e o mesmo banco.

No Terminal, dentro da pasta do Pipsfit, execute as duas linhas:

```sh
curl -fL https://raw.githubusercontent.com/guerreirocaio2-cmd/Pipsline/main/scripts/iphone-mac.mjs -o iphone-mac.mjs
node iphone-mac.mjs
```

A primeira linha baixa o inicializador do próprio repositório. A segunda executa esse arquivo. O script pode ser [lido antes de executar](https://github.com/guerreirocaio2-cmd/Pipsline/blob/main/scripts/iphone-mac.mjs).

Quem já baixou uma versão do projeto que contém `iniciar-iphone-mac.command` também pode executar:

```sh
bash iniciar-iphone-mac.command
```

Se o Tailscale pedir que você habilite **HTTPS/Serve**, abra o link que ele apresentar e confirme na sua conta. O endereço do aparelho poderá aparecer no registro público de certificados HTTPS; os registros do Pipsfit continuam privados. Se MagicDNS ainda não estiver ativo, habilite-o na seção DNS do painel do Tailscale.

Ao terminar, o Terminal mostra **Endereço privado do Pipsfit** seguido de um endereço HTTPS terminado em `.ts.net`. No Mac, o navegador também deve abrir esse endereço. Use sempre esse endereço no Mac e no iPhone para a nova cópia offline de cada navegador usar o mesmo servidor.

Mantenha essa janela aberta. O inicializador impede a suspensão por inatividade enquanto o servidor estiver ativo, mas o Mac deve ficar com a tampa aberta e conectado à energia para períodos longos. Para encerrar, pressione **Ctrl+C**. Para iniciar novamente, na mesma pasta, execute `node iphone-mac.mjs`; não é necessário baixar de novo a cada uso.

## 3. Instalar no iPhone

1. Confirme que o Tailscale está conectado no iPhone e no Mac.
2. No **Safari**, abra o endereço HTTPS que apareceu no Terminal.
3. Entre com a senha que já criou no Mac e aguarde **Tudo sincronizado**.
4. Toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**. Se aparecer **Abrir como App**, deixe ativado.
5. Abra pelo ícone do Pipsfit e entre novamente se for solicitado. Faça essa primeira abertura com conexão, para habilitar a cópia offline do aplicativo instalado.

## O que o inicializador faz

- Usa Node.js 24 e as dependências já instaladas no projeto.
- Exige uma senha já configurada antes de ativar o acesso do iPhone.
- Mantém o servidor em `127.0.0.1` no Mac e configura cookies Secure e a origem HTTPS do Tailscale.
- Gera internamente um código de ativação temporário exigido pelas versões recentes do servidor. Nenhum código precisa ser compartilhado ou copiado: a conta já existe, e o acesso continua usando a senha.
- Verifica o endereço HTTPS com a validação normal de certificados. Não usa certificados aceitos por exceção nem desativa TLS.
- Usa **Serve em foreground**, restrito à sua rede Tailscale. Não executa Funnel e não cria um endereço de acesso público.
- Recusa alterar configurações de Serve que já existam. Não executa reset/off, não para servidores anteriores e não altera portas do roteador.
- Ao encerrar, para os processos que ele próprio iniciou. O Tailscale remove a configuração foreground ao terminar sua sessão. O aplicativo Tailscale continua instalado e conectado até você decidir desconectá-lo.

## Se aparecer uma mensagem

- **Porta em uso:** pressione Ctrl+C na janela antiga do Pipsfit e execute novamente. Não é preciso apagar nenhum arquivo.
- **Tailscale não conectado:** abra o Tailscale no Mac e confira se entrou na mesma conta do iPhone.
- **Outro Serve já configurado:** o script preserva esse serviço. Não execute reset; essa configuração precisa ser analisada antes de continuar.
- **HTTPS ainda não respondeu:** confira a autorização de HTTPS/Serve, MagicDNS e a conexão nos aparelhos. Não ignore alertas de certificado do navegador.
- **Crie sua senha primeiro:** use o inicializador local para configurar a conta antes de ativar o acesso remoto.

O código foi validado com testes automatizados de inicialização e encerramento, preservação dos dados, origem HTTPS e proteção de configurações existentes. A conexão real, a autorização de certificados e o Safari dependem da instalação do Tailscale nos seus aparelhos.

Referências: [plano Personal](https://tailscale.com/pricing), [Tailscale Serve](https://tailscale.com/kb/1312/serve), [HTTPS](https://tailscale.com/kb/1153/enabling-https) e [código oficial da CLI](https://github.com/tailscale/tailscale/blob/main/cmd/tailscale/cli/serve_v2.go).
