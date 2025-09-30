import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserSession } from "@/context/UserSessionContext";
import {
  registerUser,
  startAssessment,
  uploadSpeechSample,
  submitCognitiveData,
  requestRiskPrediction,
  fetchAssessmentResult,
  AssessmentResult,
} from "@/services/api";
import { OnboardingForm, OnboardingFormValues } from "@/components/assessment/OnboardingForm";
import { SpeechRecorder, SpeechTask } from "@/components/assessment/SpeechRecorder";
import {
  CognitiveTasks,
  type CognitiveTask,
  type CognitiveCompletionPayload,
} from "@/components/assessment/CognitiveTasks";
import { RiskResultCard } from "@/components/assessment/RiskResultCard";
import AnalyticsCharts from "@/components/assessment/AnalyticsCharts";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ShieldCheck, BrainCircuit, AudioWaveform, ClipboardList } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { saveAssessmentResult, loadAssessmentHistory } from "@/lib/history";

const SPEECH_TASKS: SpeechTask[] = [
  {
    id: "picture-description",
    title: "Picture Description",
    description: "Describe the scene shown in the picture prompt in as much detail as possible.",
    prompt:
      "Imagine you are looking at a photo of a family cooking together in a kitchen. Describe everything you see.",
    maxDurationMs: 90_000,
  },
  {
    id: "story-recall",
    title: "Story Recall",
    description: "Listen to a short story and retell it in your own words.",
    prompt:
      "Recall a memorable event from your life and describe what happened, who was involved, and how it made you feel.",
    maxDurationMs: 120_000,
  },
  {
    id: "free-conversation",
    title: "Open Conversation",
    description: "Speak freely about any topic of your choice for at least one minute.",
    prompt: "Share your thoughts about how technology has changed communication in your lifetime.",
    maxDurationMs: 90_000,
  },
];

// Helpers to build randomized, non-repeating tasks per session
function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function makeWordRecallTask(id: string, title: string, words: string[]): CognitiveTask {
  const options = shuffle(words);
  const sequenceAnswer = words.map((w) => options.indexOf(w));
  return {
    id,
    type: "word-recall",
    title,
    description: "Remember the list of words and tap them in the same order after Begin.",
    prompt: `Remember the words: ${words.join(", ")}.`,
    options,
    sequenceAnswer,
  };
}

function makeDigitSpanTask(id: string, title: string, digits: number[]): CognitiveTask {
  const pool = shuffle(Array.from(new Set([...digits, ...shuffle([0,1,2,3,4,5,6,7,8,9]).slice(0, 5)])));
  const options = pool.map(String);
  const sequenceAnswer = digits.map((d) => options.indexOf(String(d)));
  return {
    id,
    type: "digit-span",
    title,
    description: "Tap the digits in the exact order after Begin.",
    prompt: digits.join(", "),
    options,
    sequenceAnswer,
  };
}

const WORDS_BY_LANG: Record<string, string[]> = {
  en: ["Apple", "Train", "Moon", "Garden", "Candle", "Bridge", "Star", "Window", "River", "Mirror", "Bottle"],
  hi: ["सेब", "रेल", "चाँद", "बाग", "मोमबत्ती", "पुल", "तारा", "खिड़की", "नदी", "आईना", "बोतल"],
  bn: ["আপেল", "ট্রেন", "চাঁদ", "উদ্যান", "মোমবাতি", "সেতু", "তারকা", "জানালা", "নদী", "আয়না", "বোতল"],
  ta: ["ஆப்பிள்", "ரயில்", "நிலா", "தோட்டம்", " மெழுகுவர்த்தி", "பாலம்", "நட்சத்திரம்", "ஜன்னல்", "நதி", "கண்ணாடி", "பாட்டில்"],
};

function generateCognitiveTasks(language: string): CognitiveTask[] {
  const lex = WORDS_BY_LANG[language] ?? WORDS_BY_LANG.en;
  // Word pools (unique per session)
  const poolA = shuffle(lex).slice(0, 5);
  const poolB = shuffle(lex.filter((w) => !poolA.includes(w))).slice(0, 5);

  const word1 = makeWordRecallTask("word-recall", "Word Recall", poolA);
  const word2 = makeWordRecallTask("word-recall-2", "Word Recall II", poolB);

  const digit1 = makeDigitSpanTask("digit-span", "Digit Span", [3, 9, 1, 4, 7]);
  const digit2 = makeDigitSpanTask("digit-span-reverse", "Digit Span (Reverse)", [7, 2, 9, 3]);

  const attention1: CognitiveTask = {
    id: "attention-sequence",
    type: "attention",
    title: "Attention Pattern",
    description: "Continue the color sequence.",
    prompt: "Red → Blue → Red → Blue → ?",
    options: ["Red", "Blue", "Green"],
    correctAnswer: 0,
  };

  const visualSearch: CognitiveTask = {
    id: "attention-visual",
    type: "attention",
    title: "Visual Search",
    description: "Find the odd-one-out.",
    prompt: "Square, Square, Circle, Square → Which is different?",
    options: ["Circle", "Square", "Triangle"],
    correctAnswer: 0,
  };

  const clock: CognitiveTask = {
    id: "clock-drawing",
    type: "clock-drawing",
    title: "Clock Drawing",
    description: "Imagine drawing a clock showing the time 10 past 11.",
    prompt: "Picture a clock and describe how you would place the numbers and hands for 11:10.",
  };

  return [word1, digit1, attention1, word2, digit2, visualSearch, clock];
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  ml: "മലയാളം",
  mr: "मराठी",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
};

const STEP_CONFIG = [
  {
    id: "consent",
    title: "Onboarding & Consent",
    icon: ShieldCheck,
  },
  {
    id: "speech",
    title: "Speech Assessment",
    icon: AudioWaveform,
  },
  {
    id: "cognitive",
    title: "Cognitive Tasks",
    icon: ClipboardList,
  },
  {
    id: "results",
    title: "AI Risk Summary",
    icon: BrainCircuit,
  },
] as const;

const Assessment = () => {
  const { user, setUser, assessmentId, setAssessmentId, clearSession } = useUserSession();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeechUploading, setIsSpeechUploading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const cognitiveTasks = useMemo(() => generateCognitiveTasks(user?.language || "en"), [user?.language]);
  const [isResultPending, setIsResultPending] = useState(false);
  const [history, setHistory] = useState<AssessmentResult[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ content: () => reportRef.current, documentTitle: `Cognitive-Report-${assessmentId}` });

  const activeStep = STEP_CONFIG[activeStepIndex];

  useEffect(() => {
    setResult(null);
  }, [assessmentId]);

  useEffect(() => {
    if (user) {
      setHistory(loadAssessmentHistory(user.id));
    }
  }, [user]);

  const advanceStep = useCallback(() => {
    setActiveStepIndex((index) => Math.min(index + 1, STEP_CONFIG.length - 1));
  }, []);

  const resetAssessment = () => {
    clearSession();
    setActiveStepIndex(0);
    setResult(null);
    setIsResultPending(false);
  };

  const handleOnboardingSubmit = async (values: OnboardingFormValues) => {
    try {
      setIsLoading(true);
      const payload = {
        name: values.name,
        age: values.age,
        language: values.language,
        consent: values.consent,
      };
      const response = await registerUser(payload);
      setUser({
        id: response.user.id,
        name: response.user.name,
        age: response.user.age,
        language: response.user.language,
        consent: response.user.consent,
        accessToken: response.accessToken,
      });

      const assessment = await startAssessment(response.accessToken);
      setAssessmentId(assessment.assessmentId);
      toast({
        title: "Registration successful",
        description: "You can now begin your spoken assessment.",
      });
      advanceStep();
    } catch (error) {
      console.error(error);
      toast({
        title: "Could not register",
        description: error instanceof Error ? error.message : "Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeechUpload = async ({ taskId, blob, durationMs }: { taskId: string; blob: Blob; durationMs: number }) => {
    if (!assessmentId || !user) {
      toast({
        title: "Assessment not started",
        description: "Please complete onboarding first.",
      });
      return;
    }

    try {
      setIsSpeechUploading(true);
      await uploadSpeechSample({
        assessmentId,
        taskId,
        blob,
        language: user.language,
        accessToken: user.accessToken,
        // pass duration to backend for analytics
        durationMs,
      });

      toast({
        title: "Speech sample captured",
        description: `Recorded ${Math.round(durationMs / 1000)} seconds for ${taskId}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Check your connection and try again.",
      });
    } finally {
      setIsSpeechUploading(false);
    }
  };

  const handleSpeechComplete = () => {
    toast({
      title: "Speech tasks done",
      description: "Continue with the cognitive exercises.",
    });
    advanceStep();
  };

  const handleCognitiveComplete = async ({ logs, scores, clockDrawing }: CognitiveCompletionPayload) => {
    if (!assessmentId || !user) {
      toast({
        title: "Assessment not started",
        description: "Please complete onboarding first.",
      });
      return;
    }

    try {
      setIsLoading(true);
      // Move to Results first for smoother UX
      advanceStep();
      setIsResultPending(true);

      // 1) Submit cognitive data
      await submitCognitiveData(
        {
          assessmentId,
          logs,
          cognitiveScores: scores,
          clockDrawing,
        },
        user.accessToken,
      );
      toast({ title: "Cognitive data captured" });

      // 2) Trigger prediction
      await requestRiskPrediction(assessmentId, user.accessToken);

      // 3) Poll for result
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let fetched: AssessmentResult | null = null;
      for (let i = 0; i < 15; i++) {
        try {
          fetched = await fetchAssessmentResult(assessmentId, user.accessToken);
          break;
        } catch (err) {
          // 404 "Prediction not ready" or transient error
          await sleep(1000);
        }
      }
      if (fetched) {
        setResult(fetched);
        try {
          saveAssessmentResult(user.id, fetched);
          setHistory(loadAssessmentHistory(user.id));
        } catch {}
      } else {
        toast({
          title: "Prediction pending",
          description: "Result is taking longer than usual. Please wait a few seconds and retry.",
        });
      }
      setIsResultPending(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "Prediction failed",
        description: error instanceof Error ? error.message : "Please try again later.",
      });
      setIsResultPending(false);
    } finally {
      setIsLoading(false);
    }
  };

  const languageLabel = useMemo(() => (user ? LANGUAGE_LABEL[user.language] ?? user.language : undefined), [user]);

  return (
    <div className="min-h-screen bg-background py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-10">
        <header className="space-y-4 text-center">
          <Badge variant="secondary">Clinical Screening Workflow</Badge>
          <h1 className="text-4xl font-bold text-foreground">Mindful Cognitive Screening</h1>
          <p className="text-muted-foreground">
            Complete a guided onboarding, record speech samples, finish cognitive tasks, and view an AI-powered
            dementia risk summary in your preferred language.
          </p>
        </header>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-muted-foreground">Assessment Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              {STEP_CONFIG.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === activeStepIndex;
                const isCompleted = index < activeStepIndex;
                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-4 text-center transition ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : isCompleted
                        ? "border-green-500/60 bg-green-500/10 text-green-600"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <Icon className="mx-auto mb-2 h-8 w-8" />
                    <p className="text-sm font-medium">{step.title}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {activeStep.id === "consent" && (
          <div className="max-w-3xl mx-auto">
            <OnboardingForm user={user} onSubmit={handleOnboardingSubmit} isSubmitting={isLoading} />
          </div>
        )}

        {activeStep.id === "speech" && user && assessmentId && (
          <div className="space-y-6">
            <SpeechRecorder
              language={user.language}
              tasks={SPEECH_TASKS}
              isUploading={isSpeechUploading}
              onUpload={handleSpeechUpload}
              onComplete={handleSpeechComplete}
            />
          </div>
        )}

        {activeStep.id === "cognitive" && assessmentId && (
          <div className="space-y-6">
            <CognitiveTasks tasks={cognitiveTasks} onComplete={handleCognitiveComplete} isSubmitting={isLoading} />
          </div>
        )}

        {activeStep.id === "results" && (
          <div className="space-y-6">
            {isResultPending && (
              <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-dashed p-10 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  Running multi-modal analysis. This typically takes 20-30 seconds.
                </p>
              </div>
            )}
            {result && (
              <>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handlePrint}>Download PDF</Button>
                </div>
                <div ref={reportRef} className="space-y-6">
                  <RiskResultCard result={result} languageLabel={languageLabel} />
                  <AnalyticsCharts result={result} history={history} />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-4 justify-between">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Need clinical review? Share your anonymized assessment ID with healthcare professionals:
                  <strong> {assessmentId}</strong>
                </p>
                <p>All speech and cognitive data remain encrypted at rest and in transit.</p>
              </div>
              <Button variant="outline" onClick={resetAssessment}>
                Start New Assessment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assessment;
