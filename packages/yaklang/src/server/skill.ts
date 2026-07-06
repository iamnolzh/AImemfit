import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Skill } from "../skill/skill"
import { errors } from "./error"

export const SkillRoute = new Hono()
  .get(
    "/",
    describeRoute({
      summary: "List skills",
      description: "Get a list of all available skills for the current project (from .yaklang/skill and .claude/skills).",
      operationId: "app.skills",
      responses: {
        200: {
          description: "List of skills",
          content: {
            "application/json": {
              schema: resolver(Skill.Info.array()),
            },
          },
        },
      },
    }),
    async (c) => {
      const skills = await Skill.all()
      return c.json(skills)
    },
  )
  .get(
    "/:name",
    describeRoute({
      summary: "Get skill",
      description: "Get a skill with editable markdown content.",
      operationId: "app.skill.get",
      responses: {
        200: {
          description: "Skill detail",
          content: {
            "application/json": {
              schema: resolver(Skill.Detail),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ name: z.string() })),
    async (c) => {
      const skill = await Skill.detail(c.req.valid("param").name)
      if (!skill) return c.json({ message: "Skill not found" }, 404)
      return c.json(skill)
    },
  )
  .post(
    "/",
    describeRoute({
      summary: "Create skill",
      description: "Create a project skill under .yaklang/skill.",
      operationId: "app.skill.create",
      responses: {
        200: {
          description: "Created skill",
          content: {
            "application/json": {
              schema: resolver(Skill.Detail),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator("json", Skill.UpsertInput),
    async (c) => {
      return c.json(await Skill.create(c.req.valid("json")))
    },
  )
  .patch(
    "/:name",
    describeRoute({
      summary: "Update skill",
      description: "Update a project skill under .yaklang/skill.",
      operationId: "app.skill.update",
      responses: {
        200: {
          description: "Updated skill",
          content: {
            "application/json": {
              schema: resolver(Skill.Detail),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator("param", z.object({ name: z.string() })),
    validator("json", Skill.UpsertInput),
    async (c) => {
      return c.json(await Skill.update(c.req.valid("param").name, c.req.valid("json")))
    },
  )
  .delete(
    "/:name",
    describeRoute({
      summary: "Delete skill",
      description: "Delete a project skill under .yaklang/skill.",
      operationId: "app.skill.delete",
      responses: {
        200: {
          description: "Deleted",
          content: {
            "application/json": {
              schema: resolver(z.boolean()),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator("param", z.object({ name: z.string() })),
    async (c) => {
      return c.json(await Skill.remove(c.req.valid("param").name))
    },
  )
