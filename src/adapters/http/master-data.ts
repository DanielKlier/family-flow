import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyReply } from "fastify";

import { createAccount, updateAccount } from "../../core/accounts/account.js";
import { createCategory, updateCategory } from "../../core/categories/category.js";
import { createOwnerContextLabel, parseOwnerContext } from "../../core/shared/owner-context.js";
import type { AccountRepository } from "../../ports/repositories/account-repository.js";
import type { CategoryRepository } from "../../ports/repositories/category-repository.js";
import type { OwnerContextRepository } from "../../ports/repositories/owner-context-repository.js";
import { readForm, readRouteId } from "./request-values.js";
import {
  renderAccountEditPage,
  renderCategoryEditPage,
  renderMasterDataPage,
} from "./templates/master-data.js";

type MasterDataRouteRepositories = {
  accounts: AccountRepository;
  categories: CategoryRepository;
  ownerContexts: OwnerContextRepository;
};

export function registerMasterDataRoutes(
  server: FastifyInstance,
  repositories: MasterDataRouteRepositories,
): void {
  server.get("/admin/master-data", async (_request, reply) => {
    return renderMasterData(repositories, reply);
  });

  server.post("/admin/master-data/accounts", async (request, reply) => {
    const form = readForm(request.body);
    try {
      await repositories.accounts.save(
        createAccount({
          id: `account-${randomUUID()}`,
          name: form.name ?? "",
          ownerContext: form.ownerContext ?? "",
        }),
      );
    } catch (error: unknown) {
      return renderMasterData(repositories, reply.status(400), errorMessage(error));
    }

    return reply.redirect("/admin/master-data");
  });

  server.get("/admin/master-data/accounts/:id/edit", async (request, reply) => {
    const [account, ownerContexts] = await Promise.all([
      repositories.accounts.get(readRouteId(request.params)),
      repositories.ownerContexts.list(),
    ]);
    if (account === null) {
      return reply.status(404).send("Account not found");
    }

    return reply
      .type("text/html; charset=utf-8")
      .send(renderAccountEditPage(account, ownerContexts));
  });

  server.post("/admin/master-data/accounts/:id", async (request, reply) => {
    const account = await repositories.accounts.get(readRouteId(request.params));
    if (account === null) {
      return reply.status(404).send("Account not found");
    }

    const form = readForm(request.body);
    try {
      await repositories.accounts.save(
        updateAccount(account, {
          name: form.name ?? "",
          ownerContext: form.ownerContext ?? "",
          active: form.active === "on",
        }),
      );
    } catch (error: unknown) {
      const ownerContexts = await repositories.ownerContexts.list();

      return reply
        .status(400)
        .type("text/html; charset=utf-8")
        .send(renderAccountEditPage(account, ownerContexts, errorMessage(error)));
    }

    return reply.redirect("/admin/master-data");
  });

  server.post("/admin/master-data/accounts/:id/deactivate", async (request, reply) => {
    const account = await repositories.accounts.get(readRouteId(request.params));
    if (account === null) {
      return reply.status(404).send("Account not found");
    }

    await repositories.accounts.save({ ...account, active: false });

    return reply.redirect("/admin/master-data");
  });

  server.post("/admin/master-data/owner-contexts/:ownerContext", async (request, reply) => {
    const form = readForm(request.body);
    try {
      await repositories.ownerContexts.save(
        createOwnerContextLabel({
          ownerContext: readRouteOwnerContext(request.params),
          label: form.label ?? "",
        }),
      );
    } catch (error: unknown) {
      return renderMasterData(
        repositories,
        reply.status(400),
        undefined,
        undefined,
        errorMessage(error),
      );
    }

    return reply.redirect("/admin/master-data");
  });

  server.post("/admin/master-data/categories", async (request, reply) => {
    const form = readForm(request.body);
    try {
      await repositories.categories.save(
        createCategory({
          id: `category-${randomUUID()}`,
          name: form.name ?? "",
        }),
      );
    } catch (error: unknown) {
      return renderMasterData(repositories, reply.status(400), undefined, errorMessage(error));
    }

    return reply.redirect("/admin/master-data");
  });

  server.get("/admin/master-data/categories/:id/edit", async (request, reply) => {
    const category = await repositories.categories.get(readRouteId(request.params));
    if (category === null) {
      return reply.status(404).send("Category not found");
    }

    return reply.type("text/html; charset=utf-8").send(renderCategoryEditPage(category));
  });

  server.post("/admin/master-data/categories/:id", async (request, reply) => {
    const category = await repositories.categories.get(readRouteId(request.params));
    if (category === null) {
      return reply.status(404).send("Category not found");
    }

    const form = readForm(request.body);
    try {
      await repositories.categories.save(
        updateCategory(category, {
          name: form.name ?? "",
          active: form.active === "on",
        }),
      );
    } catch (error: unknown) {
      return reply
        .status(400)
        .type("text/html; charset=utf-8")
        .send(renderCategoryEditPage(category, errorMessage(error)));
    }

    return reply.redirect("/admin/master-data");
  });

  server.post("/admin/master-data/categories/:id/deactivate", async (request, reply) => {
    const category = await repositories.categories.get(readRouteId(request.params));
    if (category === null) {
      return reply.status(404).send("Category not found");
    }

    await repositories.categories.save({ ...category, active: false });

    return reply.redirect("/admin/master-data");
  });
}

async function renderMasterData(
  repositories: MasterDataRouteRepositories,
  reply: FastifyReply,
  accountError?: string,
  categoryError?: string,
  ownerContextError?: string,
) {
  const [accounts, categories, ownerContexts] = await Promise.all([
    repositories.accounts.list(),
    repositories.categories.list(),
    repositories.ownerContexts.list(),
  ]);

  return reply.type("text/html; charset=utf-8").send(
    renderMasterDataPage({
      accounts,
      categories,
      ownerContexts,
      accountError,
      categoryError,
      ownerContextError,
    }),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Master data could not be saved";
}

function readRouteOwnerContext(params: unknown): ReturnType<typeof parseOwnerContext> {
  if (typeof params !== "object" || params === null || !("ownerContext" in params)) {
    throw new Error("Owner context is required");
  }

  const { ownerContext } = params;
  if (typeof ownerContext !== "string") {
    throw new Error("Owner context is required");
  }

  return parseOwnerContext(ownerContext);
}
