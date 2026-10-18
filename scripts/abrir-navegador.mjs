// Abre somente o servidor local, depois de confirmar que o Pipsfit iniciou.
import { spawn } from 'node:child_process';
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(1);
const address = `http://localhost:${port}`;
for (let attempt = 0; attempt < 120; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const health = await response.json();
    if (response.ok && health.status === 'ok' && health.phase === 1) {
      if (process.env.PIPSFIT_NO_OPEN === '1') process.exit(0);
      const [command, args] = process.platform === 'win32'
        ? ['cmd.exe', ['/d', '/c', 'start', '', address]]
        : process.platform === 'darwin'
          ? ['open', [address]]
          : ['xdg-open', [address]];
      const browser = spawn(command, args, { stdio: 'ignore' });
      browser.on('error', () => console.log(`Abra ${address} no navegador deste computador.`));
      browser.unref();
      process.exitCode = 0;
      break;
    }
  } catch {
    // O servidor pode levar alguns instantes para abrir o banco.
  }
  if (attempt === 119) {
    console.log('O servidor ainda não respondeu. Confira a mensagem nesta janela.');
    process.exitCode = 1;
  } else {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}
