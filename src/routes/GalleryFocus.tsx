import { useNavigate } from 'react-router';
import {
  Button,
  ChoiceRow,
  FocusChrome,
  QuestionCard,
  StrikeCounter,
  Timer,
} from '~/components';
import { usePageTitle } from '~/app/usePageTitle';

/**
 * FocusChrome shown full-screen, because that is the only way to judge it: the
 * nav must be gone, the offset must be reclaimed, and the exit must be explicit.
 */
export function GalleryFocus() {
  usePageTitle('Focus mode');
  const navigate = useNavigate();

  return (
    <FocusChrome
      exitLabel="End session"
      onExit={() => {
        void navigate('/gallery');
      }}
      marker={{ index: 7, total: 12 }}
      progress={{ value: 7, max: 12, label: 'Session progress: 7 of 12 answered' }}
      instruments={
        <>
          <StrikeCounter used={2} />
          <Timer secondsRemaining={2730} />
        </>
      }
      action={
        <>
          <Button variant="guide" block>
            Next question
          </Button>
          <p className="faint text-[0.75rem] text-center mt-2.5">
            5 questions left in this session
          </p>
        </>
      }
    >
      <QuestionCard
        eyebrow="Adaptive session"
        topic="Sharing the road · School buses"
        signId="s1-1-school"
        stem="A school bus ahead of you stops, flashes its red lights and swings out its stop arm. What must you do?"
      >
        <ChoiceRow letter="A">Stop, and stay stopped until the stop arm folds in.</ChoiceRow>
        <ChoiceRow letter="B" picked>
          Slow to 15 mph and pass with caution.
        </ChoiceRow>
        <ChoiceRow letter="C">Keep driving at your normal speed.</ChoiceRow>
      </QuestionCard>
    </FocusChrome>
  );
}
