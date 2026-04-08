#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

// ─── Stable install location ───
const INSTALL_DIR = path.join(os.homedir(), '.cc-plan-viewer');
const INSTALLED_HOOK = path.join(INSTALL_DIR, 'plan-viewer-hook.cjs');
const INSTALLED_SERVER = path.join(INSTALL_DIR, 'server-bundle.mjs');
const INSTALLED_CLIENT = path.join(INSTALL_DIR, 'client');

// ─── Source paths (inside the npm package) ───
// When compiled: dist/server/bin/cc-plan-viewer.js
// Package root is 3 levels up: dist/server/bin → dist/server → dist → root
const PKG_ROOT_COMPILED = path.resolve(import.meta.dirname, '..', '..', '..');
// When running via tsx in dev: bin/ → root
const PKG_ROOT_DEV = path.resolve(import.meta.dirname, '..');

function getPkgRoot(): string {
  // Check compiled path first (has dist/ dir)
  if (fs.existsSync(path.join(PKG_ROOT_COMPILED, 'hooks', 'plan-viewer-hook.cjs'))) {
    return PKG_ROOT_COMPILED;
  }
  return PKG_ROOT_DEV;
}

// ─── Settings file resolution ───
const DEFAULT_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

function resolveSettingsPath(): string {
  // Check --config flag
  const configIdx = process.argv.indexOf('--config');
  if (configIdx !== -1 && process.argv[configIdx + 1]) {
    const custom = path.resolve(process.argv[configIdx + 1]);
    if (!fs.existsSync(path.dirname(custom))) {
      console.error(`[cc-plan-viewer] Directory does not exist: ${path.dirname(custom)}`);
      process.exit(1);
    }
    return custom;
  }
  return DEFAULT_SETTINGS;
}

function readSettings(settingsPath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settingsPath: string, settings: Record<string, unknown>): void {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

// ─── Copy files to stable location ───
function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function installFiles(): void {
  const pkgRoot = getPkgRoot();

  // Create install dir
  if (!fs.existsSync(INSTALL_DIR)) {
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
  }

  // Copy hook
  const hookSrc = path.join(pkgRoot, 'hooks', 'plan-viewer-hook.cjs');
  if (fs.existsSync(hookSrc)) {
    fs.copyFileSync(hookSrc, INSTALLED_HOOK);
  }

  // Copy bundled server (single file, all deps included)
  const serverSrc = path.join(pkgRoot, 'dist', 'server-bundle.mjs');
  if (fs.existsSync(serverSrc)) {
    fs.copyFileSync(serverSrc, INSTALLED_SERVER);
  }

  // Copy client SPA
  const clientSrc = path.join(pkgRoot, 'dist', 'client');
  if (fs.existsSync(clientSrc)) {
    copyDir(clientSrc, INSTALLED_CLIENT);
  }

  // Write version file
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
    fs.writeFileSync(
      path.join(INSTALL_DIR, 'version.json'),
      JSON.stringify({ version: pkg.version, installedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch {}
}

// ─── Hook management ───
function getHookCommand(): string {
  return `node "${INSTALLED_HOOK}"`;
}

function install(): void {
  const settingsPath = resolveSettingsPath();
  console.log('[cc-plan-viewer] Installing...');
  console.log(`[cc-plan-viewer] Install dir: ${INSTALL_DIR}`);
  console.log(`[cc-plan-viewer] Settings: ${settingsPath}`);

  // Copy files to stable location
  installFiles();
  console.log('[cc-plan-viewer] Files copied to ~/.cc-plan-viewer/');

  // Patch the installed hook to know where the server is
  // The hook uses __dirname to find the server — now it's in ~/.cc-plan-viewer/
  // and the server is at ~/.cc-plan-viewer/server/server/index.js
  // Hook already resolves path.join(__dirname, '..', 'dist', 'server', 'server', 'index.js')
  // but now it should look at path.join(__dirname, '..', 'server', 'server', 'index.js')
  // Let's patch the hook to check both locations
  patchHookPaths();

  // Add hook to settings
  const settings = readSettings(settingsPath);
  if (!settings.hooks || typeof settings.hooks !== 'object') {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;
  if (!Array.isArray(hooks.PostToolUse)) {
    hooks.PostToolUse = [];
  }

  const hookCommand = getHookCommand();

  // Remove any existing cc-plan-viewer hooks first (handles upgrades)
  hooks.PostToolUse = hooks.PostToolUse.filter((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return true;
    const e = entry as Record<string, unknown>;
    if (!Array.isArray(e.hooks)) return true;
    return !e.hooks.some((h: unknown) => {
      if (typeof h !== 'object' || h === null) return false;
      const cmd = (h as Record<string, unknown>).command;
      return typeof cmd === 'string' && cmd.includes('plan-viewer-hook');
    });
  });

  // Add fresh hook entry
  hooks.PostToolUse.push({
    matcher: 'Write|Edit',
    hooks: [{ type: 'command', command: hookCommand }],
  });

  writeSettings(settingsPath, settings);

  console.log('[cc-plan-viewer] Hook installed successfully.');
  console.log('');
  console.log('  Next time Claude Code writes a plan, the viewer will open in your browser.');
  console.log('');
  console.log('  Update anytime:   npx cc-plan-viewer@latest update');
  console.log('  Uninstall:        npx cc-plan-viewer uninstall');
  if (settingsPath !== DEFAULT_SETTINGS) {
    console.log(`  Custom config:    ${settingsPath}`);
  }
}

function patchHookPaths(): void {
  // The installed hook is at ~/.cc-plan-viewer/plan-viewer-hook.cjs
  // The server bundle is at ~/.cc-plan-viewer/server-bundle.mjs
  // We patch the hook to point to the bundled server
  if (!fs.existsSync(INSTALLED_HOOK)) return;

  let hookContent = fs.readFileSync(INSTALLED_HOOK, 'utf8');

  // Replace server path to point to the bundled server in the same dir
  hookContent = hookContent.replace(
    /const serverPath = path\.join\(__dirname, [^;]+;/,
    `const serverPath = path.join(__dirname, 'server-bundle.mjs');`
  );

  fs.writeFileSync(INSTALLED_HOOK, hookContent, 'utf8');
}

function update(): void {
  console.log('[cc-plan-viewer] Updating...');

  if (!fs.existsSync(INSTALL_DIR)) {
    console.log('[cc-plan-viewer] Not installed. Run: npx cc-plan-viewer install');
    return;
  }

  // Read old version
  let oldVersion = 'unknown';
  try {
    const v = JSON.parse(fs.readFileSync(path.join(INSTALL_DIR, 'version.json'), 'utf8'));
    oldVersion = v.version;
  } catch {}

  // Copy new files
  installFiles();
  patchHookPaths();

  // Read new version
  let newVersion = 'unknown';
  try {
    const v = JSON.parse(fs.readFileSync(path.join(INSTALL_DIR, 'version.json'), 'utf8'));
    newVersion = v.version;
  } catch {}

  if (oldVersion === newVersion) {
    console.log(`[cc-plan-viewer] Already on latest version (${newVersion}).`);
  } else {
    console.log(`[cc-plan-viewer] Updated: ${oldVersion} → ${newVersion}`);
  }

  console.log('[cc-plan-viewer] Files updated in ~/.cc-plan-viewer/');
}

function uninstall(): void {
  const settingsPath = resolveSettingsPath();
  console.log('[cc-plan-viewer] Uninstalling...');

  // Remove hook from settings
  const settings = readSettings(settingsPath);
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (hooks?.PostToolUse && Array.isArray(hooks.PostToolUse)) {
    const before = hooks.PostToolUse.length;
    hooks.PostToolUse = hooks.PostToolUse.filter((entry: unknown) => {
      if (typeof entry !== 'object' || entry === null) return true;
      const e = entry as Record<string, unknown>;
      if (!Array.isArray(e.hooks)) return true;
      return !e.hooks.some((h: unknown) => {
        if (typeof h !== 'object' || h === null) return false;
        const cmd = (h as Record<string, unknown>).command;
        return typeof cmd === 'string' && cmd.includes('plan-viewer-hook');
      });
    });
    if (hooks.PostToolUse.length < before) {
      writeSettings(settingsPath, settings);
      console.log(`[cc-plan-viewer] Hook removed from ${settingsPath}`);
    }
  }

  // Remove installed files
  if (fs.existsSync(INSTALL_DIR)) {
    fs.rmSync(INSTALL_DIR, { recursive: true });
    console.log('[cc-plan-viewer] Removed ~/.cc-plan-viewer/');
  }

  console.log('[cc-plan-viewer] Uninstalled.');
}

function start(): void {
  console.log('[cc-plan-viewer] Starting server...');
  import('../server/index.js');
}

function open(filename?: string): void {
  const port = 3847;
  const url = filename
    ? `http://localhost:${port}/?plan=${encodeURIComponent(filename)}`
    : `http://localhost:${port}`;
  try {
    execSync(`open "${url}"`, { stdio: 'ignore' });
    console.log(`[cc-plan-viewer] Opened ${url}`);
  } catch {
    console.log(`[cc-plan-viewer] Open this URL in your browser: ${url}`);
  }
}

function version(): void {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(INSTALL_DIR, 'version.json'), 'utf8'));
    console.log(`Installed: ${v.version} (${v.installedAt})`);
  } catch {
    console.log('Not installed locally. Run: npx cc-plan-viewer install');
  }
  try {
    const pkgRoot = getPkgRoot();
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
    console.log(`Package:   ${pkg.version}`);
  } catch {}
}

// ─── CLI ───
const command = process.argv[2];
switch (command) {
  case 'install':
    install();
    break;
  case 'update':
    update();
    break;
  case 'uninstall':
    uninstall();
    break;
  case 'start':
    start();
    break;
  case 'open':
    open(process.argv[3]);
    break;
  case 'version':
    version();
    break;
  default:
    console.log(`
cc-plan-viewer — Browser-based review UI for Claude Code plans

Usage:
  npx cc-plan-viewer install              Install hook + viewer files
  npx cc-plan-viewer install --config <path>  Use custom settings.json path
  npx cc-plan-viewer@latest update        Update to latest version
  npx cc-plan-viewer uninstall            Remove hook + viewer files
  npx cc-plan-viewer version              Show installed version

Files are installed to ~/.cc-plan-viewer/ so they persist across npm cache clears.
`);
}
