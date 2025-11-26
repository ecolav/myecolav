#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const RESOURCE_BACKEND_DIR = path.join(ROOT_DIR, 'src-tauri', 'resources', 'backend');

const FILES_TO_COPY = [
  ['scale-server.cjs', 'scale-server.cjs'],
  ['package.json', 'package.json'],
  ['package-lock.json', 'package-lock.json'],
  ['rfid-config.json', 'rfid-config.json'],
  [path.join('scripts', 'start-backend.sh'), 'start-backend.sh'],
  [path.join('scripts', 'start-backend.cmd'), 'start-backend.cmd'],
];

const DIRECTORIES_TO_COPY = [
  ['chainway-rfid', 'chainway-rfid'],
];

function logInfo(message) {
  console.log(`🔧 ${message}`);
}

async function exists(targetPath) {
  try {
    await fs.promises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(source, destination) {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.copyFile(source, destination);
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
      const target = await fs.promises.readlink(srcPath);
      try {
        await fs.promises.symlink(target, destPath);
      } catch {
        await fs.promises.copyFile(srcPath, destPath);
      }
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

function run(command, args, options = {}) {
  const cmd =
    process.platform === 'win32' && !command.endsWith('.cmd') && !command.endsWith('.exe')
      ? `${command}.cmd`
      : command;
  logInfo(`Executando comando: ${cmd} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} saiu com código ${code}`));
      } else {
        resolve();
      }
    });
    child.on('error', reject);
  });
}

async function computeBundleHash(targetDir) {
  const hash = crypto.createHash('sha256');
  async function hashPath(currentPath) {
    const stats = await fs.promises.stat(currentPath);
    if (stats.isDirectory()) {
      if (path.basename(currentPath) === 'node_modules') {
        return;
      }
      const entries = await fs.promises.readdir(currentPath);
      entries.sort();
      for (const entry of entries) {
        await hashPath(path.join(currentPath, entry));
      }
    } else if (stats.isFile()) {
      hash.update(path.relative(targetDir, currentPath));
      const data = await fs.promises.readFile(currentPath);
      hash.update(data);
    }
  }

  const hashTargets = [
    'scale-server.cjs',
    'rfid-config.json',
    'package-lock.json',
    path.join('chainway-rfid'),
  ];

  for (const target of hashTargets) {
    const fullPath = path.join(targetDir, target);
    if (await exists(fullPath)) {
      await hashPath(fullPath);
    }
  }

  return hash.digest('hex');
}

async function main() {
  logInfo('Preparando recursos do backend para o bundle Tauri...');
  await fs.promises.rm(RESOURCE_BACKEND_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(RESOURCE_BACKEND_DIR, { recursive: true });

  for (const [source, target] of FILES_TO_COPY) {
    const sourcePath = path.join(ROOT_DIR, source);
    if (await exists(sourcePath)) {
      logInfo(`Copiando arquivo ${source} -> ${target}`);
      await copyFile(sourcePath, path.join(RESOURCE_BACKEND_DIR, target));
    } else {
      console.warn(`⚠️ Arquivo não encontrado: ${sourcePath}`);
    }
  }

  for (const [sourceDir, targetDir] of DIRECTORIES_TO_COPY) {
    const sourcePath = path.join(ROOT_DIR, sourceDir);
    const targetPath = path.join(RESOURCE_BACKEND_DIR, targetDir);
    logInfo(`Copiando diretório ${sourceDir} -> ${targetDir}`);
    await copyDirectory(sourcePath, targetPath);
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  // No Windows, usar 'npm install --production' que é mais compatível
  // Em outras plataformas, usar 'npm ci --omit=dev' para instalação mais rápida e determinística
  const npmArgs = process.platform === 'win32' 
    ? ['install', '--production']
    : ['ci', '--omit=dev'];
  
  await run(npmCommand, npmArgs, { cwd: RESOURCE_BACKEND_DIR });

  const hash = await computeBundleHash(RESOURCE_BACKEND_DIR);
  const meta = {
    hash,
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
  };
  await fs.promises.writeFile(
    path.join(RESOURCE_BACKEND_DIR, '.bundle-meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  );

  logInfo('Recursos do backend prontos.');
}

main().catch((error) => {
  console.error('❌ Falha ao preparar backend para bundle:', error);
  process.exit(1);
});

