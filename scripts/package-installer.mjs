#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT_DIR, '.installer', 'payload');
const DIST_DIR = path.join(ROOT_DIR, 'dist', 'installers');
const BUNDLE_DIR = path.join(ROOT_DIR, 'src-tauri', 'target', 'release', 'bundle');
const PLATFORM_ID = (process.env.INSTALLER_PLATFORM || process.platform)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-');
const ARCH_ID = (process.env.INSTALLER_ARCH || process.arch).toLowerCase();
const ARCHIVE_NAME =
  process.env.INSTALLER_ARCHIVE_NAME || `ecolav-desktop-${PLATFORM_ID}-${ARCH_ID}.zip`;
const ARCHIVE_PATH = path.join(DIST_DIR, ARCHIVE_NAME);
const START_SCRIPTS = [
  ['start-backend.sh', 'start-backend.sh'],
  ['start-backend.cmd', 'start-backend.cmd'],
];

async function exists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyDirectory(source, destination) {
  if (!(await exists(source))) {
    return;
  }
  await fs.promises.mkdir(destination, { recursive: true });
  const entries = await fs.promises.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.promises.readlink(srcPath);
      try {
        await fs.promises.symlink(link, destPath);
      } catch {
        // Ignore if filesystem does not support symlinks (e.g., Windows without privileges)
      }
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

function run(command, args, options = {}) {
  const cmd =
    process.platform === 'win32' && !command.endsWith('.cmd') && !command.endsWith('.exe')
      ? `${command}.cmd`
      : command;
  
  // Log para debug
  console.log(`🔧 Executando: ${cmd}`, args);
  console.log(`📁 CWD: ${options.cwd || process.cwd()}`);
  
  // Validação de argumentos
  if (!cmd || cmd.trim() === '') {
    throw new Error(`Comando inválido: "${cmd}"`);
  }
  
  const validArgs = args.filter(arg => arg != null && arg !== '');
  if (validArgs.length !== args.length) {
    console.warn('⚠️ Argumentos inválidos filtrados:', args);
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, validArgs, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on('error', (err) => {
      console.error(`❌ Erro ao executar ${cmd}:`, err);
      reject(err);
    });
  });
}

async function main() {
  // Log de debug para variáveis de ambiente
  console.log('🔍 Variáveis de ambiente:');
  console.log('  INSTALLER_PLATFORM:', process.env.INSTALLER_PLATFORM || '(não definido)');
  console.log('  INSTALLER_ARCH:', process.env.INSTALLER_ARCH || '(não definido)');
  console.log('  INSTALLER_ARCHIVE_NAME:', process.env.INSTALLER_ARCHIVE_NAME || '(não definido)');
  console.log('  Platform:', process.platform);
  console.log('  Arch:', process.arch);
  console.log('  PLATFORM_ID:', PLATFORM_ID);
  console.log('  ARCH_ID:', ARCH_ID);
  console.log('  ARCHIVE_NAME:', ARCHIVE_NAME);
  console.log('  ARCHIVE_PATH:', ARCHIVE_PATH);
  
  if (!(await exists(BUNDLE_DIR))) {
    throw new Error(
      `Diretório de bundle não encontrado em ${BUNDLE_DIR}. Execute "npm run tauri:build" antes.`
    );
  }

  await fs.promises.rm(BUILD_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(BUILD_DIR, { recursive: true });
  await fs.promises.mkdir(DIST_DIR, { recursive: true });

  const backendDir = path.join(BUILD_DIR, 'backend');
  await fs.promises.mkdir(backendDir, { recursive: true });

  const filesToCopy = [
    'scale-server.cjs',
    'package.json',
    'package-lock.json',
    'rfid-config.json',
  ];

  for (const fileName of filesToCopy) {
    const source = path.join(ROOT_DIR, fileName);
    if (await exists(source)) {
      await fs.promises.copyFile(source, path.join(backendDir, fileName));
    }
  }

  await copyDirectory(path.join(ROOT_DIR, 'chainway-rfid'), path.join(backendDir, 'chainway-rfid'));

  for (const [sourceName, targetName] of START_SCRIPTS) {
    const sourcePath = path.join(ROOT_DIR, 'scripts', sourceName);
    if (await exists(sourcePath)) {
      await fs.promises.copyFile(sourcePath, path.join(BUILD_DIR, targetName));
    }
  }

  const instructions = `
MyEcolav Desktop - Pacote ${PLATFORM_ID.toUpperCase()} (${ARCH_ID})
===========================================================

Conteúdo:
- bundle/ : artefatos Tauri gerados (instaladores/execução nativa)
- backend/: servidor Node.js (scale-server) com biblioteca chainway-rfid
- start-backend.* : scripts auxiliares para iniciar o backend manualmente

Passos recomendados:
1. Instale Node.js 20 LTS na máquina alvo.
2. Dentro da pasta backend/, execute "npm install --production".
3. Inicie o servidor executando start-backend.sh (Linux/macOS) ou start-backend.cmd (Windows).
4. Instale/execute o binário Tauri correspondente localizado em bundle/.
5. Use npm run desktop no repositório para desenvolvimento local, se necessário.
`;

  await fs.promises.writeFile(path.join(BUILD_DIR, 'README-INSTALL.txt'), instructions.trim() + '\n', {
    encoding: 'utf-8',
  });

  await copyDirectory(BUNDLE_DIR, path.join(BUILD_DIR, 'bundle'));

  await fs.promises.rm(ARCHIVE_PATH, { force: true });

  // Validação do caminho do arquivo antes de criar
  const archiveDir = path.dirname(ARCHIVE_PATH);
  if (!(await exists(archiveDir))) {
    await fs.promises.mkdir(archiveDir, { recursive: true });
  }
  
  // Normalizar caminho para evitar problemas com espaços/caracteres especiais
  const normalizedArchivePath = path.resolve(ARCHIVE_PATH);
  console.log(`📦 Criando arquivo ZIP: ${normalizedArchivePath}`);
  console.log(`📂 Diretório de trabalho: ${BUILD_DIR}`);
  
  // Verificar se BUILD_DIR existe e tem conteúdo
  const buildDirContents = await fs.promises.readdir(BUILD_DIR);
  console.log(`📋 Conteúdo do diretório de build (${buildDirContents.length} itens):`, buildDirContents.slice(0, 10));

  // Tentar criar ZIP com bestzip via npx
  try {
    await run('npx', ['bestzip', normalizedArchivePath, '.'], { cwd: BUILD_DIR });
  } catch (error) {
    console.warn('⚠️ Falha ao usar npx bestzip, tentando alternativa...');
    // Fallback: usar zip nativo do sistema ou exec com shell
    if (process.platform === 'win32') {
      // Windows: usar PowerShell Compress-Archive
      const psCommand = `Compress-Archive -Path "${BUILD_DIR}\\*" -DestinationPath "${normalizedArchivePath}" -Force`;
      await execAsync(`powershell -Command "${psCommand}"`);
    } else {
      // Linux/macOS: usar zip nativo
      const zipCommand = `cd "${BUILD_DIR}" && zip -r "${normalizedArchivePath}" .`;
      await execAsync(zipCommand, { shell: '/bin/bash' });
    }
  }

  console.log(`✅ Pacote gerado em ${normalizedArchivePath}`);
}

main().catch((error) => {
  console.error('❌ Falha ao montar pacote desktop:', error.message);
  process.exit(1);
});

