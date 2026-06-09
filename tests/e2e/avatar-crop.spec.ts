import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAs } from "./helpers";

test.describe("Round-19 · Avatar crop modal", () => {
  test("avatar upload opens the crop/zoom modal before sending", async ({
    page,
  }) => {
    await signInAs(page, "hai");
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: /set up your profile/i }),
    ).toBeVisible();
    // Drop a tiny PNG into the avatar upload — the modal should open.
    const fileInput = page.locator(
      '[data-testid="image-upload-avatar"] ~ * input[type="file"], input[type="file"]',
    ).first();
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000005000100b9d8e7a30000000049454e44ae426082",
      "hex",
    );
    await fileInput.setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByTestId("avatar-crop-modal")).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByTestId("avatar-crop-modal")).toHaveCount(0);
    void path;
  });
});
