import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

import compile from "icu-minify/compile";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Match next-intl's build-time alias and enable its development runtime checks.
register(
  `data:text/javascript,${encodeURIComponent(`
    export function resolve(specifier, context, nextResolve) {
      return nextResolve(
        specifier === "use-intl/format-message" ? "use-intl/format-message/format-only" : specifier,
        {...context, conditions: [...context.conditions, "development"]},
      );
    }
  `)}`,
  import.meta.url,
);

const { NextIntlClientProvider, createTranslator } = await import("next-intl");
const { StoryLine } = await import("../src/features/black-hole/components/learn.tsx");
const { figureArgs } = await import("../src/features/black-hole/lib/figures.ts");
const { useBlackHole } = await import("../src/features/black-hole/lib/store.ts");
const { featureMessages } = await import("./messages-helper.mjs");

const precompile = (messages) =>
  Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      key,
      typeof value === "string" ? compile(value) : precompile(value),
    ]),
  );
const onError = (error) => {
  throw error;
};

for (const locale of ["en", "cs"]) {
  for (const fallback of [false, true]) {
    test(`${locale}: stories render with precompiled messages${fallback ? " and a missing preset" : ""}`, () => {
      const source = featureMessages("black-hole", locale);
      const presetId = useBlackHole.getInitialState().presetId;
      if (fallback) delete source.stories[presetId];
      const storyKey = fallback ? "custom" : presetId;
      const messages = { blackHole: precompile(source) };
      const t = createTranslator({ locale, messages, namespace: "blackHole", onError });
      const html = renderToStaticMarkup(
        createElement(
          NextIntlClientProvider,
          { locale, messages, timeZone: "UTC", onError },
          createElement(StoryLine),
        ),
      );

      for (const field of ["kicker", "title", "body"]) {
        const text = t(`stories.${storyKey}.0.${field}`, figureArgs(locale));
        const escaped = renderToStaticMarkup(createElement("span", null, text)).slice(6, -7);
        assert.ok(html.includes(escaped), `${storyKey}: ${field} is rendered`);
      }
      const count = Object.keys(source.stories[storyKey]).length;
      if (count > 1) {
        for (let number = 1; number <= count; number++) {
          assert.ok(html.includes(`aria-label="${t("storyNumber", { number })}"`));
        }
        assert.equal((html.match(/aria-current="step"/g) ?? []).length, 1);
      }
      assert.doesNotMatch(html, /NaN|undefined|blackHole\.stories\./);
    });
  }
}
