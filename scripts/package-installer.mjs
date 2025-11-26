#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

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
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      ...options,
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on('error', reject);
  });
}

async function main() {
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

  await run('npx', ['bestzip', ARCHIVE_PATH, '.'], { cwd: BUILD_DIR });

  console.log(`✅ Pacote gerado em ${ARCHIVE_PATH}`);
}

main().catch((error) => {
  console.error('❌ Falha ao montar pacote desktop:', error.message);
  process.exit(1);
});

