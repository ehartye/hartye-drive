/**
 * The update offer (practices F4).
 *
 * `registerType: 'prompt'` means a new build installs and then *waits*. This is
 * the only thing in the app that can let it through, and it is a polite toast
 * with two buttons — never an automatic reload.
 *
 * It renders from `AppShell`, which the three focus modes sit outside, so the
 * offer cannot structurally appear over a question. `shouldOfferUpdate` adds
 * the second guarantee: an exam attempt on the device suppresses it entirely,
 * because accepting reloads the page and a learner mid-exam should not be asked
 * to think about a software update at all.
 */
import { useState } from 'react';
import { Button, Toast, ToastDock } from '~/components';
import { shouldOfferUpdate } from '~/domain/update';

export interface UpdatePromptProps {
  /** A new build is installed and waiting in the service worker. */
  waiting: boolean;
  /** An exam attempt is on the device. Nothing may interrupt it. */
  examInProgress: boolean;
  /** Lets the waiting build through and reloads. Called only from the button. */
  onUpdate: () => void;
}

export function UpdatePrompt({ waiting, examInProgress, onUpdate }: UpdatePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!shouldOfferUpdate({ waiting, examInProgress, dismissed })) return null;

  return (
    <ToastDock>
      <Toast
        tone="guide"
        title="A newer version is ready"
        onDismiss={() => {
          setDismissed(true);
        }}
      >
        <span className="row gap-3 mt-2">
          <Button variant="guide" onClick={onUpdate}>
            Update now
          </Button>
          <span className="faint text-[0.8125rem]">
            Nothing is downloaded — it is already on this device. Your progress is kept.
          </span>
        </span>
      </Toast>
    </ToastDock>
  );
}
