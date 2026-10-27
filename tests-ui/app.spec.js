import {
  test,
  expect,
} from "../frontend/node_modules/@playwright/test/index.mjs";
test("app renders English copy and supports the pledge form", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Keep your promise. Go further every day.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Your next promise starts here")).toBeVisible();
  await page.screenshot({
    path: `../test-results/${testInfo.project.name}-home.png`,
    fullPage: true,
  });
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        right: el.getBoundingClientRect().right,
      }))
      .slice(0, 15),
  );
  expect(overflow).toEqual([]);
  await page.getByRole("button", { name: "Create your first pledge" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /Code/ }).click();
  await page.getByText("Preview the criteria that will be locked").click();
  await expect(
    page.getByText(/Make at least 10 substantive commits/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .last()
    .click();
  await expect(page.getByText(/Install MetaMask/)).toBeAttached();
  await page.screenshot({
    path: `../test-results/${testInfo.project.name}-create.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
