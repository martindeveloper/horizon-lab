import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { PLANET_IDS, type NamedId, type PlanetId } from "@horizon/toolkit/bodies";
import { Chip, ListItem, OrbitPad, cn } from "@horizon/toolkit/ui";

import { BINS, tallyAt } from "../lib/model/tracers";
import { type ViewId } from "../lib/model/views";
import { useOrrery, type Selection } from "../lib/store";
import { NAMED_IDS, NEIGHBOUR_IDS } from "./cards";
import { Rail, Section } from "./rail";
import { DISPLAY, EXTRA, Switches } from "./view-controls";

function Pick({ label, onPick }: { label: string; onPick: () => void }) {
  return <ListItem onClick={onPick}>{label}</ListItem>;
}

/** Layers, display switches, camera pad and every pickable object. */
export function ObjectsPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations("orrery");
  const yearsAgo = useOrrery((s) => s.yearsAgo);
  const show = useOrrery((s) => s.show);
  const patchShow = useOrrery((s) => s.patchShow);
  const tally = useMemo(() => tallyAt(yearsAgo), [yearsAgo]);
  const pick = (sel: Selection, view: ViewId | null) => {
    const api = useOrrery.getState();
    if (view) api.setView(view);
    api.select(sel);
    api.setPanel("none");
  };
  const planetView = (id: PlanetId): ViewId =>
    id === "mercury" || id === "venus" || id === "earth" || id === "mars"
      ? "inner"
      : id === "neptune"
        ? "kuiper"
        : "giants";
  const namedView = (id: NamedId): ViewId =>
    id === "sedna" ? "scattered" : id === "pluto" ? "kuiper" : "giants";
  return (
    <Rail id="orrery-objects" title={t("hud.objects")} onClose={onClose}>
      <Section title={t("layers.title")} note={t("hud.legend")}>
        <div className="flex flex-wrap gap-1">
          {BINS.map((bin) => (
            <Chip
              key={bin}
              role="switch"
              aria-checked={show[bin]}
              selected={show[bin]}
              onClick={() => patchShow({ [bin]: !show[bin] })}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  show[bin] ? "bg-accent" : "bg-border-strong",
                )}
                aria-hidden
              />
              {t("layers.count", { label: t(`layers.${bin}`), count: tally[bin] })}
            </Chip>
          ))}
        </div>
      </Section>
      <Section title={t("hud.display")}>
        <Switches keys={[...DISPLAY, ...EXTRA]} />
      </Section>
      <Section title={t("hud.camera")}>
        <OrbitPad
          aria-label={t("hud.camera")}
          className="mx-auto"
          labels={{
            left: t("hud.rotateLeft"),
            right: t("hud.rotateRight"),
            up: t("hud.tiltUp"),
            down: t("hud.tiltDown"),
          }}
          onRotate={(turn) => useOrrery.getState().rotate(turn)}
        />
      </Section>
      <Section title={t("hud.bodies")}>
        <div className="grid grid-cols-2 gap-1">
          <Pick label={t("names.sun")} onPick={() => pick({ kind: "sun" }, "inner")} />
          {PLANET_IDS.map((id) => (
            <Pick
              key={id}
              label={t(`names.${id}`)}
              onPick={() => pick({ kind: "planet", id }, planetView(id))}
            />
          ))}
        </div>
      </Section>
      <Section title={t("hud.examples")}>
        <div className="grid gap-1">
          {NAMED_IDS.map((id) => (
            <Pick
              key={id}
              label={t(`names.${id}`)}
              onPick={() => pick({ kind: "named", id }, namedView(id))}
            />
          ))}
          <Pick
            label={t("names.asteroids")}
            onPick={() => pick({ kind: "population", id: "asteroids" }, "inner")}
          />
          {BINS.map((bin) => (
            <Pick
              key={bin}
              label={t(`cards.populations.${bin}.title`)}
              onPick={() =>
                pick(
                  { kind: "population", id: bin },
                  bin === "disk" ? "giants" : bin === "ejected" ? "oort" : bin,
                )
              }
            />
          ))}
        </div>
      </Section>
      <Section title={t("hud.galaxyItems")}>
        <div className="grid gap-1">
          <Pick
            label={t("names.milkyway")}
            onPick={() => pick({ kind: "galaxy", id: "milkyway" }, "galaxy")}
          />
          <Pick
            label={t("cards.galaxy.sun.title")}
            onPick={() => pick({ kind: "galaxy", id: "sun" }, "galaxy")}
          />
          <Pick
            label={t("names.bulge")}
            onPick={() => pick({ kind: "galaxy", id: "bulge" }, "galaxy")}
          />
          <Pick
            label={t("names.halo")}
            onPick={() => pick({ kind: "galaxy", id: "halo" }, "galaxy")}
          />
        </div>
      </Section>
      <Section title={t("hud.cosmosItems")}>
        <div className="grid gap-1">
          <Pick
            label={t("names.localGroup")}
            onPick={() => pick({ kind: "cosmos", id: "localGroup" }, "local-group")}
          />
          <Pick
            label={t("names.localSheet")}
            onPick={() => pick({ kind: "cosmos", id: "localSheet" }, "local-sheet")}
          />
          <Pick
            label={t("cards.cosmos.andromeda.title")}
            onPick={() => pick({ kind: "cosmos", id: "andromeda" }, "local-group")}
          />
          <Pick
            label={t("names.virgoCluster")}
            onPick={() => pick({ kind: "cosmos", id: "virgo" }, "virgo-cluster")}
          />
          <Pick
            label={t("names.virgoSupercluster")}
            onPick={() => pick({ kind: "cosmos", id: "supercluster" }, "virgo-supercluster")}
          />
          <Pick
            label={t("names.laniakea")}
            onPick={() => pick({ kind: "cosmos", id: "laniakea" }, "laniakea")}
          />
        </div>
      </Section>
      <Section title={t("hud.neighbours")}>
        <div className="grid gap-1">
          {NEIGHBOUR_IDS.map((id) => (
            <Pick
              key={id}
              label={t(`names.${id}`)}
              onPick={() => pick({ kind: "star", id }, "stars")}
            />
          ))}
        </div>
      </Section>
    </Rail>
  );
}
