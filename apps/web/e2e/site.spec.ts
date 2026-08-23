import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("bioctl public profile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens on Links, supports chat, and renders cleanly on mobile", async ({ page }) => {
    await page.goto("/");

    const linksTab = page.getByRole("tab", { name: "[ links ]" });
    await expect(linksTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("link", { name: /Your website/i })).toBeVisible();

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to profile" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.getByRole("tab", { name: "[ chat ]" }).click();
    await page.getByRole("textbox", { name: "Your question" }).fill("What do you make?");
    await page.getByRole("button", { name: "send ->" }).click();
    await expect(page.getByText(/This demo is connected to public context/)).toBeVisible();

    await page.screenshot({
      fullPage: true,
      path: "test-results/bioctl-mobile.png",
    });
  });

  test("has no automated WCAG A or AA violations on either tab", async ({ page }) => {
    await page.goto("/");

    const linksResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(linksResults.violations).toEqual([]);

    await page.getByRole("tab", { name: "[ chat ]" }).click();
    const chatResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(chatResults.violations).toEqual([]);
  });
});
