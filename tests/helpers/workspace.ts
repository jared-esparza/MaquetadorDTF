import type { Locator, Page } from '@playwright/test';

export async function openWorkspaceOptions(page: Page, name: string) {
  const summary = page.locator('summary').filter({ hasText: name });
  if (await summary.locator('..').getAttribute('open') === null) await summary.click();
}

export async function openDesignTools(card: Locator) {
  const opener = card.getByRole('button', { name: 'Editar diseño', exact: true });
  if (await opener.isVisible()) await opener.click();
}
