#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
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

// ─── Multi-config detection ───
function findAllClaudeSettings(): string[] {
  const home = os.homedir();
  const found = new Set<string>();

  // Scan ~/.claude*/settings.json
  try {
    for (const name of fs.readdirSync(home)) {
      if (!name.startsWith('.claude')) continue;
      const candidate = path.join(home, name, 'settings.json');
      if (fs.existsSync(candidate)) found.add(candidate);
    }
  } catch {}

  // Include CLAUDE_CONFIG_DIR if set (may point outside ~/.claude*)
  if (process.env.CLAUDE_CONFIG_DIR) {
    const candidate = path.join(process.env.CLAUDE_CONFIG_DIR, 'settings.json');
    if (fs.existsSync(candidate)) found.add(candidate);
  }

  return [...found].sort();
}

function tildePath(p: string): string {
  return p.replace(os.homedir(), '~');
}

async function promptMultiSelect(
  options: string[],
  question: string,
  activeConfigDir?: string,
): Promise<number[]> {
  // Non-interactive: fall back to CLAUDE_CONFIG_DIR or all
  if (!process.stdin.isTTY) {
    if (activeConfigDir) {
      const match = options.findIndex(p => p.startsWith(activeConfigDir));
      return match >= 0 ? [match] : [0];
    }
    return options.map((_, i) => i);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('');
  console.log(`[cc-plan-viewer] Found ${options.length} Claude config directories:`);
  options.forEach((opt, i) => {
    const active = activeConfigDir && opt.startsWith(activeConfigDir) ? ' (active)' : '';
    console.log(`  ${i + 1}. ${tildePath(opt)}${active}`);
  });
  console.log('');

  return new Promise((resolve) => {
    rl.question(`${question} (comma-separated numbers, or "all"): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'all' || trimmed === '') {
        resolve(options.map((_, i) => i));
        return;
      }
      const indices = trimmed.split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(i => i >= 0 && i < options.length);
      resolve(indices);
    });
  });
}

function addHookToSettings(settingsPath: string): void {
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
}

function removeHookFromSettings(settingsPath: string): boolean {
  const settings = readSettings(settingsPath);
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks?.PostToolUse || !Array.isArray(hooks.PostToolUse)) return false;

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
    return true;
  }
  return false;
}

function settingsHasHook(settingsPath: string): boolean {
  const settings = readSettings(settingsPath);
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;
  if (!hooks?.PostToolUse || !Array.isArray(hooks.PostToolUse)) return false;
  return hooks.PostToolUse.some((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    if (!Array.isArray(e.hooks)) return false;
    return e.hooks.some((h: unknown) => {
      if (typeof h !== 'object' || h === null) return false;
      const cmd = (h as Record<string, unknown>).command;
      return typeof cmd === 'string' && cmd.includes('plan-viewer-hook');
    });
  });
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

async function install(): Promise<void> {
  console.log('[cc-plan-viewer] Installing...');
  console.log(`[cc-plan-viewer] Install dir: ${INSTALL_DIR}`);

  // Copy files to stable location
  installFiles();
  console.log('[cc-plan-viewer] Files copied to ~/.cc-plan-viewer/');
  patchHookPaths();

  // Determine which settings files to update
  const configIdx = process.argv.indexOf('--config');
  if (configIdx !== -1 && process.argv[configIdx + 1]) {
    // Explicit --config flag: use exactly that path
    const settingsPath = path.resolve(process.argv[configIdx + 1]);
    if (!fs.existsSync(path.dirname(settingsPath))) {
      console.error(`[cc-plan-viewer] Directory does not exist: ${path.dirname(settingsPath)}`);
      process.exit(1);
    }
    addHookToSettings(settingsPath);
    console.log(`[cc-plan-viewer] Hook added to ${tildePath(settingsPath)}`);
  } else {
    const allSettings = findAllClaudeSettings();

    if (allSettings.length === 0) {
      // No existing configs — create default
      addHookToSettings(DEFAULT_SETTINGS);
      console.log(`[cc-plan-viewer] Hook added to ${tildePath(DEFAULT_SETTINGS)}`);
    } else if (allSettings.length === 1) {
      // Single config — use it directly
      addHookToSettings(allSettings[0]);
      console.log(`[cc-plan-viewer] Hook added to ${tildePath(allSettings[0])}`);
    } else {
      // Multiple configs — prompt user
      const selected = await promptMultiSelect(
        allSettings,
        'Install hook in which configs?',
        process.env.CLAUDE_CONFIG_DIR,
      );

      if (selected.length === 0) {
        console.log('[cc-plan-viewer] No configs selected. Hook not installed.');
        return;
      }

      for (const idx of selected) {
        addHookToSettings(allSettings[idx]);
        console.log(`[cc-plan-viewer] Hook added to ${tildePath(allSettings[idx])}`);
      }
    }
  }

  console.log('');
  console.log('[cc-plan-viewer] Hook installed successfully.');
  console.log('');
  console.log('  Next time Claude Code writes a plan, the viewer will open in your browser.');
  console.log('');
  console.log('  Update anytime:   npx cc-plan-viewer@latest update');
  console.log('  Uninstall:        npx cc-plan-viewer uninstall');
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

async function uninstall(): Promise<void> {
  console.log('[cc-plan-viewer] Uninstalling...');

  // Determine which settings files to clean up
  const configIdx = process.argv.indexOf('--config');
  if (configIdx !== -1 && process.argv[configIdx + 1]) {
    const settingsPath = path.resolve(process.argv[configIdx + 1]);
    if (removeHookFromSettings(settingsPath)) {
      console.log(`[cc-plan-viewer] Hook removed from ${tildePath(settingsPath)}`);
    }
  } else {
    const allSettings = findAllClaudeSettings();
    const withHook = allSettings.filter(settingsHasHook);

    if (withHook.length === 0) {
      console.log('[cc-plan-viewer] No hooks found in any Claude config.');
    } else if (withHook.length === 1) {
      removeHookFromSettings(withHook[0]);
      console.log(`[cc-plan-viewer] Hook removed from ${tildePath(withHook[0])}`);
    } else {
      const selected = await promptMultiSelect(
        withHook,
        'Remove hook from which configs?',
      );
      for (const idx of selected) {
        removeHookFromSettings(withHook[idx]);
        console.log(`[cc-plan-viewer] Hook removed from ${tildePath(withHook[idx])}`);
      }
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
    await install();
    break;
  case 'update':
    update();
    break;
  case 'uninstall':
    await uninstall();
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
  npx cc-plan-viewer install                  Install hook + viewer files
  npx cc-plan-viewer install --config <path>  Use specific settings.json path
  npx cc-plan-viewer@latest update            Update to latest version
  npx cc-plan-viewer uninstall                Remove hook + viewer files
  npx cc-plan-viewer version                  Show installed version

When multiple Claude configs are detected (~/.claude*/settings.json),
you'll be prompted to choose which ones to install the hook in.

Files are installed to ~/.cc-plan-viewer/ so they persist across npm cache clears.
`);
}
