import { expect, test } from "@playwright/test";

const AUSTRALIA_TOUR_SLUG = "australia-tour-of-bangladesh-1532475";

test.describe("Tour detail page", () => {
  test("shows played match results, venues, and host cities from cached snapshot", async ({ page }) => {
    await page.goto(`/tours/${AUSTRALIA_TOUR_SLUG}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /couldn't load/i })).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Fixtures", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Bangladesh won by 86 runs/i)).toBeVisible();
    await expect(page.getByText(/Australia won by 7 runs/i)).toBeVisible();
    await expect(page.getByText(/Australia vs Australia/i)).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Venues & host cities" })).toBeVisible();
    await expect(
      page.getByText("Venue guides will appear when fixtures are confirmed."),
    ).toHaveCount(0);
    await expect(page.getByText("Dhaka", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Chattogram", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Shere Bangla National Stadium/i })).toBeVisible();
  });

  test("shows per-fixture venue lines under the schedule", async ({ page }) => {
    await page.goto(`/tours/${AUSTRALIA_TOUR_SLUG}`);

    await expect(
      page.getByText(/Bir Sreshtho Flight Lieutenant Matiur Rahman Stadium/i).first(),
    ).toBeVisible();
  });

  test("does not show only upcoming placeholders for completed ODIs", async ({ page }) => {
    await page.goto(`/tours/${AUSTRALIA_TOUR_SLUG}`, { waitUntil: "networkidle" });

    await expect(page.locator("section").filter({ hasText: "Fixtures" }).locator("li")).toHaveCount(6);
    await expect(page.getByText(/1st ODI/i).first()).toBeVisible();
    await expect(page.getByText(/Bangladesh won by 86 runs/i)).toBeVisible();
  });
});
