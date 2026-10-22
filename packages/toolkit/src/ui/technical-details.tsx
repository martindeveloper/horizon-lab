"use client";

import { Sigma } from "lucide-react";
import { useImperativeHandle, useRef, type Ref } from "react";

import { Dialog, type DialogHandle } from "./dialog";
import { cn } from "./utils";

export type TechnicalDocument = {
  title: string;
  summary: string;
  features: string[];
  references?: { title: string; url: string }[];
  sections: {
    id: string;
    title: string;
    body: string;
    equations: string[];
  }[];
};

/**
 * Native modal supplies focus containment, Escape dismissal and focus restoration. `ref`
 * opens it from elsewhere (a menu row) when `triggerClassName` hides its own button.
 */
export function TechnicalDetails({
  ref,
  document,
  labels,
  triggerClassName,
}: {
  ref?: Ref<DialogHandle>;
  document: TechnicalDocument;
  labels: { open: string; close: string; features: string; references: string };
  triggerClassName?: string;
}) {
  const dialog = useRef<DialogHandle>(null);
  useImperativeHandle(
    ref,
    () => ({ open: () => dialog.current?.open(), close: () => dialog.current?.close() }),
    [],
  );
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={labels.open}
        title={labels.open}
        onClick={() => dialog.current?.open()}
        className={cn(
          "relative inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-full px-2 text-ui text-fg-secondary transition-colors duration-feedback ease-standard not-md:after:absolute not-md:after:-inset-1 hover:text-fg-primary focus-visible:ring-focus focus-visible:ring-ring focus-visible:outline-hidden md:min-h-8 md:min-w-8",
          triggerClassName,
        )}
      >
        <Sigma className="icon-toolbar" aria-hidden />
      </button>
      <Dialog ref={dialog} title={document.title} closeLabel={labels.close}>
        <div className="space-y-8 px-panel-roomy py-section-roomy sm:px-panel-wide">
          <p className="text-body text-fg-secondary">{document.summary}</p>
          <section>
            <h3 className="mb-3 font-display text-section">{labels.features}</h3>
            <ul className="list-disc space-y-2 pl-5 text-body text-fg-secondary">
              {document.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </section>
          {document.references?.length ? (
            <section>
              <h3 className="mb-3 font-display text-section">{labels.references}</h3>
              <ul className="space-y-2 text-body/5 text-fg-secondary">
                {document.references.map((reference) => (
                  <li key={reference.url}>
                    <a
                      className="underline decoration-border-strong underline-offset-4 hover:text-fg-primary"
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {reference.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {document.sections.map((section) => (
            <section key={section.id} className="border-t border-border pt-5">
              <h3 className="mb-3 font-display text-section">{section.title}</h3>
              <p className="text-body text-fg-secondary">{section.body}</p>
              {section.equations.length > 0 ? (
                <div className="mt-4 space-y-2 rounded-panel border border-border bg-surface-secondary p-panel">
                  {section.equations.map((equation) => (
                    <p
                      key={equation}
                      className="font-mono text-ui leading-relaxed break-words whitespace-pre-wrap"
                    >
                      {equation}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </Dialog>
    </>
  );
}
