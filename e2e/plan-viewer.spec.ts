import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'test-plan.md');
const PLAN_FILENAME = 'e2e-test-plan.md';

let plansDir: string;
let planPath: string;

test.beforeAll(async () => {
  // Discover the server's plans directory from health endpoint
  const res = await fetch('http://localhost:3847/health');
  const data = await res.json();
  plansDir = data.plansDirs?.[0] || data.plansDir;
  if (!plansDir) throw new Error('Could not determine plans directory from server');

  planPath = path.join(plansDir, PLAN_FILENAME);
  fs.copyFileSync(FIXTURE, planPath);

  // Give the server a moment to detect the new file
  await new Promise((resolve) => setTimeout(resolve, 500));
});

test.afterAll(() => {
  try { fs.unlinkSync(planPath); } catch {}
  try { fs.unlinkSync(planPath.replace('.md', '.review.json')); } catch {}
});

// Helper: navigate to plan and wait for content to load
async function goToPlan(page: any) {
  await page.goto(`/?plan=${PLAN_FILENAME}`);
  // Wait for the plan content to render — either the markdown content
  // or an error message. Retry on network race conditions.
  await page.waitForSelector('.prose, [class*="text-claude-text"]', { timeout: 15000 });
}

test.describe('plan-viewer E2E', () => {
  // Run serially to avoid race conditions with shared fixture file
  test.describe.configure({ mode: 'serial' });
  test('landing page shows waiting message', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Waiting for a plan')).toBeVisible();
  });

  test('shows plan title when navigating with plan param', async ({ page }) => {
    await goToPlan(page);
    // Title appears in both header h1 and markdown h1
    const headings = page.getByRole('heading', { name: 'E2E Test Plan' });
    await expect(headings.first()).toBeVisible();
  });

  test('renders markdown content correctly', async ({ page }) => {
    await goToPlan(page);
    await expect(page.getByText('Implementation Steps')).toBeVisible();
    await expect(page.getByText('Step 1: Setup')).toBeVisible();
    await expect(page.getByText('Run all tests')).toBeVisible();
    await expect(page.getByText('const x = 1;')).toBeVisible();
  });

  test('connection indicator is visible', async ({ page }) => {
    await goToPlan(page);
    await expect(page.getByTitle('Live')).toBeVisible();
  });

  test('Plan Review label is shown', async ({ page }) => {
    await goToPlan(page);
    await expect(page.getByText('Plan Review')).toBeVisible();
  });

  test('general comment textarea is functional', async ({ page }) => {
    await goToPlan(page);
    // Placeholder is "Leave a general comment about this plan..."
    const textarea = page.getByPlaceholder(/Leave a general comment/);
    await expect(textarea).toBeVisible();
    await textarea.fill('Great plan!');
    await expect(textarea).toHaveValue('Great plan!');
  });

  test('copy feedback button is disabled with no comments', async ({ page }) => {
    await goToPlan(page);
    const btn = page.getByRole('button', { name: /Copy feedback/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
  });

  test('copy feedback button is enabled after adding general comment', async ({ page }) => {
    await goToPlan(page);
    await page.getByPlaceholder(/Leave a general comment/).fill('Some feedback');
    const btn = page.getByRole('button', { name: /Copy feedback/i });
    await expect(btn).toBeEnabled();
  });

  test('selecting text shows popover', async ({ page }) => {
    await goToPlan(page);

    const target = page.getByText('Install dependencies and configure the project.');
    await expect(target).toBeVisible();
    await target.click({ clickCount: 3 });

    await expect(page.getByPlaceholder('Add your comment...')).toBeVisible({ timeout: 5000 });
  });

  test('adding a comment via popover creates comment card', async ({ page }) => {
    await goToPlan(page);

    const target = page.getByText('Install dependencies and configure the project.');
    await expect(target).toBeVisible();
    await target.click({ clickCount: 3 });

    await expect(page.getByPlaceholder('Add your comment...')).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Add your comment...').fill('Needs more detail');
    await page.getByRole('button', { name: 'Comment' }).click();

    // Comment appears in both desktop and mobile layouts, use first()
    await expect(page.getByText('Needs more detail').first()).toBeVisible();
  });
});
