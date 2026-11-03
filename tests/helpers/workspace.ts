import type { Page } from '@playwright/test';

export async function openWorkspaceOptions(page: Page, name: string) {
  const summary = page.locator('summary').filter({ hasText: name });
  if (await summary.locator('..').getAttribute('open') === null) await summary.click();
}
