import { useTranslations } from "next-intl";

import { usePhysicsFormat } from "@/features/black-hole/hooks/use-physics-format";
import {
  criticalImpactParameters,
  horizonOverM,
  iscoOverM,
  iscoPeriodSeconds,
  photonOverM,
  schwarzschildKm,
} from "@/features/black-hole/lib/physics";
import type { PinId } from "@/features/black-hole/lib/pins";
import { useBlackHole } from "@/features/black-hole/lib/store";
import { Equation, PanelHeader, Sub } from "@horizon/toolkit/ui";

/** Lesson card body for one gauge pin, shared by the desktop card and the phone sheet. */
export function PinLesson({ id, spin, onClose }: { id: PinId; spin: number; onClose: () => void }) {
  const t = useTranslations("blackHole");
  const massSolar = useBlackHole((s) => s.massSolar);
  const rs = schwarzschildKm(massSolar);
  const rh = horizonOverM(spin);
  const rp = photonOverM(spin);
  const ri = iscoOverM(spin);
  const period = iscoPeriodSeconds(massSolar, spin);
  const kicker =
    id === "horizon"
      ? t("pinHorizonK")
      : id === "photon"
        ? t("pinPhotonK")
        : id === "isco"
          ? t("pinIscoK")
          : t("pinDopplerK");
  const title =
    id === "horizon"
      ? t("pinHorizonT")
      : id === "photon"
        ? t("pinPhotonT")
        : id === "isco"
          ? t("pinIscoT")
          : t("pinDopplerT");

  return (
    <div>
      <PanelHeader kicker={kicker} title={title} onClose={onClose} closeLabel={t("ariaClose")} />
      <div className="mt-2 flex flex-col gap-2">
        {id === "horizon" ? (
          <HorizonLesson massSolar={massSolar} rs={rs} rh={rh} spin={spin} />
        ) : null}
        {id === "photon" ? <PhotonLesson rp={rp} rs={rs} spin={spin} /> : null}
        {id === "isco" ? (
          <IscoLesson ri={ri} period={period} spin={spin} massSolar={massSolar} />
        ) : null}
        {id === "doppler" ? <DopplerLesson /> : null}
      </div>
    </div>
  );
}

function HorizonLesson({
  massSolar,
  rs,
  rh,
  spin,
}: {
  massSolar: number;
  rs: number;
  rh: number;
  spin: number;
}) {
  const { formatMass, formatLengthKm, formatSpin } = usePhysicsFormat();
  const rPlusKm = (rh / 2) * rs;
  const t = useTranslations("blackHole");
  return (
    <>
      <p className="text-sm leading-relaxed text-fg-primary/80">
        {t("pins.horizon1", { rh: rh.toFixed(2) })}
      </p>
      <Equation>
        R<Sub>s</Sub> = 2GM / c² = {formatLengthKm(rs)}
      </Equation>
      <Equation>
        r₊ / M = 1 + √(1 − a<Sub>*</Sub>²)
      </Equation>
      <p className="text-sm leading-relaxed text-fg-primary/80">
        {t("pins.horizon2", {
          mass: formatMass(massSolar),
          spin: formatSpin(spin),
          km: formatLengthKm(rPlusKm),
        })}
      </p>
    </>
  );
}

function PhotonLesson({ rp, rs, spin }: { rp: number; rs: number; spin: number }) {
  const { formatLengthKm } = usePhysicsFormat();
  const bc = criticalImpactParameters(spin);
  const spinning = Math.abs(spin) >= 1e-3;
  const t = useTranslations("blackHole");
  return (
    <>
      <p className="text-sm leading-relaxed text-fg-primary/80">{t("pins.photon1")}</p>
      <Equation>
        r<Sub>ph</Sub> = 3M = {formatLengthKm((3 / 2) * rs)}
        <span className="text-fg-tertiary"> (a</span>
        <Sub>*</Sub>
        <span className="text-fg-tertiary"> = 0)</span>
      </Equation>
      <Equation>
        r<Sub>ph</Sub>/M = 2(1 + cos(⅔ arccos(−a<Sub>*</Sub>)))
      </Equation>
      {spinning ? (
        <Equation>
          b<Sub>c</Sub> = {bc.prograde.toFixed(2)} M
          <span className="text-fg-tertiary"> ({t("pins.prograde")})</span> ·{" "}
          {bc.retrograde.toFixed(2)} M
          <span className="text-fg-tertiary"> ({t("pins.retrograde")})</span>
        </Equation>
      ) : (
        <Equation>
          b<Sub>c</Sub> = 3√3 M = {bc.prograde.toFixed(2)} M
          <span className="text-fg-tertiary"> (a</span>
          <Sub>*</Sub>
          <span className="text-fg-tertiary"> = 0)</span>
        </Equation>
      )}
      <p className="text-sm leading-relaxed text-fg-primary/80">
        {t(spin < 0 ? "pins.photon2Retro" : "pins.photon2", { rp: rp.toFixed(2) })}
      </p>
    </>
  );
}

function IscoLesson({
  ri,
  period,
  spin,
  massSolar,
}: {
  ri: number;
  period: number;
  spin: number;
  massSolar: number;
}) {
  const { formatMass, formatDuration, formatSpin } = usePhysicsFormat();
  const t = useTranslations("blackHole");
  return (
    <>
      <p className="text-sm leading-relaxed text-fg-primary/80">{t("pins.isco1")}</p>
      <Equation>
        r<Sub>ISCO</Sub> = 6M
        <span className="text-fg-tertiary"> (Schwarzschild)</span>
      </Equation>
      <Equation>
        r<Sub>ISCO</Sub> → M<span className="text-fg-tertiary"> {t("asSpin")}</span>
        <Sub>*</Sub>
        <span className="text-fg-tertiary"> → 1</span>
      </Equation>
      <Equation>
        P = 2π ((r/M)<sup className="text-xs">3/2</sup> + a<Sub>*</Sub>) GM/c³
      </Equation>
      <p className="text-sm leading-relaxed text-fg-primary/80">
        {t(spin < 0 ? "pins.isco2Retro" : "pins.isco2", {
          spin: formatSpin(spin),
          ri: ri.toFixed(2),
          mass: formatMass(massSolar),
          period: formatDuration(period),
        })}
      </p>
    </>
  );
}

function DopplerLesson() {
  const t = useTranslations("blackHole");
  return (
    <>
      <p className="text-sm leading-relaxed text-fg-primary/80">{t("pins.doppler1")}</p>
      <Equation>δ = 1 / (γ (1 − β μ))</Equation>
      <Equation>
        I<Sub>ν,obs</Sub>(ν) = g³ I<Sub>ν,em</Sub>(ν/g)
      </Equation>
      <Equation>
        I<Sub>bol,obs</Sub> = g⁴ I<Sub>bol,em</Sub>
      </Equation>
      <Equation>
        g<Sub>static</Sub> = √(1 − 2M/r)
        <span className="text-fg-tertiary"> {t("pins.dopplerRedshift")}</span>
      </Equation>
      <p className="text-sm leading-relaxed text-fg-primary/80">{t("pins.doppler2")}</p>
    </>
  );
}
