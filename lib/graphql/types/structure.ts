import { builder } from "../builder";
import { GameBlockType } from "@/lib/generated/prisma/enums";

export const GameBlockTypeEnum = builder.enumType(GameBlockType, {
  name: "GameBlockType",
});

builder.prismaObject("MatchFormatBlock", {
  fields: (t) => ({
    id: t.exposeID("id"),
    order: t.exposeInt("order"),
    type: t.expose("type", { type: GameBlockTypeEnum }),
    games: t.exposeInt("games"),
    raceTo: t.exposeInt("raceTo", { nullable: true }),
    breakAfterMin: t.exposeInt("breakAfterMin", { nullable: true }),
  }),
});

export const MatchFormatBlockInput = builder.inputType(
  "MatchFormatBlockInput",
  {
    fields: (t) => ({
      type: t.field({ type: GameBlockTypeEnum, required: true }),
      games: t.int({ required: true }),
      raceTo: t.int(),
      breakAfterMin: t.int(),
    }),
  },
);
